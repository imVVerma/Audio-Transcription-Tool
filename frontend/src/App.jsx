import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './App.css';
import UploadZone from './components/UploadZone';
import WaveformPlayer from './components/WaveformPlayer';
import StatusTracker from './components/StatusTracker';
import TranscriptViewer from './components/TranscriptViewer';

function App() {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [error, setError] = useState(null);
  
  const waveformRef = useRef(null);

  // Poll for job status whenever we have a jobId but the status isn't terminal
  useEffect(() => {
    let intervalId;

    if (jobId && status !== 'completed' && status !== 'error') {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8000/transcribe/${jobId}`);
          if (!res.ok) {
            throw new Error(`Error fetching status: ${res.statusText}`);
          }
          
          const data = await res.json();
          setStatus(data.status);
          
          if (data.status === 'completed') {
            setTranscript(data.transcript);
          } else if (data.status === 'error') {
            setError(data.error?.error || "Transcription failed");
          }
        } catch (err) {
          console.error(err);
        }
      }, 3000); 
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, status]);


  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    
    // Create a local URL for the waveform player
    const url = URL.createObjectURL(selectedFile);
    setFileUrl(url);
    
    // Reset state
    setError(null);
    setTranscript(null);
    setJobId(null);
    setStatus('uploading');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://127.0.0.1:8000/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Submission failed');
      }

      const data = await response.json();
      setJobId(data.job_id);
      setStatus(data.status); 
      // useEffect takes over polling
      
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };
  
  const handleSeek = (timeInSeconds) => {
    if (waveformRef.current) {
      waveformRef.current.seekTo(timeInSeconds);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Studio<span className="accent">Scribe</span></h1>
        <p className="subtitle">AI-Powered Transcription</p>
      </header>
      
      <main className="app-main">
        {!file && (
          <UploadZone 
            onFileSelect={handleFileSelect} 
            disabled={status !== null && status !== 'error' && status !== 'completed'} 
          />
        )}

        {file && (
          <div className="workspace">
            <div className="player-panel panel">
              <div className="panel-header">
                <h3>{file.name}</h3>
              </div>
              
              <WaveformPlayer 
                ref={waveformRef} 
                audioUrl={fileUrl} 
                accentColor="#00D8FF"
              />
              
              {status !== 'completed' && status !== 'error' && (
                <div className="tracker-wrapper">
                  <StatusTracker status={status} accentColor="#00D8FF" />
                </div>
              )}
              
              {error && (
                <div className="error-message">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </div>

            {transcript && (
              <div className="transcript-panel panel">
                <TranscriptViewer transcript={transcript} onSeek={handleSeek} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
