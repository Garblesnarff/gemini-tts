import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Volume2, Sparkles, Wand2, Loader2, Music4, Users, User, Trash2, Archive, Save, FolderOpen, Upload, Sun, Moon, Plus, Minus, BarChart3, Activity, BookTemplate } from 'lucide-react';
import { VOICES, STYLE_PRESETS, SAMPLE_RATE, SPEAKER_COLORS, VOICE_PREVIEWS } from './constants';
import { GeneratedAudio, SpeakerConfig, SessionData, ToastMessage, VoiceProfile } from './types';
import { generateSpeech } from './services/geminiService';
import { decodeAudioData, audioBufferToWav, audioBufferToMp3, createBatchZip } from './utils/audioUtils';
import * as db from './utils/db';
import Visualizer from './components/Visualizer';
import { HistoryItem } from './components/HistoryItem';
import PlayerControls from './components/PlayerControls';
import ToastContainer from './components/Toast';
import ProfileModal from './components/ProfileModal';

const MAX_CHAR_COUNT = 5000;

const App: React.FC = () => {
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('gemini-vox-theme') as 'dark' | 'light' || 'dark';
    }
    return 'dark';
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts(prev => [...prev, { id: Date.now().toString(), type, message }]);
  };
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Mode State
  const [mode, setMode] = useState<'single' | 'multi'>('single');

  // Config State
  const [text, setText] = useState('');
  
  // Single Mode State
  const [voice, setVoice] = useState(VOICES[0].name);
  const [stylePrompt, setStylePrompt] = useState('Normal');
  const [customStyle, setCustomStyle] = useState('');

  // Multi Mode State (3+ Speakers)
  const [speakers, setSpeakers] = useState<SpeakerConfig[]>([
    { id: '1', name: 'Joe', voice: 'Puck', color: SPEAKER_COLORS[0] },
    { id: '2', name: 'Jane', voice: 'Kore', color: SPEAKER_COLORS[1] }
  ]);

  // Voice Preview State
  const [previewVoice, setPreviewVoice] = useState<string | null>(null);
  
  // Visualizer Mode
  const [vizMode, setVizMode] = useState<'spectrum' | 'waveform'>('spectrum');

  // App State
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedAudio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null); // For voice preview
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const rafRef = useRef<number>();

  // --- Theme Effect ---
  useEffect(() => {
      const root = window.document.documentElement;
      if (theme === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
      localStorage.setItem('gemini-vox-theme', theme);
  }, [theme]);

  // --- Persistence ---
  useEffect(() => {
    // Load history from DB on mount
    const loadHistory = async () => {
        try {
            const savedItems = await db.getAllItems();
            if (savedItems.length > 0) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
                
                const hydratedItems = await Promise.all(savedItems.map(async (item) => {
                    const buffer = await decodeAudioData(item.base64, ctx, SAMPLE_RATE);
                    return { ...item, audioBuffer: buffer };
                }));
                // Sort by timestamp desc
                setHistory(hydratedItems.sort((a, b) => b.timestamp - a.timestamp));
                audioContextRef.current = ctx; // Cache this context
                setupAudioNodes(ctx);
            }
        } catch (e) {
            console.error("Failed to load history", e);
            addToast('error', 'Failed to load history');
        }
    };
    loadHistory();
  }, []);

  // --- Audio Engine ---
  const setupAudioNodes = (ctx: AudioContext) => {
    if (!gainNodeRef.current) {
        gainNodeRef.current = ctx.createGain();
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 256; // Keep 256 for now, can increase for waveform resolution
        gainNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
    }
  };

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      setupAudioNodes(audioContextRef.current);
    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, []);

  const playAudio = useCallback((item: GeneratedAudio, offset: number = 0) => {
    const ctx = initAudioContext();
    if (!ctx || !item.audioBuffer || !gainNodeRef.current) return;

    if (activeId !== item.id) stopAudio();
    else if (isPlaying) stopAudio();

    // Stop preview if playing
    if (previewSourceRef.current) {
        try { previewSourceRef.current.stop(); } catch (e) {}
        previewSourceRef.current = null;
        setPreviewVoice(null);
    }

    const source = ctx.createBufferSource();
    source.buffer = item.audioBuffer;
    source.playbackRate.value = playbackRate;
    source.connect(gainNodeRef.current);

    const startAt = ctx.currentTime;
    startTimeRef.current = startAt - (offset / playbackRate);
    
    source.start(0, offset);
    sourceNodeRef.current = source;
    
    setActiveId(item.id);
    setDuration(item.duration);
    setIsPlaying(true);
    
    const tick = () => {
        const current = (ctx.currentTime - startTimeRef.current) * playbackRate;
        if (current >= item.duration) {
            stopAudio();
            setCurrentTime(item.duration);
        } else {
            setCurrentTime(current);
            rafRef.current = requestAnimationFrame(tick);
        }
    };
    tick();

    source.onended = () => {
       // handled by tick mostly
    };
  }, [activeId, isPlaying, playbackRate, initAudioContext, stopAudio]);

  const handleSeek = (time: number) => {
    if (!activeId) return;
    const item = history.find(h => h.id === activeId);
    if (!item) return;
    
    pauseTimeRef.current = time;
    setCurrentTime(time);
    
    if (isPlaying) {
        playAudio(item, time);
    }
  };

  const handlePlayPause = () => {
      if (!activeId && history.length > 0) {
          playAudio(history[0], 0);
          return;
      }
      if (!activeId) return;

      const item = history.find(h => h.id === activeId);
      if (!item) return;

      if (isPlaying) {
          stopAudio();
          pauseTimeRef.current = currentTime;
      } else {
          playAudio(item, currentTime >= duration ? 0 : currentTime);
      }
  };

  // Voice Preview Logic
  const handlePreviewVoice = async (voiceName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const ctx = initAudioContext();
      if (!ctx || !gainNodeRef.current) return;

      if (isPlaying) stopAudio();
      
      if (previewSourceRef.current) {
          try { previewSourceRef.current.stop(); } catch(e) {}
          previewSourceRef.current = null;
      }

      if (previewVoice === voiceName) {
          setPreviewVoice(null);
          return;
      }

      setPreviewVoice(voiceName);

      const previewBase64 = VOICE_PREVIEWS[voiceName];
      let buffer: AudioBuffer;

      try {
        if (previewBase64) {
             buffer = await decodeAudioData(previewBase64, ctx, SAMPLE_RATE);
        } else {
             buffer = ctx.createBuffer(1, SAMPLE_RATE * 1.5, SAMPLE_RATE); 
             const data = buffer.getChannelData(0);
             for(let i=0; i < buffer.length; i++) {
                 data[i] = Math.sin(i * 0.01) * 0.5 * (1 - i/buffer.length);
             }
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNodeRef.current);
        source.start();
        source.onended = () => setPreviewVoice(null);
        previewSourceRef.current = source;
      } catch (e) {
          addToast('error', 'Preview failed');
          setPreviewVoice(null);
      }
  };

  // Update volume/speed live
  useEffect(() => {
      if (gainNodeRef.current) gainNodeRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => {
      if (sourceNodeRef.current) sourceNodeRef.current.playbackRate.value = playbackRate;
      if (isPlaying && activeId) {
          const item = history.find(h => h.id === activeId);
          if (item) playAudio(item, currentTime);
      }
  }, [playbackRate]);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
          if (e.code === 'Space') {
              e.preventDefault();
              handlePlayPause();
          } else if (e.code === 'Escape') {
              stopAudio();
          }
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
  }, [handlePlayPause, stopAudio]);


  // --- Logic ---

  const handleGenerate = async () => {
    if (!text.trim()) return;
    if (text.length > MAX_CHAR_COUNT) {
        addToast('error', `Text too long! Limit is ${MAX_CHAR_COUNT} characters.`);
        return;
    }
    
    setIsGenerating(true);
    const ctx = initAudioContext();

    try {
      const activeStyle = stylePrompt === 'Custom' ? customStyle : stylePrompt;
      
      const base64Data = await generateSpeech({
        text,
        mode,
        voiceName: voice,
        stylePrompt: activeStyle,
        speakers: speakers
      });

      if (ctx) {
        const buffer = await decodeAudioData(base64Data, ctx, SAMPLE_RATE);
        
        let voiceLabel = voice;
        if (mode === 'multi') {
            if (speakers.length === 2) {
                voiceLabel = `Duo: ${speakers[0].name} & ${speakers[1].name}`;
            } else {
                voiceLabel = `Cast (${speakers.length}): ${speakers.map(s => s.name).join(', ')}`;
            }
        }

        const newItem: GeneratedAudio = {
          id: Date.now().toString(),
          text,
          voice: voiceLabel,
          style: mode === 'single' ? activeStyle : 'Conversation',
          timestamp: Date.now(),
          audioBuffer: buffer,
          base64: base64Data,
          duration: buffer.duration,
          mode,
          isFavorite: false
        };

        await db.saveItem(newItem);
        setHistory(prev => [newItem, ...prev]);
        playAudio(newItem);
        addToast('success', 'Audio generated successfully!');
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to generate speech.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (activeId === id) stopAudio();
    await db.deleteItem(id);
    setHistory(prev => prev.filter(item => item.id !== id));
    addToast('info', 'Item deleted');
  };

  const handleToggleFavorite = async (id: string) => {
      const item = history.find(h => h.id === id);
      if (item) {
          const newItem = { ...item, isFavorite: !item.isFavorite };
          await db.saveItem(newItem);
          setHistory(prev => prev.map(p => p.id === id ? newItem : p));
      }
  };

  const handleDownload = (item: GeneratedAudio, format: 'wav' | 'mp3') => {
    if (!item.audioBuffer) return;
    let blob: Blob;
    if (format === 'mp3') {
        blob = audioBufferToMp3(item.audioBuffer);
    } else {
        blob = audioBufferToWav(item.audioBuffer);
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-vox-${item.id}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', `Downloaded as ${format.toUpperCase()}`);
  };

  const handleBatchDownload = async () => {
      if (history.length === 0) return;
      try {
          const blob = await createBatchZip(history);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `gemini-vox-history-${Date.now()}.zip`;
          a.click();
          URL.revokeObjectURL(url);
          addToast('success', 'Batch download started');
      } catch (e) {
          console.error(e);
          addToast('error', "Failed to create zip");
      }
  };

  const handleExportSession = async () => {
      const exportData: SessionData = {
          version: 1,
          timestamp: Date.now(),
          history: history.map(({ audioBuffer, ...rest }) => rest)
      };
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gemini-vox-session.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Session exported');
  };

  const handleImportSession = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const data = JSON.parse(event.target?.result as string) as SessionData;
              if (data.history) {
                  const ctx = initAudioContext();
                  const hydrated = await Promise.all(data.history.map(async (item) => {
                       const buffer = await decodeAudioData(item.base64, ctx, SAMPLE_RATE);
                       await db.saveItem({ ...item, audioBuffer: buffer } as GeneratedAudio);
                       return { ...item, audioBuffer: buffer } as GeneratedAudio;
                  }));
                  setHistory(prev => [...hydrated, ...prev]);
                  addToast('success', `Imported ${hydrated.length} items`);
              }
          } catch (e) {
              addToast('error', "Invalid session file");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // reset
  };

  const handleClearAll = async () => {
      if (confirm("Are you sure you want to delete all history?")) {
          stopAudio();
          await db.clearDB();
          setHistory([]);
          setActiveId(null);
          addToast('info', 'All history cleared');
      }
  };

  // Multi-speaker Helpers
  const addSpeaker = () => {
      if (speakers.length >= 5) return;
      setSpeakers([...speakers, { 
          id: Date.now().toString(), 
          name: `Speaker ${speakers.length + 1}`, 
          voice: VOICES[speakers.length % VOICES.length].name,
          color: SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length]
      }]);
  };

  const removeSpeaker = (id: string) => {
      if (speakers.length <= 2) return;
      setSpeakers(speakers.filter(s => s.id !== id));
  };

  const updateSpeaker = (id: string, field: keyof SpeakerConfig, value: string) => {
      setSpeakers(speakers.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  
  // Profile loading
  const handleLoadProfile = (p: VoiceProfile) => {
      setMode('single'); // Profiles are typically single speaker config in this iteration
      setVoice(p.voice);
      if (p.customStyle) {
          setStylePrompt('Custom');
          setCustomStyle(p.customStyle);
      } else {
          setStylePrompt(p.style);
      }
      addToast('success', `Loaded profile: ${p.name}`);
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 p-4 md:p-8 flex flex-col items-center">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ProfileModal 
         isOpen={isProfileModalOpen} 
         onClose={() => setIsProfileModalOpen(false)}
         onLoadProfile={handleLoadProfile}
         currentSettings={{ voice, style: stylePrompt, customStyle }}
         addToast={addToast}
      />
      
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mb-24">
        
        {/* LEFT COLUMN: Controls */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent flex items-center gap-3">
                <Sparkles className="text-indigo-500" />
                Gemini Vox
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                Next-gen Text-to-Speech powered by Gemini 2.5 Flash
                </p>
            </div>
            
            {/* Header Actions */}
            <div className="flex gap-2 items-center">
                <button 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="p-2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    title="Manage Profiles"
                >
                    <BookTemplate size={20} />
                </button>
                <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
                <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <label className="p-2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer rounded-full hover:bg-slate-200 dark:hover:bg-slate-800" title="Import Session">
                    <FolderOpen size={20} />
                    <input type="file" accept=".json" onChange={handleImportSession} className="hidden" />
                </label>
                <button onClick={handleExportSession} className="p-2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800" title="Export Session">
                    <Save size={20} />
                </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-sm">
            
            {/* Mode Switcher */}
            <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded-xl flex items-center mb-6 border border-slate-200 dark:border-slate-800">
                <button 
                  onClick={() => setMode('single')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    mode === 'single' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                    <User size={16} /> Solo
                </button>
                <button 
                  onClick={() => setMode('multi')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    mode === 'multi' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                    <Users size={16} /> Conversation
                </button>
            </div>

            {mode === 'single' ? (
                <>
                    {/* Solo Voice Selection */}
                    <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Select Voice
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {VOICES.map((v) => (
                        <div
                            key={v.name}
                            className={`group relative p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            voice === v.name
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-md'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                            onClick={() => setVoice(v.name)}
                        >
                            <div className="font-medium text-sm flex items-center justify-between">
                                {v.label}
                                {voice === v.name && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
                            </div>
                            <div className="text-[10px] opacity-70 mt-1">{v.gender} • {v.description}</div>
                            
                            {/* Preview Button */}
                            <button
                                onClick={(e) => handlePreviewVoice(v.name, e)}
                                className={`absolute top-2 right-2 p-1.5 rounded-full transition-all ${
                                    previewVoice === v.name 
                                    ? 'bg-indigo-500 text-white animate-pulse' 
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:text-indigo-500 opacity-0 group-hover:opacity-100'
                                }`}
                                title="Preview Voice"
                            >
                                <Volume2 size={12} />
                            </button>
                        </div>
                        ))}
                    </div>
                    </div>

                    {/* Style Selection */}
                    <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Expression Style
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {STYLE_PRESETS.map((style) => (
                        <button
                            key={style}
                            onClick={() => setStylePrompt(style)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            stylePrompt === style
                                ? 'bg-purple-500 text-white border-purple-500'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                            }`}
                        >
                            {style}
                        </button>
                        ))}
                        <button
                            onClick={() => setStylePrompt('Custom')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                            stylePrompt === 'Custom'
                                ? 'bg-purple-500 text-white border-purple-500'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                            }`}
                        >
                            <Wand2 size={12} /> Custom
                        </button>
                    </div>
                    
                    {stylePrompt === 'Custom' && (
                        <input 
                        type="text"
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        placeholder="e.g. Like a pirate, whispering in a library..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                    )}
                    </div>
                </>
            ) : (
                /* Multi Speaker Setup (3+) */
                <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Cast Configuration ({speakers.length})
                        </label>
                        <button 
                            onClick={addSpeaker}
                            disabled={speakers.length >= 5}
                            className="text-xs flex items-center gap-1 text-indigo-500 hover:text-indigo-600 disabled:opacity-50"
                        >
                            <Plus size={14} /> Add Speaker
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {speakers.map((speaker, idx) => (
                            <div key={speaker.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 relative group">
                                <div className="flex items-center gap-2 mb-2">
                                     <div 
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                        style={{ backgroundColor: speaker.color }}
                                     >
                                         {idx + 1}
                                     </div>
                                     <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Speaker {idx + 1}</span>
                                     
                                     {speakers.length > 2 && (
                                         <button 
                                            onClick={() => removeSpeaker(speaker.id)}
                                            className="ml-auto text-slate-400 hover:text-red-500"
                                         >
                                             <Minus size={14} />
                                         </button>
                                     )}
                                </div>
                                <div className="space-y-2">
                                    <input 
                                        type="text" 
                                        value={speaker.name} 
                                        onChange={(e) => updateSpeaker(speaker.id, 'name', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Name"
                                    />
                                    <select 
                                        value={speaker.voice}
                                        onChange={(e) => updateSpeaker(speaker.id, 'voice', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500"
                                    >
                                        {VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Text Input */}
            <div className="mb-6 relative">
              <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Script
                  </label>
                  <span className={`text-[10px] ${text.length > MAX_CHAR_COUNT ? 'text-red-500' : 'text-slate-500'}`}>
                      {text.length} / {MAX_CHAR_COUNT}
                  </span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={mode === 'single' ? "Type something..." : "Joe: Hello!\nJane: Hi there."}
                className="w-full h-40 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed text-sm font-mono"
              />
            </div>

            {/* Action */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim() || text.length > MAX_CHAR_COUNT}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                isGenerating || !text.trim() || text.length > MAX_CHAR_COUNT
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20 active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Generating...
                </>
              ) : (
                <>
                  <Mic size={20} /> Generate Speech
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Output & History */}
        <div className="space-y-6 flex flex-col h-full">
          {/* Main Visualizer Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden flex flex-col">
             <div className="h-[200px] relative flex items-center justify-center bg-slate-50 dark:bg-slate-950/50">
                {/* Visualizer BG */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                
                {/* Visualizer Mode Toggle */}
                <div className="absolute top-4 right-4 z-20 bg-white/10 backdrop-blur-md rounded-lg p-1 flex gap-1 border border-white/20">
                     <button 
                        onClick={() => setVizMode('spectrum')}
                        className={`p-1.5 rounded-md transition-all ${vizMode === 'spectrum' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        title="Spectrum View"
                     >
                         <BarChart3 size={14} />
                     </button>
                     <button 
                        onClick={() => setVizMode('waveform')}
                        className={`p-1.5 rounded-md transition-all ${vizMode === 'waveform' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        title="Waveform View"
                     >
                         <Activity size={14} />
                     </button>
                </div>

                {activeId ? (
                   <div className="w-full h-full p-6 flex flex-col justify-end">
                      <div className="mb-auto flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                           {isPlaying ? <Music4 className="animate-pulse" size={16} /> : <Volume2 size={16}/>}
                           <span className="text-xs font-bold tracking-widest uppercase">Now Playing</span>
                      </div>
                      <Visualizer 
                          analyser={analyserRef.current} 
                          isPlaying={isPlaying} 
                          color="#818cf8"
                          mode={vizMode}
                       />
                   </div>
                ) : (
                    <div className="text-center text-slate-400 dark:text-slate-600 flex flex-col items-center p-6">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <Volume2 size={24} className="text-slate-300 dark:text-slate-500" />
                        </div>
                        <p className="text-sm font-medium">Ready to speak</p>
                    </div>
                )}
             </div>

             {/* Player Controls */}
             <PlayerControls 
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                playbackRate={playbackRate}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onVolumeChange={setVolume}
                onSpeedChange={setPlaybackRate}
             />
          </div>

          {/* History List */}
          <div className="flex-1 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col overflow-hidden min-h-[400px]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                History ({history.length})
              </h3>
              <div className="flex gap-2">
                  <button 
                    onClick={handleBatchDownload} 
                    className="p-1.5 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Download All as ZIP"
                  >
                      <Archive size={18} />
                  </button>
                  <button 
                    onClick={handleClearAll} 
                    className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Clear All"
                  >
                      <Trash2 size={18} />
                  </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 opacity-60">
                  <p className="text-sm">No generations yet.</p>
                </div>
              ) : (
                history.map(item => (
                  <HistoryItem 
                    key={item.id}
                    item={item}
                    isPlaying={isPlaying}
                    isActive={activeId === item.id}
                    onPlay={() => playAudio(item, 0)}
                    onPause={handlePlayPause}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
