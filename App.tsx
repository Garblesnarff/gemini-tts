import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Play, Pause, Download, Volume2, Sparkles, Wand2, Loader2, Music4 } from 'lucide-react';
import { VOICES, STYLE_PRESETS, SAMPLE_RATE } from './constants';
import { GeneratedAudio, TTSConfig } from './types';
import { generateSpeech } from './services/geminiService';
import { decodeAudioData, audioBufferToWav } from './utils/audioUtils';
import Visualizer from './components/Visualizer';
import { HistoryItem } from './components/HistoryItem';

const App: React.FC = () => {
  // Config State
  const [text, setText] = useState('');
  const [voice, setVoice] = useState(VOICES[0].name);
  const [stylePrompt, setStylePrompt] = useState('Normal');
  const [customStyle, setCustomStyle] = useState('');
  
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

  // Initialize Audio Context on user interaction (to adhere to browser policies)
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
      const base64Data = await generateSpeech(text, voice, activeStyle);

      if (audioContextRef.current) {
        const buffer = await decodeAudioData(base64Data, audioContextRef.current, SAMPLE_RATE);
        
        const newItem: GeneratedAudio = {
          id: Date.now().toString(),
          text,
          voice,
          style: activeStyle,
          timestamp: Date.now(),
          audioBuffer: buffer,
          base64: base64Data,
          duration: buffer.duration,
        };

        setHistory(prev => [newItem, ...prev]);
        // Auto play the new item
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
        // ignore if already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playAudio = useCallback(async (item: GeneratedAudio) => {
    initAudioContext();
    if (!audioContextRef.current || !item.audioBuffer || !analyserRef.current || !gainNodeRef.current) return;

    // Stop currently playing
    if (activeId === item.id && isPlaying) {
      stopAudio();
      return;
    }
    stopAudio();

    const source = audioContextRef.current.createBufferSource();
    source.buffer = item.audioBuffer;
    
    // Connect nodes: Source -> Analyser -> Gain -> Destination
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
            
            {/* Voice Selection */}
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
                  autoFocus
                />
              )}
            </div>

            {/* Text Input */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Script
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type something amazing here..."
                className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed"
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
                        <div className="text-xs text-slate-500">
                            {history.find(h => h.id === activeId)?.voice} • {history.find(h => h.id === activeId)?.style}
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
