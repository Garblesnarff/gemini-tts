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
