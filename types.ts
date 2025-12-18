export interface VoiceOption {
  name: string;
  label: string;
  gender: 'Male' | 'Female';
  description: string;
}

export interface GeneratedAudio {
  id: string;
  text: string;
  voice: string;
  style: string;
  timestamp: number;
  audioBuffer: AudioBuffer | null;
  base64: string; // Stored for download/re-decoding if needed
  duration: number;
}

export interface TTSConfig {
  voiceName: string;
  stylePrompt: string;
  text: string;
}
