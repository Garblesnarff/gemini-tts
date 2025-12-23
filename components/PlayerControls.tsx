import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, FastForward } from 'lucide-react';

interface PlayerControlsProps {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    playbackRate: number;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onVolumeChange: (val: number) => void;
    onSpeedChange: (val: number) => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    onPlayPause,
    onSeek,
    onVolumeChange,
    onSpeedChange
}) => {
    const formatTime = (t: number) => {
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full bg-slate-900 border-t border-slate-800 p-4 space-y-3">
            {/* Progress Bar */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="w-10 text-right font-mono">{formatTime(currentTime)}</span>
                <input 
                    type="range" 
                    min={0} 
                    max={duration || 1} 
                    step={0.01}
                    value={currentTime}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="w-10 font-mono">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
                {/* Volume */}
                <div className="flex items-center gap-2 w-1/4">
                    <button 
                        onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
                        className="text-slate-400 hover:text-indigo-400 transition-colors"
                    >
                        {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-slate-700 rounded-full appearance-none accent-indigo-500"
                    />
                </div>

                {/* Main Controls */}
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => onSeek(Math.max(0, currentTime - 5))}
                        className="text-slate-400 hover:text-white transition-colors p-2"
                        title="-5s"
                    >
                        <SkipBack size={20} />
                    </button>
                    <button 
                        onClick={onPlayPause}
                        className="w-12 h-12 bg-indigo-500 hover:bg-indigo-400 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
                    >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                    <button 
                        onClick={() => onSeek(Math.min(duration, currentTime + 5))}
                        className="text-slate-400 hover:text-white transition-colors p-2"
                        title="+5s"
                    >
                        <SkipForward size={20} />
                    </button>
                </div>

                {/* Speed */}
                <div className="flex items-center justify-end gap-2 w-1/4">
                    <FastForward size={16} className="text-slate-500" />
                    <select 
                        value={playbackRate}
                        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                        className="bg-slate-800 text-slate-300 text-xs rounded-md border border-slate-700 px-2 py-1 outline-none focus:border-indigo-500"
                    >
                        <option value="0.5">0.5x</option>
                        <option value="1">1.0x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2.0x</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default PlayerControls;
