import { VoiceOption } from './types';

export const VOICES: VoiceOption[] = [
  { name: 'Puck', label: 'Puck', gender: 'Male', description: 'Energetic & clear' },
  { name: 'Charon', label: 'Charon', gender: 'Male', description: 'Deep & authoritative' },
  { name: 'Kore', label: 'Kore', gender: 'Female', description: 'Calm & soothing' },
  { name: 'Fenrir', label: 'Fenrir', gender: 'Male', description: 'Strong & intense' },
  { name: 'Zephyr', label: 'Zephyr', gender: 'Female', description: 'Bright & friendly' },
];

export const STYLE_PRESETS = [
  "Normal",
  "Cheerfully",
  "Sadly",
  "Whispering",
  "Professionally",
  "Like a news anchor",
  "Excitedly",
  "Mysteriously"
];

export const SAMPLE_RATE = 24000;

export const SPEAKER_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];

// In a real app, these would be base64 strings or URLs to pre-generated audio files.
// For this demo, we can just assume they might be populated.
export const VOICE_PREVIEWS: Record<string, string> = {
  Puck: "", 
  Charon: "",
  Kore: "",
  Fenrir: "",
  Zephyr: ""
};
