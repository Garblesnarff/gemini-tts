import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Play, Pause, Download, Volume2, Sparkles, Wand2, Loader2, Music4, Users, User, ArrowRightLeft } from 'lucide-react';
import { VOICES, STYLE_PRESETS, SAMPLE_RATE } from './constants';
import { GeneratedAudio, SpeakerConfig } from './types';
import { generateSpeech } from './services/geminiService';
import { decodeAudioData, audioBufferToWav } from './utils/audioUtils';
import Visualizer from './components/Visualizer';
import { HistoryItem } from './components/HistoryItem';

const App: React.FC = () => {
  // Mode State
  const [mode, setMode] = useState<'single' | 'multi'>('single');

  // Config State
  const [text, setText] = useState('');
  
  // Single Mode State
  const [voice, setVoice] = useState(VOICES[0].name);
  const [stylePrompt, setStylePrompt] = useState('Normal');
  const [customStyle, setCustomStyle] = useState('');

  // Multi Mode State
  const [speaker1, setSpeaker1] = useState<SpeakerConfig>({ name: 'Joe', voice: 'Puck' });
  const [speaker2, setSpeaker2] = useState<SpeakerConfig>({ name: 'Jane', voice: 'Kore' });
  
  // App State
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedAudio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize Audio Context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setError(null);
    setIsGenerating(true);
    initAudioContext();

    try {
      const activeStyle = stylePrompt === 'Custom' ? customStyle : stylePrompt;
      
      const base64Data = await generateSpeech({
        text,
        mode,
        voiceName: voice,
        stylePrompt: activeStyle,
        speakers: [speaker1, speaker2]
      });

      if (audioContextRef.current) {
        const buffer = await decodeAudioData(base64Data, audioContextRef.current, SAMPLE_RATE);
        
        // Determine display voice label
        const voiceLabel = mode === 'single' 
          ? voice 
          : `Duo: ${speaker1.name} & ${speaker2.name}`;

        const newItem: GeneratedAudio = {
          id: Date.now().toString(),
          text,
          voice: voiceLabel,
          style: mode === 'single' ? activeStyle : 'Conversation',
          timestamp: Date.now(),
          audioBuffer: buffer,
          base64: base64Data,
          duration: buffer.duration,
          mode
        };

        setHistory(prev => [newItem, ...prev]);
        playAudio(newItem);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate speech. Please check your API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playAudio = useCallback(async (item: GeneratedAudio) => {
    initAudioContext();
    if (!audioContextRef.current || !item.audioBuffer || !analyserRef.current || !gainNodeRef.current) return;

    if (activeId === item.id && isPlaying) {
      stopAudio();
      return;
    }
    stopAudio();

    const source = audioContextRef.current.createBufferSource();
    source.buffer = item.audioBuffer;
    
    source.connect(analyserRef.current);
    analyserRef.current.connect(gainNodeRef.current);

    source.onended = () => {
      setIsPlaying(false);
    };

    source.start(0);
    sourceNodeRef.current = source;
    setActiveId(item.id);
    setIsPlaying(true);
  }, [activeId, isPlaying, initAudioContext, stopAudio]);

  const handleDelete = (id: string) => {
    if (activeId === id) stopAudio();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleDownload = (item: GeneratedAudio) => {
    if (!item.audioBuffer) return;
    const blob = audioBufferToWav(item.audioBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-vox-${item.id}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper for placeholder text
  const getPlaceholder = () => {
    if (mode === 'single') return "Type something amazing here...";
    return `${speaker1.name}: Hey, how are you today?\n${speaker2.name}: I'm doing great! How about you?\n${speaker1.name}: I'm fantastic. Let's make some audio.`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Controls */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles className="text-indigo-400" />
              Gemini Vox
            </h1>
            <p className="text-slate-400 text-sm">
              Next-gen Text-to-Speech powered by Gemini 2.5 Flash
            </p>
          </div>

          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 shadow-xl backdrop-blur-sm">
            
            {/* Mode Switcher */}
            <div className="bg-slate-950 p-1 rounded-xl flex items-center mb-6 border border-slate-800">
                <button 
                  onClick={() => setMode('single')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    mode === 'single' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                    <User size={16} /> Solo
                </button>
                <button 
                  onClick={() => setMode('multi')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    mode === 'multi' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                    <Users size={16} /> Conversation
                </button>
            </div>

            {mode === 'single' ? (
                <>
                    {/* Solo Voice Selection */}
                    <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Select Voice
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {VOICES.map((v) => (
                        <button
                            key={v.name}
                            onClick={() => setVoice(v.name)}
                            className={`relative p-3 rounded-xl border text-left transition-all ${
                            voice === v.name
                                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800/80'
                            }`}
                        >
                            <div className="font-medium text-sm flex items-center justify-between">
                            {v.label}
                            {voice === v.name && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
                            </div>
                            <div className="text-[10px] opacity-70 mt-1">{v.gender} • {v.description}</div>
                        </button>
                        ))}
                    </div>
                    </div>

                    {/* Style Selection */}
                    <div className="mb-6">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
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
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
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
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                    )}
                    </div>
                </>
            ) : (
                /* Multi Speaker Setup */
                <div className="mb-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Cast Configuration (2 Speakers)
                        </label>
                    </div>
                    
                    {/* Speaker 1 Config */}
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">1</div>
                             <span className="text-xs font-medium text-indigo-200">First Speaker</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">Name in Script</label>
                                <input 
                                    type="text" 
                                    value={speaker1.name} 
                                    onChange={(e) => setSpeaker1({...speaker1, name: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">Voice</label>
                                <select 
                                    value={speaker1.voice}
                                    onChange={(e) => setSpeaker1({...speaker1, voice: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 appearance-none"
                                >
                                    {VOICES.map(v => <option key={v.name} value={v.name}>{v.label} ({v.gender})</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Speaker 2 Config */}
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold">2</div>
                             <span className="text-xs font-medium text-purple-200">Second Speaker</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">Name in Script</label>
                                <input 
                                    type="text" 
                                    value={speaker2.name} 
                                    onChange={(e) => setSpeaker2({...speaker2, name: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">Voice</label>
                                <select 
                                    value={speaker2.voice}
                                    onChange={(e) => setSpeaker2({...speaker2, voice: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-purple-500 appearance-none"
                                >
                                    {VOICES.map(v => <option key={v.name} value={v.name}>{v.label} ({v.gender})</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Text Input */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Script
                  </label>
                  {mode === 'multi' && (
                      <span className="text-[10px] text-slate-500">Format: Name: Message</span>
                  )}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed text-sm font-mono"
              />
            </div>

            {/* Action */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                isGenerating || !text.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20 active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Generating Audio...
                </>
              ) : (
                <>
                  <Mic size={20} /> Generate Speech
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Output & History */}
        <div className="space-y-6 flex flex-col h-full">
          {/* Main Visualizer Panel */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden min-h-[200px] flex flex-col justify-center items-center">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            
            {activeId ? (
               <div className="w-full space-y-4 relative z-10">
                 <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2 text-indigo-400">
                        {isPlaying ? <Music4 className="animate-pulse" size={16} /> : <Volume2 size={16}/>}
                        <span className="text-xs font-bold tracking-widest uppercase">Now Playing</span>
                    </div>
                    {activeId && history.find(h => h.id === activeId) && (
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>{history.find(h => h.id === activeId)?.voice}</span>
                            <span className="w-1 h-1 bg-slate-600 rounded-full" />
                            <span>{history.find(h => h.id === activeId)?.style}</span>
                        </div>
                    )}
                 </div>
                 <Visualizer 
                    analyser={analyserRef.current} 
                    isPlaying={isPlaying} 
                    color="#818cf8"
                 />
               </div>
            ) : (
                <div className="text-center text-slate-600 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                        <Volume2 size={24} className="text-slate-500" />
                    </div>
                    <p className="text-sm font-medium">Ready to speak</p>
                    <p className="text-xs mt-1 max-w-[200px]">Generate some audio to see the visualization live.</p>
                </div>
            )}
          </div>

          {/* History List */}
          <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800 shadow-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
              <h3 className="font-semibold text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                History ({history.length})
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60 min-h-[200px]">
                  <p className="text-sm">No generations yet.</p>
                </div>
              ) : (
                history.map(item => (
                  <HistoryItem 
                    key={item.id}
                    item={item}
                    isPlaying={isPlaying}
                    isActive={activeId === item.id}
                    onPlay={playAudio}
                    onPause={stopAudio}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                  />
                ))
              )}
            </div>
          </div>
        </div>

      </div>
      
      {/* Footer */}
      <footer className="mt-12 text-slate-600 text-xs text-center pb-4">
        <p>Built with Gemini 2.5 Flash & React</p>
      </footer>
    </div>
  );
};

export default App;
