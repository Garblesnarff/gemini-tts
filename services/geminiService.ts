import { GoogleGenAI, Modality } from "@google/genai";
import { TTSRequest } from "../types";

// Initialize the client
// IMPORTANT: process.env.API_KEY is assumed to be available
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateSpeech = async (request: TTSRequest): Promise<string> => {
  const { text, mode, voiceName, stylePrompt, speakers } = request;

  let config: any = {
    responseModalities: [Modality.AUDIO],
  };

  let contentsPayload: any[] = [];

  if (mode === 'multi' && speakers && speakers.length === 2) {
    // Multi-speaker Logic
    // Construct a specific prompt for the conversation
    const conversationPrompt = `TTS the following conversation between ${speakers[0].name} and ${speakers[1].name}:\n\n${text}`;
    
    contentsPayload = [{ parts: [{ text: conversationPrompt }] }];

    config.speechConfig = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [
          {
            speaker: speakers[0].name,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: speakers[0].voice } }
          },
          {
            speaker: speakers[1].name,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: speakers[1].voice } }
          }
        ]
      }
    };
  } else {
    // Single-speaker Logic
    const finalPrompt = stylePrompt && stylePrompt !== "Normal" 
      ? `${stylePrompt}: ${text}` 
      : text;

    contentsPayload = [{ parts: [{ text: finalPrompt }] }];

    config.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: voiceName || 'Puck' },
      },
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: contentsPayload,
      config: config,
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find(p => p.inlineData);
    
    if (audioPart && audioPart.inlineData && audioPart.inlineData.data) {
      return audioPart.inlineData.data;
    } else {
      throw new Error("No audio data returned from the model.");
    }
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};
