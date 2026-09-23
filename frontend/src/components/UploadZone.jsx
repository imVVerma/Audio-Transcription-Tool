import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud } from 'lucide-react';

export default function UploadZone({ onFileSelect, disabled }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setIsDragActive(true);
      } else if (e.type === 'dragleave') {
        setIsDragActive(false);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <motion.div
      className={`upload-zone ${isDragActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      animate={{
        scale: isDragActive ? 1.02 : 1,
        borderColor: isDragActive ? '#00D8FF' : '#333333',
        boxShadow: isDragActive ? '0 0 20px rgba(0, 216, 255, 0.2)' : '0 0 0px rgba(0,0,0,0)'
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/mp4"
        onChange={handleChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      
      <UploadCloud 
        size={48} 
        color={isDragActive ? '#00D8FF' : '#888888'} 
        style={{ marginBottom: '1rem', transition: 'color 0.2s' }} 
      />
      
      <h3 style={{ margin: 0, color: '#EEEEEE', fontWeight: 500 }}>
        Drag and drop your audio file
      </h3>
      <p style={{ color: '#888888', marginTop: '0.5rem', fontSize: '0.9rem' }}>
        or click to browse
      </p>
    </motion.div>
  );
}
