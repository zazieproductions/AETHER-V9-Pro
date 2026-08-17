import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Volume2, Radio, Sparkles, HelpCircle } from 'lucide-react';
import { audioService } from '../utils/audio';

interface EVPRecorderProps {
  accentColor: string;
}

export const EVPRecorder: React.FC<EVPRecorderProps> = ({ accentColor }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isDemodulating, setIsDemodulating] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null);
  const [demodulateProgress, setDemodulateProgress] = useState(0);
  const [evpTimer, setEvpTimer] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveOffsetRef = useRef(0);

  const ghostMessages = [
    "I'm here...",
    "Get out...",
    "Behind you...",
    "Help me...",
    "Cold...",
    "Don't look back...",
    "It's watching...",
    "Run now..."
  ];

  // Canvas wave animation for recording/static feedback
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = isRecording ? '#ef4444' : isDemodulating ? accentColor : '#4b5563';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      waveOffsetRef.current += isRecording ? 0.3 : 0.05;
      const amp = isRecording ? 30 : playbackActive ? 25 : 5;
      const freq = isRecording ? 0.08 : 0.02;

      for (let x = 0; x < canvas.width; x++) {
        let y = canvas.height / 2;
        if (isRecording) {
          // Volatile soundwave look
          y += Math.sin(x * freq + waveOffsetRef.current) * amp * (0.6 + Math.random() * 0.4);
          y += (Math.random() - 0.5) * 8;
        } else if (playbackActive) {
          // Fuzzy sweep wave with ghost voice fluctuations
          y += Math.sin(x * freq + waveOffsetRef.current) * amp;
          y += Math.cos(x * 0.05 + waveOffsetRef.current * 1.5) * 10;
          y += (Math.random() - 0.5) * 12;
        } else {
          // Low background noise
          y += Math.sin(x * 0.01) * amp;
          y += (Math.random() - 0.5) * 2;
        }

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // UI Overlay
      ctx.fillStyle = `${accentColor}44`;
      ctx.font = '8px monospace';
      if (isRecording) {
        ctx.fillStyle = '#ef4444';
        ctx.fillText("REC_MIC_ACTIVE", 8, 14);
      } else if (isDemodulating) {
        ctx.fillText(`DEMODULATING_SIGNAL: ${demodulateProgress}%`, 8, 14);
      } else if (playbackActive) {
        ctx.fillText("AUDIO_DEMOD_PLAYBACK", 8, 14);
      } else {
        ctx.fillText("STANDBY", 8, 14);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isRecording, isDemodulating, playbackActive, demodulateProgress, accentColor]);

  // Handle EVP Timer
  useEffect(() => {
    if (isRecording) {
      setEvpTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setEvpTimer(prev => {
          if (prev >= 10) {
            handleStopRecording();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const handleStartRecording = () => {
    setIsRecording(true);
    setHasRecording(false);
    setDecryptedMessage(null);
    audioService.setEVPActive(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setHasRecording(true);
    audioService.setEVPActive(false);
    audioService.playDiagnosticBeep(true);
  };

  const handleDemodulate = () => {
    if (!hasRecording || isDemodulating) return;

    setIsDemodulating(true);
    setDemodulateProgress(0);
    audioService.setEVPActive(true);

    const interval = setInterval(() => {
      setDemodulateProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsDemodulating(false);
          audioService.setEVPActive(false);
          audioService.playDiagnosticBeep(true);
          
          // Randomly trigger creepy message or nothing
          const hasMessage = Math.random() < 0.75;
          if (hasMessage) {
            const randomMsg = ghostMessages[Math.floor(Math.random() * ghostMessages.length)];
            setDecryptedMessage(randomMsg);
            // Play ghost whisper sound effect
            audioService.playHauntingScream();
          } else {
            setDecryptedMessage("NO COHERENT SPECTRUM FOUND [STATIC ONLY]");
          }
          return 100;
        }
        return prev + 10;
      });
    }, 250);
  };

  const playBackEVP = () => {
    if (playbackActive) return;
    setPlaybackActive(true);
    audioService.setEVPActive(true);

    setTimeout(() => {
      setPlaybackActive(false);
      audioService.setEVPActive(false);
    }, 3000);
  };

  return (
    <div className="border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col h-full shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4" style={{ color: accentColor }} />
          <span className="text-xs font-bold tracking-widest text-white uppercase">EVP_DECODER_ARRAY</span>
        </div>
        <span className="text-[9px] text-slate-500 tracking-wider">ELECTRONIC VOICE PHENOMENA</span>
      </div>

      <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
        EVP records radio static and sub-audible frequencies. Use the demodulator to filter white noise and decrypt hidden phonetic vocalizations.
      </p>

      {/* Waveform Screen */}
      <div className="bg-black border border-zinc-900 rounded p-2 relative h-36 mb-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          className="w-full h-full block"
        />
        
        {/* Timer countdown for recording */}
        {isRecording && (
          <div className="absolute top-2 right-2 bg-red-950/80 border border-red-500 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span>REC 0:0{evpTimer} / 0:10</span>
          </div>
        )}
      </div>

      {/* Controls panel */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            disabled={isDemodulating || playbackActive}
            className="border border-red-900/60 bg-red-950/10 hover:bg-red-950/30 text-red-400 py-3 px-2 rounded flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <Mic className="w-5 h-5 animate-pulse" />
            <span className="text-[9px] font-bold tracking-wider uppercase">RECORD EVP</span>
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="border border-red-500 bg-red-500 text-black py-3 px-2 rounded flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer animate-pulse"
          >
            <Square className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wider uppercase">STOP REC</span>
          </button>
        )}

        <button
          onClick={handleDemodulate}
          disabled={!hasRecording || isRecording || isDemodulating || playbackActive}
          className="border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 text-white py-3 px-2 rounded flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          style={{
            borderColor: hasRecording && !isDemodulating ? accentColor : undefined,
            color: hasRecording && !isDemodulating ? '#ffffff' : undefined
          }}
        >
          <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: isDemodulating ? '3s' : '15s' }} />
          <span className="text-[9px] font-bold tracking-wider uppercase">DEMODULATE</span>
        </button>

        <button
          onClick={playBackEVP}
          disabled={!hasRecording || isRecording || isDemodulating || playbackActive}
          className="border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 text-slate-300 py-3 px-2 rounded flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <Play className="w-5 h-5" />
          <span className="text-[9px] font-bold tracking-wider uppercase">PLAYBACK</span>
        </button>
      </div>

      {/* Decryption Message Output Panel */}
      <div className="border border-zinc-900 bg-zinc-900/20 rounded p-3 flex-1 flex flex-col justify-center min-h-[80px]">
        <div className="text-[8px] text-slate-500 uppercase tracking-wider mb-2">DEMODULATED_AUDIO_DECRYPTION</div>
        {isDemodulating ? (
          <div className="space-y-2">
            <div className="flex justify-between text-[9px] text-slate-400">
              <span className="animate-pulse">PARSING SPECTRAL FREQUENCIES...</span>
              <span>{demodulateProgress}%</span>
            </div>
            <div className="h-1 bg-zinc-900 rounded overflow-hidden">
              <div 
                className="h-full transition-all duration-200"
                style={{ width: `${demodulateProgress}%`, backgroundColor: accentColor }}
              ></div>
            </div>
          </div>
        ) : decryptedMessage ? (
          <div className="text-center p-2 rounded bg-black/40 border border-zinc-900">
            <span className="text-[8px] text-red-500 uppercase block mb-1 font-bold tracking-widest animate-pulse">
              ▲ DECRYPTED PHONETIC WAVEFORM ▲
            </span>
            <span 
              className="text-lg md:text-xl font-bold tracking-wider italic animate-[pulse_2s_infinite]"
              style={{ 
                color: decryptedMessage.includes('STATIC') ? '#94a3b8' : accentColor,
                textShadow: decryptedMessage.includes('STATIC') ? 'none' : `0 0 10px ${accentColor}44`
              }}
            >
              "{decryptedMessage}"
            </span>
          </div>
        ) : (
          <div className="text-center text-slate-600 text-[9px] uppercase py-2">
            No audio demodulated. Record static, then hit DEMODULATE.
          </div>
        )}
      </div>
    </div>
  );
};
