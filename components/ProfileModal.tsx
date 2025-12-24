import React, { useEffect, useState } from 'react';
import { VoiceProfile } from '../types';
import { fetchProfiles, saveProfile, deleteProfile, isServerAvailable } from '../services/profileService';
import { X, Trash2, Save, User, CloudOff } from 'lucide-react';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadProfile: (profile: VoiceProfile) => void;
    currentSettings: { voice: string, style: string, customStyle: string };
    addToast: (type: any, msg: string) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onLoadProfile, currentSettings, addToast }) => {
    const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [serverError, setServerError] = useState(false);
    
    // Form state
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileDesc, setNewProfileDesc] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadProfiles();
        }
    }, [isOpen]);

    const loadProfiles = async () => {
        setIsLoading(true);
        setServerError(false);
        try {
            if (await isServerAvailable()) {
                const data = await fetchProfiles();
                setProfiles(data);
            } else {
                setServerError(true);
            }
        } catch (e) {
            setServerError(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newProfileName.trim()) return;
        try {
            const newProfile = await saveProfile({
                name: newProfileName,
                description: newProfileDesc,
                voice: currentSettings.voice,
                style: currentSettings.style,
                customStyle: currentSettings.customStyle
            });
            setProfiles([...profiles, newProfile]);
            setNewProfileName('');
            setNewProfileDesc('');
            addToast('success', 'Profile saved!');
        } catch (e) {
            addToast('error', 'Failed to save profile');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!confirm('Delete this profile?')) return;
        try {
            await deleteProfile(id);
            setProfiles(profiles.filter(p => p.id !== id));
            addToast('info', 'Profile deleted');
        } catch(e) {
            addToast('error', 'Failed to delete');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <User size={20} className="text-indigo-500" />
                        Voice Profiles
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {serverError ? (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-center">
                            <CloudOff size={48} className="mb-4 text-slate-400" />
                            <p className="font-medium">Server Disconnected</p>
                            <p className="text-xs mt-1">Make sure the API server is running on port 3001.</p>
                            <p className="text-xs font-mono mt-2 bg-slate-100 dark:bg-slate-950 p-2 rounded">npm run server</p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex justify-center py-8"><span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></span></div>
                    ) : (
                        <div className="space-y-4">
                            {/* Save New */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-3 tracking-wider">Save Current Config</h3>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input 
                                            value={newProfileName}
                                            onChange={(e) => setNewProfileName(e.target.value)}
                                            placeholder="Profile Name (e.g. My Narrator)"
                                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                        />
                                        <button 
                                            onClick={handleSave}
                                            disabled={!newProfileName.trim()}
                                            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white p-2 rounded-lg"
                                        >
                                            <Save size={18} />
                                        </button>
                                    </div>
                                    <input 
                                        value={newProfileDesc}
                                        onChange={(e) => setNewProfileDesc(e.target.value)}
                                        placeholder="Description (optional)"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500"
                                    />
                                    <div className="text-xs text-slate-500 mt-1">
                                        Voice: <span className="font-medium text-slate-700 dark:text-slate-300">{currentSettings.voice}</span> • 
                                        Style: <span className="font-medium text-slate-700 dark:text-slate-300">{currentSettings.customStyle || currentSettings.style}</span>
                                    </div>
                                </div>
                            </div>

                            {/* List */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-1 tracking-wider">Saved Profiles</h3>
                                {profiles.map(p => (
                                    <div 
                                        key={p.id} 
                                        onClick={() => { onLoadProfile(p); onClose(); }}
                                        className="group flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500 cursor-pointer transition-all"
                                    >
                                        <div>
                                            <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.name}</div>
                                            <div className="text-xs text-slate-500">{p.description}</div>
                                            <div className="text-[10px] text-indigo-500 mt-1">{p.voice} • {p.style}</div>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDelete(p.id, e)}
                                            className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {profiles.length === 0 && <p className="text-center text-sm text-slate-500 py-4">No saved profiles found.</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
