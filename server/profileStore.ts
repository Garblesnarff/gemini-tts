import fs from 'fs/promises';
import path from 'path';
import process from 'node:process';
import { VoiceProfile } from '../types.js';

const PROFILE_FILE = path.join(process.cwd(), 'profiles.json');

const DEFAULT_PROFILES: VoiceProfile[] = [
  { id: '1', name: "Narrator", voice: "Charon", style: "Like a documentary narrator", description: "Deep and authoritative", createdAt: Date.now() },
  { id: '2', name: "Dungeon Master", voice: "Charon", style: "Mysteriously", customStyle: "With dramatic pauses and intensity", description: "Perfect for setting the scene", createdAt: Date.now() },
  { id: '3', name: "Excited Hero", voice: "Puck", style: "Excitedly", description: "High energy", createdAt: Date.now() },
  { id: '4', name: "Wise Elder", voice: "Kore", style: "Calmly", customStyle: "Slowly, with ancient wisdom", description: "Soothing and slow", createdAt: Date.now() },
];

export async function initStore() {
  try {
    await fs.access(PROFILE_FILE);
  } catch (e) {
    // File doesn't exist, create with defaults
    await fs.writeFile(PROFILE_FILE, JSON.stringify(DEFAULT_PROFILES, null, 2));
  }
}

export async function getProfiles(): Promise<VoiceProfile[]> {
  await initStore();
  const data = await fs.readFile(PROFILE_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function createProfile(profile: Omit<VoiceProfile, 'id' | 'createdAt'>): Promise<VoiceProfile> {
  const profiles = await getProfiles();
  const newProfile: VoiceProfile = {
    ...profile,
    id: Date.now().toString(),
    createdAt: Date.now()
  };
  profiles.push(newProfile);
  await fs.writeFile(PROFILE_FILE, JSON.stringify(profiles, null, 2));
  return newProfile;
}

export async function deleteProfile(id: string): Promise<boolean> {
  let profiles = await getProfiles();
  const initialLength = profiles.length;
  profiles = profiles.filter(p => p.id !== id);
  if (profiles.length === initialLength) return false;
  
  await fs.writeFile(PROFILE_FILE, JSON.stringify(profiles, null, 2));
  return true;
}