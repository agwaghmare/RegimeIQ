import React, { useState, useRef, useEffect } from 'react';
import './PodcastPlayer.css';

interface PodcastData {
  audio_base64: string;
  text_summary: string;
  duration_estimate: number;
  generated_at: string;
}

interface PodcastPlayerProps {
  onClose: () => void;
}

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ onClose }) => {
  const [isLoading, setIsLoading]           = useState(true);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [podcastData, setPodcastData]       = useState<PodcastData | null>(null);
  const [currentTime, setCurrentTime]       = useState(0);
  const [duration, setDuration]             = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);

  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const timerRef     = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const textRef      = useRef('');
  const durationRef  = useRef(60);
  const offsetRef    = useRef(0);
  const useTTSRef    = useRef(false);

  // ── Cleanup ──
  const stopAll = () => {
    if (audioRef.current) { 
      audioRef.current.pause(); 
      audioRef.current.src = ''; 
    }
    window.speechSynthesis.cancel();
    if (timerRef.current) { 
      clearInterval(timerRef.current); 
      timerRef.current = null; 
    }
    setIsPlaying(false);
  };

  const handleClose = () => { 
    cancelledRef.current = true; 
    stopAll(); 
    onClose(); 
  };

  useEffect(() => {
    cancelledRef.current = false;
    fetchPodcast();
    return stopAll;
  }, []);

  // ── Fetch ──
  const fetchPodcast = async () => {
    try {
      cancelledRef.current = false;
      setIsLoading(true);
      setError(null);
      setCurrentTime(0);
      offsetRef.current = 0;

      const res = await fetch('/podcast');
      if (cancelledRef.current) return;

      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: 'Server error' }));
        throw new Error(e.detail || 'Failed to generate podcast');
      }

      const data: PodcastData = await res.json();
      if (cancelledRef.current) return;

      textRef.current     = data.text_summary;
      durationRef.current = data.duration_estimate || 60;
      setPodcastData(data);
      setDuration(data.duration_estimate || 60);

      // ✅ FIXED: Removed the validation that was breaking it
      // If audio_base64 is empty, use browser TTS
      if (data.audio_base64 && data.audio_base64.trim() !== '') {
        // Use Voxtral audio
        useTTSRef.current = false;
        const blob  = base64ToBlob(data.audio_base64, 'audio/mpeg');
        const url   = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onloadedmetadata = () => setDuration(audio.duration || data.duration_estimate || 60);
        audio.ontimeupdate     = () => setCurrentTime(audio.currentTime);
        audio.onended          = () => { setIsPlaying(false); setCurrentTime(audio.duration); };
        audio.onerror          = () => setIsPlaying(false);
        audioRef.current = audio;
      } else {
        // Use browser TTS
        useTTSRef.current = true;
      }

      setIsLoading(false);

    } catch (err) {
      if (cancelledRef.current) return;
      console.error('Podcast fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load podcast');
      setIsLoading(false);
    }
  };

  const base64ToBlob = (b64: string, mime: string): Blob => {
    const bytes = atob(b64);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  // ── Browser TTS helpers ──
  const startTTSTimer = (offset: number, total: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      setCurrentTime(Math.min(offset + (Date.now() - startedAt) / 1000, total));
    }, 300);
  };

  const speakTTS = (offset = 0) => {
    window.speechSynthesis.cancel();
    if (timerRef.current) { 
      clearInterval(timerRef.current); 
      timerRef.current = null; 
    }

    const utt    = new SpeechSynthesisUtterance(textRef.current);
    const voices = window.speechSynthesis.getVoices();
    const voice  =
      voices.find(v => v.name === 'Google UK English Male') ||
      voices.find(v => v.name.includes('Microsoft David'))  ||
      voices.find(v => v.lang === 'en-GB')                  ||
      voices.find(v => v.lang === 'en-US')                  ||
      voices[0];
    if (voice) utt.voice = voice;
    utt.rate   = 0.93;
    utt.pitch  = 0.95;

    utt.onstart = () => { 
      setIsPlaying(true); 
      startTTSTimer(offset, durationRef.current); 
    };
    utt.onend   = () => { 
      setIsPlaying(false); 
      if (timerRef.current) clearInterval(timerRef.current); 
    };
    utt.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      setIsPlaying(false);
    };

    setTimeout(() => window.speechSynthesis.speak(utt), 100);
  };

  // ── Controls ──
  const togglePlayPause = () => {
    if (!podcastData) return;

    if (useTTSRef.current) {
      // Browser TTS
      if (isPlaying) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
        if (timerRef.current) clearInterval(timerRef.current);
        offsetRef.current = currentTime;
      } else {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsPlaying(true);
          startTTSTimer(currentTime, durationRef.current);
        } else {
          speakTTS(offsetRef.current);
        }
      }
    } else {
      // HTML5 Audio
      const audio = audioRef.current;
      if (!audio) return;
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  };

  const handleReplay = () => {
    setCurrentTime(0);
    offsetRef.current = 0;
    if (useTTSRef.current) {
      speakTTS(0);
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().then(() => setIsPlaying(true));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    
    if (useTTSRef.current) {
      // TTS doesn't support seeking well, just update visual
      setCurrentTime(newTime);
      offsetRef.current = newTime;
    } else {
      // HTML5 Audio supports seeking
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = newTime;
        setCurrentTime(newTime);
      }
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="podcast-player-overlay">
      <div className="podcast-player-container">

        {/* Header */}
        <div className="podcast-header">
          <div className="podcast-title">
            <span className="material-symbols-outlined podcast-mic-icon">podcasts</span>
            <h3>Macro Briefing</h3>
          </div>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="podcast-loading">
            <div className="loading-spinner" />
            <p>Generating your briefing...</p>
            <span className="loading-subtext">Analyzing top market &amp; macro stories</span>
            <button className="cancel-load-btn" onClick={handleClose}>Cancel</button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="podcast-error">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchPodcast}>Retry</button>
          </div>
        )}

        {/* Player */}
        {!isLoading && !error && podcastData && (
          <>
            {!isPlaying && currentTime === 0 && (
              <div className="ready-banner">
                Briefing ready — press <strong>Play</strong> to listen
                {useTTSRef.current && <span className="tts-badge"> · Browser Voice</span>}
              </div>
            )}

            {/* Waveform */}
            <div className="waveform-container">
              <div className={`waveform ${isPlaying ? 'playing' : ''}`}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="waveform-bar" style={{
                    animationDelay: `${i * 0.05}s`,
                    height: `${20 + ((i * 37 + 13) % 60)}%`,
                  }} />
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="progress-container">
              <span className="time-label">{fmt(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="progress-slider"
                disabled={!duration}
              />
              <span className="time-label">{fmt(duration)}</span>
            </div>

            {/* Controls */}
            <div className="controls">
              <button className="control-btn secondary" onClick={handleReplay}>
                <span className="material-symbols-outlined">replay</span>Replay
              </button>
              <button className="control-btn primary" onClick={togglePlayPause}>
                <span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button className="control-btn secondary" onClick={() => setShowTranscript(s => !s)}>
                <span className="material-symbols-outlined">article</span>
                {showTranscript ? 'Hide' : 'Text'}
              </button>
            </div>

            {/* Transcript */}
            {showTranscript && (
              <div className="transcript">
                <div className="transcript-label">Transcript</div>
                <p>{podcastData.text_summary}</p>
              </div>
            )}

            {/* Now Playing */}
            {isPlaying && (
              <div className="now-playing">
                <div className="pulse" />
                <span>Now Playing · Macro Briefing</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};