import { motion } from 'framer-motion';
import { Check, Loader, UploadCloud, Cpu } from 'lucide-react';

const steps = [
  { id: 'uploading', label: 'Uploading', icon: UploadCloud },
  { id: 'queued', label: 'Queued', icon: Loader },
  { id: 'processing', label: 'Transcribing', icon: Cpu },
  { id: 'completed', label: 'Done', icon: Check }
];

export default function StatusTracker({ status, accentColor = '#00D8FF' }) {
  if (!status) return null;

  // Determine current active step index
  let activeIndex = -1;
  if (status === 'uploading') activeIndex = 0;
  if (status === 'queued') activeIndex = 1;
  if (status === 'processing') activeIndex = 2;
  if (status === 'completed') activeIndex = 3;

  if (activeIndex === -1) return null;

  return (
    <motion.div 
      className="status-tracker"
      animate={status === 'completed' ? {
        boxShadow: [`0px 0px 0px ${accentColor}00`, `0px 0px 40px ${accentColor}80`, `0px 0px 0px ${accentColor}00`]
      } : {}}
      transition={{ duration: 1, ease: "easeOut" }}
      style={{ borderRadius: '8px' }}
    >
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;
        const isFuture = index > activeIndex;

        let color = '#555555';
        if (isActive) color = accentColor;
        if (isPast) color = '#FFFFFF';

        return (
          <div key={step.id} className="status-step-container">
            <div className="status-step">
              <motion.div
                className="status-icon-box"
                animate={{
                  backgroundColor: isActive ? `${accentColor}20` : isPast ? '#333' : 'transparent',
                  borderColor: color,
                  scale: isActive ? 1.1 : 1
                }}
                transition={{ duration: 0.3 }}
              >
                {isActive && step.id !== 'completed' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  >
                    <Icon size={18} color={color} />
                  </motion.div>
                ) : (
                  <Icon size={18} color={color} />
                )}
              </motion.div>
              <span className="status-label" style={{ color: isActive ? '#FFF' : '#888' }}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <motion.div 
                className="status-line"
                animate={{
                  backgroundColor: isPast ? accentColor : '#333'
                }}
              />
            )}
          </div>
        );
      })}
    </motion.div>
  );
}
