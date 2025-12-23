export interface VoiceOption {
  name: string;
  label: string;
  gender: 'Male' | 'Female';
  description: string;
}

export interface GeneratedAudio {
  id: string;
  text: string;
  voice: string; // "Puck" or "Duo: Joe & Jane"
  style: string;
  timestamp: number;
  audioBuffer: AudioBuffer | null;
  base64: string; // Stored for download/re-decoding if needed
  duration: number;
  mode: 'single' | 'multi';
  isFavorite?: boolean;
}

export interface SpeakerConfig {
  name: string;
  voice: string;
}

export interface TTSRequest {
  text: string;
  mode: 'single' | 'multi';
  voiceName?: string;
  stylePrompt?: string;
  speakers?: SpeakerConfig[];
}

export interface SessionData {
  version: number;
  timestamp: number;
  history: Omit<GeneratedAudio, 'audioBuffer'>[]; // Exclude buffer from JSON export, re-create from base64 on import
}
