import { useState, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Image, Video, Type, User, Send, Palette } from 'lucide-react';
import { useStatus, StatusType } from '../contexts/StatusContext';
import { useTheme } from '../contexts/ThemeContext';

interface CreateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BACKGROUND_COLORS = [
  '#00bfa5', '#3498db', '#9b59b6', '#e74c3c', '#e67e22',
  '#2ecc71', '#1abc9c', '#f1c40f', '#e91e63', '#03a9f4'
];

export default function CreateStatusModal({ isOpen, onClose }: CreateStatusModalProps) {
  const { createStatus } = useStatus();
  const { theme } = useTheme();
  
  const [statusType, setStatusType] = useState<StatusType>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(BACKGROUND_COLORS[0]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setStatusType('text');
    setTextContent('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedColor(BACKGROUND_COLORS[0]);
    setContactName('');
    setContactPhone('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isValidType = statusType === 'image' ? file.type.startsWith('image/') : file.type.startsWith('video/');
    if (!isValidType) {
      alert(`Please select a valid ${statusType} file`);
      return;
    }

    const maxSize = statusType === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File too large. Maximum size is ${statusType === 'image' ? '10MB' : '50MB'}`);
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      let mediaData: string | undefined;
      let mediaType: string | undefined;

      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        mediaData = base64;
        mediaType = selectedFile.type;
      }

      await createStatus({
        type: statusType,
        content: statusType === 'text' ? textContent : undefined,
        mediaData,
        mediaType,
        backgroundColor: statusType === 'text' ? selectedColor : undefined,
        contactInfo: statusType === 'contact' ? {
          name: contactName,
          phone: contactPhone
        } : undefined
      });

      handleClose();
    } catch (error) {
      console.error('Error creating status:', error);
      alert('Failed to create status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const renderContent = () => {
    switch (statusType) {
      case 'text':
        return (
          <div className="flex-1 flex flex-col">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Type a status..."
              className="flex-1 bg-transparent border-none outline-none resize-none text-2xl text-center text-white placeholder:white/50"
              style={{ backgroundColor: selectedColor }}
            />
            <div className="p-4">
              <p className="text-sm text-text-secondary mb-2">Background color</p>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      selectedColor === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case 'image':
        return previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 text-text-secondary"
            >
              <Image size={48} />
              <span>Click to select image</span>
            </button>
          </div>
        );

      case 'video':
        return previewUrl ? (
          <video src={previewUrl} className="w-full h-full object-contain" autoPlay muted />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 text-text-secondary"
            >
              <Video size={48} />
              <span>Click to select video</span>
            </button>
          </div>
        );

      case 'contact':
        return (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact name"
              className="w-full bg-header-bg border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-secondary"
            />
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full bg-header-bg border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-secondary"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-sidebar-bg rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-primary">Create Status</h2>
              <button
                onClick={handleClose}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-header-bg rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-2 p-2 border-b border-border">
              {[
                { type: 'text' as StatusType, icon: Type, label: 'Text' },
                { type: 'image' as StatusType, icon: Image, label: 'Image' },
                { type: 'video' as StatusType, icon: Video, label: 'Video' },
                { type: 'contact' as StatusType, icon: User, label: 'Contact' }
              ].map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  onClick={() => setStatusType(type)}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    statusType === type
                      ? 'bg-brand-primary text-white'
                      : 'bg-header-bg text-text-secondary hover:bg-input-bg'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-[300px] max-h-[50vh] overflow-hidden">
              {renderContent()}
            </div>

            <div className="p-4 border-t border-border">
              <input
                ref={fileInputRef}
                type="file"
                accept={statusType === 'image' ? 'image/*' : statusType === 'video' ? 'video/*' : '*/*'}
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  (statusType === 'text' && !textContent.trim()) ||
                  ((statusType === 'image' || statusType === 'video') && !selectedFile) ||
                  (statusType === 'contact' && (!contactName.trim() || !contactPhone.trim()))
                }
                className="w-full py-3 bg-brand-primary text-white rounded-lg font-semibold hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Sending...' : 'Send Status'}
                <Send size={18} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}