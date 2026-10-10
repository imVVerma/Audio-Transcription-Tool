import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';

// Distinct, muted speaker colors that read well on dark backgrounds
const SPEAKER_COLORS = [
  '#5C8A8A', // Teal-ish
  '#8A5C66', // Muted rose
  '#665C8A', // Muted purple
  '#8A7B5C', // Muted gold
];

export default function TranscriptViewer({ transcript, onSeek }) {
  if (!transcript) return null;

  const items = transcript.utterances || [];

  if (items.length === 0) {
    return (
      <div className="transcript-viewer">
        <p style={{ color: '#DDD', lineHeight: 1.6 }}>{transcript.text}</p>
      </div>
    );
  }

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getSpeakerColor = (speaker) => {
    const charCode = speaker.charCodeAt(0) || 65;
    const index = (charCode - 65) % SPEAKER_COLORS.length;
    return SPEAKER_COLORS[index];
  };

  const downloadTxt = () => {
    let content = "";
    if (items.length === 0) {
      content = transcript.text;
    } else {
      content = items.map(u => `Speaker ${u.speaker} [${formatTime(u.start)}]:\n${u.text}`).join('\n\n');
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.txt';
    a.click();
  };

  const downloadMd = () => {
    let content = "# Transcript\n\n";
    if (items.length === 0) {
      content += transcript.text;
    } else {
      content += items.map(u => `**Speaker ${u.speaker}** _[${formatTime(u.start)}]_:\n\n${u.text}`).join('\n\n---\n\n');
    }
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.md';
    a.click();
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    let y = 10;
    doc.setFontSize(16);
    doc.text("Transcript", 10, y);
    y += 10;
    doc.setFontSize(12);
    
    if (items.length === 0) {
        const lines = doc.splitTextToSize(transcript.text, 180);
        doc.text(lines, 10, y);
    } else {
        items.forEach(u => {
            if (y > 270) {
                doc.addPage();
                y = 10;
            }
            doc.setFont("helvetica", "bold");
            doc.text(`Speaker ${u.speaker} [${formatTime(u.start)}]:`, 10, y);
            y += 7;
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(u.text, 180);
            doc.text(lines, 10, y);
            y += (lines.length * 7) + 5;
        });
    }
    doc.save('transcript.pdf');
  };

  return (
    <div className="transcript-viewer">
      <div className="transcript-actions">
        <button className="download-btn" onClick={downloadTxt}>TXT</button>
        <button className="download-btn" onClick={downloadMd}>MD</button>
        <button className="download-btn" onClick={downloadPdf}>PDF</button>
      </div>
      
      {items.map((utterance, index) => {
        const color = getSpeakerColor(utterance.speaker);
        
        return (
          <motion.div 
            key={`${utterance.start}-${index}`}
            className="transcript-line"
            onClick={() => onSeek && onSeek(utterance.start / 1000)}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.4 }}
            whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="transcript-metadata">
              <span className="speaker-chip" style={{ color: color, borderColor: color }}>
                Speaker {utterance.speaker}
              </span>
              <span className="timestamp">{formatTime(utterance.start)}</span>
            </div>
            <p className="transcript-text">{utterance.text}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
