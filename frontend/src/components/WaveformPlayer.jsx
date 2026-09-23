import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';
import { motion } from 'framer-motion';

const WaveformPlayer = forwardRef(({ audioUrl, accentColor = '#00D8FF', onTimeUpdate }, ref) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#444444',
      progressColor: accentColor,
      cursorColor: accentColor,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      normalize: true,
    });

    wavesurferRef.current.load(audioUrl);

    wavesurferRef.current.on('ready', () => {
      setIsReady(true);
    });

    wavesurferRef.current.on('play', () => setIsPlaying(true));
    wavesurferRef.current.on('pause', () => setIsPlaying(false));
    
    if (onTimeUpdate) {
      wavesurferRef.current.on('timeupdate', (currentTime) => {
        onTimeUpdate(currentTime);
      });
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [audioUrl, accentColor]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    seekTo: (timeInSeconds) => {
      if (wavesurferRef.current && isReady) {
        const duration = wavesurferRef.current.getDuration();
        wavesurferRef.current.seekTo(timeInSeconds / duration);
        wavesurferRef.current.play();
      }
    }
  }));

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  if (!audioUrl) return null;

  return (
    <div className="waveform-container">
      <motion.button 
        className="play-button" 
        onClick={handlePlayPause}
        disabled={!isReady}
        whileTap={isReady ? { scale: 0.9 } : {}}
        style={{
          backgroundColor: accentColor,
          opacity: isReady ? 1 : 0.5
        }}
      >
        {isPlaying ? <Pause size={20} color="#121212" /> : <Play size={20} color="#121212" />}
      </motion.button>
      
      <div className="waveform-wrapper" ref={containerRef} />
    </div>
  );
});

WaveformPlayer.displayName = 'WaveformPlayer';

export default WaveformPlayer;
