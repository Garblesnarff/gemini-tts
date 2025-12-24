import { VoiceProfile } from '../types';

const API_BASE = 'http://localhost:3001/api';

export const isServerAvailable = async (): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/profiles`, { method: 'HEAD' });
        return res.ok;
    } catch {
        return false;
    }
};

export const fetchProfiles = async (): Promise<VoiceProfile[]> => {
    const res = await fetch(`${API_BASE}/profiles`);
    if (!res.ok) throw new Error("Failed to fetch profiles");
    return res.json();
};

export const saveProfile = async (profile: Partial<VoiceProfile>): Promise<VoiceProfile> => {
    const res = await fetch(`${API_BASE}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
    });
    if (!res.ok) throw new Error("Failed to save profile");
    return res.json();
};

export const deleteProfile = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/profiles/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Failed to delete profile");
};
