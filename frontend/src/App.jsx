import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './App.css';
import UploadZone from './components/UploadZone';
import WaveformPlayer from './components/WaveformPlayer';
import StatusTracker from './components/StatusTracker';
import TranscriptViewer from './components/TranscriptViewer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function App() {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcript, setTranscript] = useState(null);
  const [error, setError] = useState(null);
  
  const waveformRef = useRef(null);

  // Poll for job status whenever we have a jobId but the status isn't terminal
  useEffect(() => {
    let intervalId;

    if (jobId && status !== 'completed' && status !== 'error') {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/transcribe/${jobId}`);
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
    
    setUploadProgress(0);
    setError(null);
    setTranscript(null);
    setJobId(null);
    setStatus('uploading');

    const formData = new FormData();
    formData.append('file', selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/transcribe`, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        setJobId(data.job_id);
        setStatus(data.status);
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          setError(errData.detail || 'Submission failed');
        } catch {
          setError(`Submission failed with status ${xhr.status}`);
        }
        setStatus('error');
      }
    };

    xhr.onerror = () => {
      setError('Network error occurred during upload');
      setStatus('error');
    };

    xhr.send(formData);
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
                  <StatusTracker status={status} uploadProgress={uploadProgress} accentColor="#00D8FF" />
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
