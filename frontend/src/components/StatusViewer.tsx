import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Pause, Play, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { StatusItem, useStatus } from '../contexts/StatusContext';
import { useTheme } from '../contexts/ThemeContext';

interface StatusViewerProps {
  onClose: () => void;
}

export default function StatusViewer({ onClose }: StatusViewerProps) {
  const { viewer, closeStatusViewer, nextStatus, prevStatus, pauseStatus, resumeStatus, deleteStatus } = useStatus();
  const { theme } = useTheme();
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showControls, setShowControls] = useState(true);

  const { statuses, currentIndex, isPaused, isVisible } = viewer;
  const currentStatus = statuses[currentIndex];

  useEffect(() => {
    if (!isVisible) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStatusViewer();
      if (e.key === 'ArrowRight') nextStatus();
      if (e.key === 'ArrowLeft') prevStatus();
      if (e.key === ' ') {
        e.preventDefault();
        isPaused ? resumeStatus() : pauseStatus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible, closeStatusViewer, nextStatus, prevStatus, isPaused, pauseStatus, resumeStatus]);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const deltaX = e.touches[0].clientX - touchStart.x;
    setSwipeOffset(deltaX);
  };

  const handleTouchEnd = () => {
    if (!touchStart) return;
    
    if (Math.abs(swipeOffset) > 50) {
      if (swipeOffset > 0 && currentIndex > 0) {
        prevStatus();
      } else if (swipeOffset < 0 && currentIndex < statuses.length - 1) {
        nextStatus();
      }
    }
    setSwipeOffset(0);
    setTouchStart(null);
  };

  const handleTap = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (x < rect.width / 3) {
      prevStatus();
    } else if (x > (rect.width / 3) * 2) {
      nextStatus();
    } else {
      isPaused ? resumeStatus() : pauseStatus();
    }
  };

  const handleDelete = async () => {
    if (!currentStatus) return;
    if (confirm('Delete this status?')) {
      await deleteStatus(currentStatus._id);
      nextStatus();
    }
  };

  if (!isVisible || !currentStatus) return null;

  const renderStatusContent = () => {
    switch (currentStatus.type) {
      case 'image':
        return (
          <img
            src={currentStatus.mediaUrl}
            alt="Status"
            className="w-full h-full object-contain"
          />
        );
      case 'video':
        return (
          <video
            src={currentStatus.mediaUrl}
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
          />
        );
      case 'contact':
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-32 h-32 rounded-full bg-brand-primary/20 flex items-center justify-center mb-6">
              <span className="text-6xl">👤</span>
            </div>
            <h2 className="text-3xl font-bold text-text-primary mb-2">
              {currentStatus.contactInfo?.name}
            </h2>
            <p className="text-xl text-text-secondary">
              {currentStatus.contactInfo?.phone}
            </p>
          </div>
        );
      case 'text':
      default:
        return (
          <div
            className="w-full h-full flex items-center justify-center p-8 text-center"
            style={{ backgroundColor: currentStatus.backgroundColor || '#00bfa5' }}
          >
            <p className="text-4xl font-bold text-white break-words">
              {currentStatus.content}
            </p>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={handleTap}
        >
          <div className="absolute top-0 left-0 right-0 z-10 p-4">
            <div className="flex items-center gap-2 mb-4">
              {statuses.map((_, idx) => (
                <div
                  key={idx}
                  className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-100"
                    style={{
                      width: idx === currentIndex ? `${viewer.progress}%` : idx < currentIndex ? '100%' : '0%'
                    }}
                  />
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={currentStatus.user.avatar}
                  alt={currentStatus.user.username}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <p className="text-white font-semibold">
                    {currentStatus.user.fullName || currentStatus.user.username}
                  </p>
                  <p className="text-white/70 text-sm">
                    {new Date(currentStatus.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    isPaused ? resumeStatus() : pauseStatus();
                  }}
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                >
                  {isPaused ? <Play size={20} /> : <Pause size={20} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeStatusViewer();
                  }}
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          <motion.div
            className="w-full h-full max-w-md relative overflow-hidden"
            style={{ x: swipeOffset }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {renderStatusContent()}
          </motion.div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              prevStatus();
            }}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextStatus();
            }}
            disabled={currentIndex === statuses.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-full hover:bg-white/10 transition-colors"
          >
            <ChevronRight size={24} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="absolute bottom-4 right-4 p-3 text-white bg-red-500/80 hover:bg-red-500 rounded-full transition-colors"
          >
            <Trash2 size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}