import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  color?: string;
  mode: 'spectrum' | 'waveform';
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying, color = '#6366f1', mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount; // 128 if fftSize is 256
    const dataArray = new Uint8Array(bufferLength);
    // For waveform, we might want a larger buffer if possible, but fftSize determines bin count.
    // Time domain data size matches fftSize (256).
    const timeDomainArray = new Uint8Array(analyser.fftSize);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (mode === 'spectrum') {
          analyser.getByteFrequencyData(dataArray);

          const barWidth = (width / bufferLength) * 2.5;
          let barHeight;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height;

            // Gradient
            const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, '#a5b4fc'); // lighter indigo

            ctx.fillStyle = gradient;
            
            // Rounded top bars
            ctx.beginPath();
            ctx.roundRect(x, height - barHeight, barWidth, barHeight, 2);
            ctx.fill();

            x += barWidth + 1;
          }
      } else {
          // Waveform Mode
          analyser.getByteTimeDomainData(timeDomainArray);
          
          ctx.lineWidth = 2;
          ctx.strokeStyle = color;
          ctx.beginPath();

          const sliceWidth = width / analyser.fftSize;
          let x = 0;

          for (let i = 0; i < analyser.fftSize; i++) {
            const v = timeDomainArray[i] / 128.0; // 0..2 (1 is center)
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }
          
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
      }
    };

    if (isPlaying) {
      draw();
    } else {
        // Clear canvas if paused/stopped
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (mode === 'spectrum') {
            ctx.fillStyle = '#94a3b8'; // slate-400
            ctx.fillRect(0, canvas.height - 2, canvas.width, 2);
        } else {
            ctx.beginPath();
            ctx.strokeStyle = '#94a3b8';
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        }
        
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying, color, mode]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={100} 
      className="w-full h-24 rounded-lg bg-slate-50 dark:bg-slate-900/50"
    />
  );
};

export default Visualizer;
