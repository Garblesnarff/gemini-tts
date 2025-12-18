import { GoogleGenAI, Modality } from "@google/genai";
import { SAMPLE_RATE } from "../constants";

// Initialize the client
// IMPORTANT: process.env.API_KEY is assumed to be available
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateSpeech = async (
  text: string,
  voiceName: string,
  stylePrompt: string
): Promise<string> => {
  // Construct the prompt with style if provided
  const finalPrompt = stylePrompt && stylePrompt !== "Normal" 
    ? `${stylePrompt}: ${text}` 
    : text;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: finalPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
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
