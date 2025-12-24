import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Buffer } from 'node:buffer';
import { GoogleGenAI, Modality } from "@google/genai";
import { base64ToBuffer, createWavHeader, pcmToMp3 } from './audioUtils.js';
import * as profileStore from './profileStore.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- Helper Logic ---

interface GenerationResult {
    buffer: Buffer;
    contentType: string;
    base64?: string;
}

/**
 * Reusable function to process a TTS request.
 * Handles profile resolution, prompt construction, Gemini API call, and audio conversion.
 */
async function processTTSRequest(body: any): Promise<GenerationResult> {
    const { text, voice, style, profile: profileIdOrName, format = 'mp3', speakers } = body;

    if (!text) {
        throw new Error('Text is required');
    }

    let selectedVoice = voice || 'Puck';
    let selectedStyle = style || 'Normal';
    let finalPrompt = text;

    // Resolve profile if provided
    if (profileIdOrName) {
        const profiles = await profileStore.getProfiles();
        const profile = profiles.find(p => p.id === profileIdOrName || p.name.toLowerCase() === profileIdOrName.toLowerCase());
        if (profile) {
            selectedVoice = profile.voice;
            selectedStyle = profile.customStyle || profile.style;
        }
    }

    // Config construction
    let config: any = { responseModalities: [Modality.AUDIO] };
    let contents: any[] = [];

    // Multi-speaker or Single
    if (speakers && speakers.length >= 2) {
        const speakerNames = speakers.map((s: any) => s.name).join(', ');
        finalPrompt = `TTS the following conversation between ${speakerNames}:\n\n${text}`;
        config.speechConfig = {
            multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: speakers.map((s: any) => ({
                    speaker: s.name,
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } }
                }))
            }
        };
    } else {
        if (selectedStyle && selectedStyle !== 'Normal') {
            finalPrompt = `${selectedStyle}: ${text}`;
        }
        config.speechConfig = {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } }
        };
    }

    contents = [{ parts: [{ text: finalPrompt }] }];

    // Call Gemini
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: contents,
        config: config,
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!audioPart || !audioPart.inlineData?.data) {
        throw new Error('No audio returned from Gemini');
    }

    const pcmBase64 = audioPart.inlineData.data;
    const pcmBuffer = base64ToBuffer(pcmBase64);

    if (format === 'base64') {
        return {
            buffer: pcmBuffer, // Not used directly in response but kept for consistency
            contentType: 'application/json',
            base64: pcmBase64
        };
    } else if (format === 'wav') {
        const header = createWavHeader(pcmBuffer.length);
        const wavBuffer = Buffer.concat([header, pcmBuffer]);
        return { buffer: wavBuffer, contentType: 'audio/wav' };
    } else {
        // MP3 (default)
        const mp3Buffer = pcmToMp3(pcmBuffer);
        return { buffer: mp3Buffer, contentType: 'audio/mpeg' };
    }
}


// --- Endpoints ---

// GET /api/profiles
app.get('/api/profiles', async (req, res) => {
  try {
    const profiles = await profileStore.getProfiles();
    res.json(profiles);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// POST /api/profiles
app.post('/api/profiles', async (req, res) => {
  try {
    const { name, voice, style, customStyle, description } = req.body;
    if (!name || !voice) {
      return res.status(400).json({ error: 'Name and voice are required' });
    }
    const newProfile = await profileStore.createProfile({ name, voice, style, customStyle, description });
    res.json(newProfile);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// DELETE /api/profiles/:id
app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const success = await profileStore.deleteProfile(req.params.id);
    if (success) res.json({ success: true });
    else res.status(404).json({ error: 'Profile not found' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// POST /api/tts
app.post('/api/tts', async (req, res) => {
  try {
    const result = await processTTSRequest(req.body);

    if (req.body.format === 'base64') {
        return res.json({ audio: result.base64 });
    }

    res.set('Content-Type', result.contentType);
    return res.send(result.buffer);

  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'TTS Generation Failed' });
  }
});

// POST /api/tts/batch
app.post('/api/tts/batch', async (req, res) => {
    const { items, format = 'mp3' } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: "items must be an array" });
    
    // Process sequentially to ensure we don't hit strict rate limits immediately 
    // and to simplify error handling for the response array.
    const results = [];
    
    for (const item of items) {
        try {
            // Force base64 for batch processing JSON response
            // The user requested 'audio' key in response which implies the data, 
            // usually batch responses are JSON containing the file data or links.
            // Since we don't have file storage, we return base64 audio.
            const result = await processTTSRequest({ ...item, format: format === 'base64' ? 'base64' : format });
            
            // If the user asked for mp3/wav, we convert that buffer to base64 so it fits in the JSON response
            const outputBase64 = result.base64 || result.buffer.toString('base64');

            results.push({ 
                id: item.id, 
                success: true, 
                audio: outputBase64,
                // Duration would require parsing the PCM/MP3 headers, skipping for simplicity in this demo
            });
        } catch (e: any) {
            console.error(`Batch item ${item.id} failed:`, e.message);
            results.push({ 
                id: item.id, 
                success: false, 
                error: e.message 
            });
        }
    }
    
    res.json({ results });
});

app.listen(PORT, () => {
  console.log(`Gemini Vox Server running on port ${PORT}`);
});