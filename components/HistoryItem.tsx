import React from 'react';
import { GeneratedAudio } from '../types';
import { Play, Pause, Download, Trash2, User, Type, Star } from 'lucide-react';

interface HistoryItemProps {
  item: GeneratedAudio;
  isPlaying: boolean;
  isActive: boolean;
  onPlay: (item: GeneratedAudio) => void;
  onPause: () => void;
  onDelete: (id: string) => void;
  onDownload: (item: GeneratedAudio, format: 'wav' | 'mp3') => void;
  onToggleFavorite: (id: string) => void;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({
  item,
  isPlaying,
  isActive,
  onPlay,
  onPause,
  onDelete,
  onDownload,
  onToggleFavorite,
}) => {
  return (
    <div 
      className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
        isActive 
          ? 'bg-slate-800/80 border-indigo-500/50 shadow-lg shadow-indigo-500/10' 
          : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600'
      } ${item.isFavorite ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={() => isActive && isPlaying ? onPause() : onPlay(item)}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isActive && isPlaying
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-700 text-slate-300 group-hover:bg-slate-600'
          }`}
        >
          {isActive && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-1">
             <p className="text-slate-200 font-medium truncate text-sm leading-tight" title={item.text}>
                {item.text}
             </p>
             {item.isFavorite && <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
                <User size={12} /> {item.voice}
            </span>
            {item.style && item.style !== "Normal" && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-700/50 text-indigo-300 border border-indigo-500/20">
                    <Type size={10} /> {item.style}
                </span>
            )}
            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
            <span>{item.duration.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-4">
        <button 
             onClick={() => onToggleFavorite(item.id)}
             className={`p-2 rounded-lg transition-colors ${
                 item.isFavorite 
                 ? 'text-yellow-400 hover:bg-yellow-400/10' 
                 : 'text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/10 opacity-0 group-hover:opacity-100'
             }`}
             title={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
            <Star size={16} fill={item.isFavorite ? "currentColor" : "none"} />
        </button>

        <div className="relative group/dl">
            <button
            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
            title="Download"
            >
            <Download size={16} />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover/dl:flex flex-col bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 min-w-[100px] overflow-hidden">
                <button onClick={() => onDownload(item, 'mp3')} className="px-4 py-2 text-left text-xs hover:bg-indigo-500/20 text-slate-300 hover:text-white">Download MP3</button>
                <button onClick={() => onDownload(item, 'wav')} className="px-4 py-2 text-left text-xs hover:bg-indigo-500/20 text-slate-300 hover:text-white">Download WAV</button>
            </div>
        </div>

        <button
          onClick={() => onDelete(item.id)}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
