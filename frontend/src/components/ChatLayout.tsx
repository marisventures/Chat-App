import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import {
  Search,
  MoreVertical,
  MessageCircle,
  Phone,
  Video,
  Paperclip,
  Smile,
  Mic,
  Send,
  ChevronLeft,
  Check,
  CheckCheck,
  User,
  LogOut,
  Plus,
  X,
  Users as UsersIcon,
  Download,
  Moon,
  Sun,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePresence } from '../contexts/PresenceContext';
import { api, SERVER_URL, getAvatarUrl } from '../services/api';
import { io, Socket } from 'socket.io-client';
import EmojiPicker, { Theme } from 'emoji-picker-react';

interface Chat {
  _id: string;
  users: Array<{
    _id: string;
    username: string;
    fullName?: string;
    avatar: string;
    online?: boolean;
    lastSeen?: string;
  }>;
  chatName?: string;
  isGroupChat: boolean;
  latestMessage?: {
    _id: string;
    content: string;
    sender: { _id: string; username: string };
    createdAt: string;
  };
  updatedAt: string;
  avatar?: string;
}

interface Message {
  _id: string;
  content?: string;
  sender: { _id: string; username: string; fullName?: string; avatar: string };
  chat: string;
  createdAt: string;
  readBy: string[];
  isVoice?: boolean;
  voiceData?: string;
  voiceDuration?: number;
  voiceMimeType?: string;
  isFile?: boolean;
  fileData?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

interface User {
  _id: string;
  username: string;
  fullName?: string;
  avatar: string;
  online?: boolean;
  lastSeen?: string;
}

export default function ChatLayout() {
   const { user, logout, updateUser } = useAuth();
   const { theme, toggleTheme } = useTheme();
   const { users, formatLastSeen, updateUserPresence } = usePresence();
   const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
   const [loadingChats, setLoadingChats] = useState(true);
   const [loadingMessages, setLoadingMessages] = useState(false);
   const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeChatRef = useRef<Chat | null>(null);
    // Persistent per-chat messages cache — switching chats never wipes message history.
    // Uses a ref so reads never trigger re-renders; writes only happen on fresh server data.
    const messagesCacheRef = useRef<Record<string, Message[]>>({});
    const [socket, setSocket] = useState<Socket | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Avatar upload state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

   // New chat modal state
   const [showNewChatModal, setShowNewChatModal] = useState(false);
   const [userSearchQuery, setUserSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState<User[]>([]);
   const [loadingUsers, setLoadingUsers] = useState(false);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingDurationRef = useRef(0);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);

    // File attachment state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   // Fetch chats on mount
   useEffect(() => {
     fetchChats();
   }, []);

// Connect to socket and setup presence tracking
    useEffect(() => {
      if (user) {
        const token = localStorage.getItem('token');
        const newSocket = io(SERVER_URL, {
          auth: { token },
          transports: ['websocket', 'polling']
        });
        setSocket(newSocket);

newSocket.on('connect', () => {
          console.log('Socket connected');
        });

        // Handle ping-pong for heartbeat
        newSocket.on('ping', () => {
          newSocket.emit('heartbeat');
        });

       newSocket.on('receive-message', (message: Message) => {
         // Normalize sender _id to string
         const normalizedMessage = {
           ...message,
           sender: {
             ...message.sender,
             _id: String(message.sender._id)
           },
           readBy: message.readBy || []
         };

         const isCurrentUserSender = String(normalizedMessage.sender._id) === String(user?.id);
         const isActiveChat = normalizedMessage.chat === activeChatRef.current?._id;
         const currentUserId = String(user?.id);

         // Automatically mark as read if viewing the chat and add to readBy locally
         if (!isCurrentUserSender && isActiveChat) {
           const token = localStorage.getItem('token');
           if (!normalizedMessage.readBy.map(String).includes(currentUserId)) {
             api.put(`/messages/${normalizedMessage._id}/status`, {}, token).catch(() => {});
             normalizedMessage.readBy = [...normalizedMessage.readBy, currentUserId];
           }
         }

         // Show notification if message from other user and tab is not focused
         if (!isCurrentUserSender && !isActiveChat) {
          const senderName = normalizedMessage.sender.fullName || normalizedMessage.sender.username;
          const notificationBody = normalizedMessage.content 
            ? normalizedMessage.content
            : normalizedMessage.isVoice
              ? 'Voice message'
              : normalizedMessage.isFile
                ? `File: ${normalizedMessage.fileName || 'Attachment'}`
                : 'New message';
          showDesktopNotification(`New message from ${senderName}`, notificationBody, getAvatarUrl(normalizedMessage.sender.avatar));
        }

        // If this message is for the active chat, add it to messages
        if (normalizedMessage.chat === activeChatRef.current?._id) {
          setMessages(prev => [...prev, normalizedMessage]);
        }
        // Always refresh chats list to update latest message previews
        fetchChats();
      });

      return () => newSocket.close();
    }
  }, [user]);

   // Cleanup recording resources and file preview on unmount
   useEffect(() => {
     return () => {
       // Voice recording cleanup
       if (mediaRecorderRef.current && isRecording) {
         mediaRecorderRef.current.stop();
       }
       if (recordingTimerRef.current) {
         clearInterval(recordingTimerRef.current);
       }
       if (recordedAudioUrl) {
         URL.revokeObjectURL(recordedAudioUrl);
       }
       // File preview cleanup
       if (filePreviewUrl) {
         URL.revokeObjectURL(filePreviewUrl);
       }
     };
   }, [isRecording, recordedAudioUrl, filePreviewUrl]);

   // Close emoji picker when clicking outside
   useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
       if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
         setShowEmojiPicker(false);
       }
     };

     if (showEmojiPicker) {
       document.addEventListener('mousedown', handleClickOutside);
     }

     return () => {
       document.removeEventListener('mousedown', handleClickOutside);
     };
   }, [showEmojiPicker]);

   const handleEmojiPickerToggle = () => {
     setShowEmojiPicker(prev => !prev);
   };

  // Load messages when active chat changes
  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat._id);
    }
  }, [activeChat]);

  // Keep activeChat ref updated for socket handler
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery.length >= 2) {
        searchUsers(userSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  // Show desktop notification
    const showDesktopNotification = (title: string, body: string, icon?: string) => {
      console.log('Attempting to show notification:', { title, body, permission: Notification.permission, hidden: document.hidden });
      
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.log('Notifications not supported in this browser');
        return;
      }
      
      // Request permission if not granted
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
          if (permission === 'granted') {
            showNotificationNow(title, body, icon);
          }
        });
        return;
      }
      
      // Show notification if we have permission
      if (Notification.permission === 'granted') {
        showNotificationNow(title, body, icon);
      } else {
        console.log('Notification permission denied');
      }
    };
    
    const showNotificationNow = (title: string, body: string, icon?: string) => {
      try {
        // Ensure body is not empty
        const notificationBody = body || 'New message';
        
        // Use a valid icon path - fallback to a data URL if needed
        const notificationIcon = icon || (user ? getAvatarUrl(user.avatar) : undefined) || 
          (typeof window !== 'undefined' && window.location.origin) + '/favicon.ico' ||
          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgeT0iMTYiIHI9IjE2IiBmaWxsPSIjMzBGRkZGIi8+PHBhdGggZmlsbD0iI0ZGRiIgZD0iTTExIDExaDZ2NkgxMnoiLz48L3N2Zz4=';
        
        // Use a random tag to prevent notifications from replacing each other
        const notificationTag = `chat-message-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('Showing notification with:', {
          title,
          body: notificationBody,
          icon: notificationIcon,
          tag: notificationTag
        });
        
new Notification(title, {
           body: notificationBody,
           icon: notificationIcon,
           badge: notificationIcon,
           tag: notificationTag
         } as NotificationOptions);
        
        console.log('Notification shown successfully');
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    };

   const handleDownloadFile = (fileData: string, fileName: string, fileType: string) => {
     try {
       // Create data URL from base64 data
       const dataUrl = fileData.startsWith('data:') ? fileData : `data:${fileType};base64,${fileData}`;

       // Create a temporary anchor element
       const link = document.createElement('a');
       link.href = dataUrl;
       link.download = fileName;
       link.style.display = 'none';

       // Append to document, click, and remove
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
     } catch (error) {
       console.error('Error downloading file:', error);
       alert('Failed to download file. Please try again.');
     }
   };

   const handleEmojiSelect = (emojiData: { emoji: string }, event: MouseEvent) => {
     event.preventDefault();
     event.stopPropagation();
     setInputText(prev => prev + emojiData.emoji);
   };

  const fetchChats = async () => {
    try {
      const data = await api.get('/chat', localStorage.getItem('token'));
      const normalizedData = (data as any[]).map((chat: any) => ({
        ...chat,
        users: chat.users.map((u: any) => ({
          ...u,
          _id: String(u._id)
        }))
      }));
      setChats(normalizedData);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

   const fetchMessages = async (chatId: string) => {
     // Show cached messages immediately on chat switch — zero-latency UX
     const cached = messagesCacheRef.current[chatId];
     if (cached) {
       setMessages(cached);
     }
     setLoadingMessages(true);
     try {
       const data = await api.get(`/messages/${chatId}`, localStorage.getItem('token'));
       const normalizedData = (data as any[]).map((msg: any) => ({
         ...msg,
         sender: {
           ...msg.sender,
           _id: String(msg.sender._id)
         }
       }));

       // Mark messages as read after loading them
       const token = localStorage.getItem('token');
       const currentUserId = String(user?.id);
       const unreadMessages = normalizedData.filter((msg: any) =>
         String(msg.sender._id) !== currentUserId && !(msg.readBy || []).map(String).includes(currentUserId)
       );

       // Mark all unread messages as read in parallel
       if (unreadMessages.length > 0) {
         await Promise.allSettled(
           unreadMessages.map((msg: any) =>
             api.put(`/messages/${msg._id}/status`, {}, token)
           )
         );
         // Update local state with read receipts - add current user to readBy arrays
         const updatedData = normalizedData.map((msg: any) => {
           const readByArray = msg.readBy || [];
           if (String(msg.sender._id) !== currentUserId && !readByArray.map(String).includes(currentUserId)) {
             return { ...msg, readBy: [...readByArray, currentUserId] };
           }
           return msg;
         });
         // Cache before state update
         messagesCacheRef.current = { ...messagesCacheRef.current, [chatId]: updatedData };
         setMessages(updatedData);
         return;
       }

       // Cache before state update
       messagesCacheRef.current = { ...messagesCacheRef.current, [chatId]: normalizedData };
       setMessages(normalizedData);
     } catch (error) {
       console.error('Error fetching messages:', error);
       // On error, keep whatever is already displayed (cached messages if any)
     } finally {
       setLoadingMessages(false);
     }
   };

   const handleSendMessage = async () => {
     if (!inputText.trim() || !activeChat) return;

     const tempMessage: Message = {
       _id: `temp-${Date.now()}`,
       content: inputText,
       sender: { _id: user!.id, username: user!.username, fullName: user!.fullName, avatar: user!.avatar },
       chat: activeChat._id,
       createdAt: new Date().toISOString(),
       readBy: [user!.id]
     };

     setMessages(prev => [...prev, tempMessage]);
     const messageContent = inputText;
     setInputText('');

     try {
       await api.post('/messages', { content: messageContent, chatId: activeChat._id }, localStorage.getItem('token'));
       fetchChats();
     } catch (error) {
       console.error('Error sending message:', error);
       setMessages(prev => prev.filter(m => m._id !== tempMessage._id));
     }
   };

    const startRecording = async () => {
      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Audio recording is not supported in this browser. Please use Chrome, Firefox, or Safari.');
        return;
      }

      try {
        // Request microphone permission with better constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
            channelCount: 1
          }
        });

        // Determine supported mime type
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }

        let mediaRecorder: MediaRecorder;

        try {
          mediaRecorder = new MediaRecorder(stream, { mimeType });
        } catch (e) {
          console.warn('MediaRecorder with mimeType failed, using default');
          mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          try {
            const effectiveMimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMimeType });

            if (audioBlob.size === 0) {
              console.error('Recording blob is empty');
              alert('Recording failed - no audio captured. Please try again.');
              return;
            }

            // Convert blob to base64 (without data URL prefix for backend storage)
            const base64Audio = await blobToBase64(audioBlob);

            setRecordedAudioUrl(`data:${effectiveMimeType};base64,${base64Audio}`);

            // Auto-send voice message
            if (activeChat) {
              sendVoiceMessage(base64Audio, recordingDurationRef.current, effectiveMimeType);
            } else {
              setRecordedAudioUrl(null);
            }

            // Stop all tracks to release microphone
            stream.getTracks().forEach(track => track.stop());
          } catch (err) {
            console.error('Error processing recording:', err);
            alert('Error processing recording. Please try again.');
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
          alert('Error while recording. Please try again.');
          stopRecording();
        };

        // Start recording
        mediaRecorder.start();

        // Request data every second to ensure chunks are captured
        const dataRequestInterval = setInterval(() => {
          if (mediaRecorder.state === 'recording') {
            try {
              mediaRecorder.requestData();
            } catch (e) {
              // Ignore
            }
          }
        }, 1000);

        setIsRecording(true);
        setRecordingDuration(0);
        recordingDurationRef.current = 0;

         // Start timer
         recordingTimerRef.current = setInterval(() => {
           setRecordingDuration(prev => {
             const newVal = prev + 1;
             recordingDurationRef.current = newVal;
             return newVal;
           });
         }, 1000);
      } catch (error: any) {
        console.error('Error accessing microphone:', error);

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          alert('Microphone access denied. Please allow microphone access in your browser settings to send voice messages.');
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found. Please connect a microphone and try again.');
        } else {
          alert('Could not access microphone. Error: ' + error.message);
        }
      }
    };

    // Helper: Convert Blob to base64 string (no data URL prefix)
    const blobToBase64 = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:audio/webm;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    // File attachment functions
    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file size (max 5MB - to stay under MongoDB 16MB document limit with base64 overhead)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('File too large. Maximum size is 5MB.');
        return;
      }

      setSelectedFile(file);

      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        setFilePreviewUrl(preview);
      } else {
        setFilePreviewUrl(null);
      }
    };

    const sendFileMessage = async () => {
      if (!selectedFile || !activeChat) return;

      setIsUploading(true);
      let tempMessageId: string | null = null;

      try {
        // Convert file to base64
        const base64File = await blobToBase64(selectedFile);

        // Create temporary file message for optimistic UI
        const tempMessage: Message = {
          _id: `temp-${Date.now()}`,
          sender: { _id: user!.id, username: user!.username, fullName: user!.fullName, avatar: user!.avatar },
          chat: activeChat._id,
          createdAt: new Date().toISOString(),
          readBy: [user!.id],
          isFile: true,
          fileData: base64File,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size
        };

        tempMessageId = tempMessage._id;
        setMessages(prev => [...prev, tempMessage]);

        // Send to backend
        await api.post('/messages', {
          chatId: activeChat._id,
          isFile: true,
          fileData: base64File,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size
        }, localStorage.getItem('token'));

        fetchChats();

        // Cleanup
        setSelectedFile(null);
        setFilePreviewUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error sending file:', error);
        alert('Failed to send file. Please try again.');
        if (tempMessageId) {
          setMessages(prev => prev.filter(m => m._id !== tempMessageId));
        }
        setSelectedFile(null);
        setFilePreviewUrl(null);
      } finally {
        setIsUploading(false);
      }
    };

    const cancelFileAttachment = () => {
      setSelectedFile(null);
      setFilePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

   const formatFileSize = (bytes: number): string => {
     if (bytes < 1024) return bytes + ' B';
     if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
     return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
   };

   const getFileIcon = (fileType: string) => {
     if (fileType.startsWith('image/')) return '🖼️';
     if (fileType.startsWith('video/')) return '🎬';
     if (fileType.startsWith('audio/')) return '🎵';
     if (fileType.includes('pdf')) return '📄';
     if (fileType.includes('word') || fileType.includes('document')) return '📝';
     if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
     if (fileType.includes('zip') || fileType.includes('compressed')) return '🗜️';
     return '📎';
   };

   // Avatar upload handler
   const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file) return;

     // Validate file type
     const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
     if (!allowedTypes.includes(file.type)) {
       alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
       return;
     }

     // Validate file size (max 5MB)
     const maxSize = 5 * 1024 * 1024; // 5MB
     if (file.size > maxSize) {
       alert('File too large. Maximum size is 5MB.');
       return;
     }

     setAvatarUploading(true);

     try {
       const formData = new FormData();
       formData.append('avatar', file);

       const response = await fetch(`${SERVER_URL}/api/users/avatar`, {
         method: 'PUT',
         headers: {
           'Authorization': `Bearer ${localStorage.getItem('token')}`
         },
         body: formData
       });

       if (!response.ok) {
         throw new Error('Failed to upload avatar');
       }

       const data = await response.json();

       // Update user in AuthContext
       updateUser({ avatar: data.avatar });
       
     } catch (error) {
       console.error('Error uploading avatar:', error);
       alert('Failed to upload avatar. Please try again.');
     } finally {
       setAvatarUploading(false);
       // Reset input so same file can be selected again
       if (avatarInputRef.current) {
         avatarInputRef.current.value = '';
       }
     }
   };

   const stopRecording = () => {
     if (mediaRecorderRef.current && isRecording) {
       mediaRecorderRef.current.stop();
       setIsRecording(false);
       if (recordingTimerRef.current) {
         clearInterval(recordingTimerRef.current);
       }
     }
   };

   const cancelRecording = () => {
     stopRecording();
     setRecordedAudioUrl(null);
     setRecordedAudioBlob(null);
     setRecordingDuration(0);
   };

    const sendVoiceMessage = async (voiceData: string, duration: number, mimeType: string = 'audio/webm') => {
      if (!activeChat || !voiceData) return;

      // Create temporary voice message for optimistic UI
      const tempMessage: Message = {
        _id: `temp-${Date.now()}`,
        sender: { _id: user!.id, username: user!.username, fullName: user!.fullName, avatar: user!.avatar },
        chat: activeChat._id,
        createdAt: new Date().toISOString(),
        readBy: [user!.id],
        isVoice: true,
        voiceData: `data:${mimeType};base64,${voiceData}`,
        voiceDuration: duration,
        voiceMimeType: mimeType
      };

      setMessages(prev => [...prev, tempMessage]);

      try {
        await api.post('/messages', {
          chatId: activeChat._id,
          isVoice: true,
          voiceData: voiceData,
          voiceDuration: duration,
          voiceMimeType: mimeType
        }, localStorage.getItem('token'));
        fetchChats();
      } catch (error) {
        console.error('Error sending voice message:', error);
        setMessages(prev => prev.filter(m => m._id !== tempMessage._id));
      } finally {
        setRecordedAudioUrl(null);
        setRecordedAudioBlob(null);
        setRecordingDuration(0);
      }
    };

   const discardRecording = () => {
     cancelRecording();
   };

  const startNewChat = async (selectedUser: User) => {
    try {
      const chat = await api.post('/chat/accessChat', { userId: selectedUser._id }, localStorage.getItem('token'));
      setActiveChat(chat);
      setShowNewChatModal(false);
      setUserSearchQuery('');
      setSearchResults([]);
      fetchChats();
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoadingUsers(true);
    try {
      const results = await api.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`, localStorage.getItem('token'));
      const normalizedResults = (results as any[]).map((u: any) => ({
        ...u,
        _id: String(u._id)
      }));
      setSearchResults(normalizedResults);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const getChatDisplayName = (chat: Chat) => {
    if (chat.isGroupChat) {
      return chat.chatName || 'Group Chat';
    }
    const other = chat.users.find(u => String(u._id) !== String(user?.id));
    return other?.username || other?.fullName || 'Unknown User';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.isGroupChat && chat.avatar) {
      return chat.avatar;
    }
    const other = chat.users.find(u => String(u._id) !== String(user?.id));
    return other?.avatar || '';
  };

   const getOtherUser = (chat: Chat) => {
     return chat.users.find(u => String(u._id) !== String(user?.id)) || chat.users[0];
    };

  // ── Mobile panel transition variants ───────────────────────────────────
  const sidebarVariants = {
    enter:  { x: '-110%', opacity: 0 },
    center: { x: '0%',    opacity: 1 },
    exit:   { x: '-110%', opacity: 0 },
  };
  const chatVariants = {
    enter:  { x: '110%',  opacity: 0 },
    center: { x: '0%',    opacity: 1 },
    exit:   { x: '110%',  opacity: 0 },
  };

   return (
     <div className="chat-container">
       {/* ══════════════════════ Sidebar Panel ══════════════════════ */}
       <AnimatePresence initial={false}>
         <motion.div
           key="sidebar"
           initial="enter"
           animate={!activeChat ? 'center' : 'exit'}
           variants={sidebarVariants}
           transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.9 }}
           className={`chat-sidebar ${activeChat ? 'hidden md:flex' : 'flex'}`}
         >
        {/* Sidebar Header */}
        <div className="p-4 bg-header-bg flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div 
              className={`relative w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center cursor-pointer group ${avatarUploading ? 'opacity-50 pointer-events-none' : ''}`} 
              onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            >
              {user?.avatar ? (
                <img src={getAvatarUrl(user.avatar)} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <User className="text-text-secondary" size={20} />
              )}
              {avatarUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="text-white" size={18} />
                </div>
              )}
            </div>
            <span className="font-semibold text-text-primary text-sm">{user?.fullName || user?.username}</span>
          </div>
          <div className="flex gap-5 text-text-secondary">
            <UsersIcon
              size={22}
              className="cursor-pointer hover:text-brand-primary transition-colors"
              onClick={() => setShowNewChatModal(true)}
              title="New Chat"
            />
            <MoreVertical size={22} className="cursor-pointer hover:text-brand-primary transition-colors" />
            <LogOut
              size={22}
              className="cursor-pointer hover:text-brand-primary transition-colors"
              onClick={logout}
              title="Logout"
            />
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border italic">
          <div className="bg-header-bg flex items-center gap-4 px-4 py-1.5 rounded-lg">
            <Search size={18} className="text-text-secondary" />
            <input
              type="text"
              placeholder="Search or start new chat"
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-text-secondary font-normal not-italic text-text-primary"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="p-4 text-center text-text-secondary">Loading chats...</div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-text-secondary">
              No chats yet.{' '}
              <button
                onClick={() => setShowNewChatModal(true)}
                className="text-brand-primary hover:underline"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            chats
              .filter(chat => getChatDisplayName(chat).toLowerCase().includes(chatSearchQuery.toLowerCase()))
              .map((chat) => {
                const other = getOtherUser(chat);
                return (
                  <div
                    key={chat._id}
                    onClick={() => setActiveChat(chat)}
                    className={`flex items-center gap-4 p-3 cursor-pointer hover:bg-header-bg transition-colors border-b border-border ${activeChat?._id === chat._id ? 'bg-header-bg' : ''}`}
                  >
                      <div className="relative shrink-0">
                        <img
                          src={getAvatarUrl(getChatAvatar(chat))}
                          alt={getChatDisplayName(chat)}
                          className="w-12 h-12 rounded-full object-cover border border-border"
                          referrerPolicy="no-referrer"
                        />
                        {(() => {
                          const other = getOtherUser(chat);
                          const presence = other ? users.get(String(other._id)) : null;
                          const isOnline = presence?.isOnline ?? other?.online ?? false;
                          return isOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-brand-primary border-2 border-sidebar-bg rounded-full"></div>
                          );
                        })()}
                      </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="font-semibold text-text-primary text-[15.5px] truncate">{getChatDisplayName(chat)}</h3>
                        <span className="text-[11px] text-text-secondary">
                          {chat.latestMessage ? new Date(chat.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-text-secondary truncate pr-4">
                            {chat.latestMessage?.content
                              ? chat.latestMessage.content
                              : chat.latestMessage?.isVoice
                                ? `🎤 Voice message ${chat.latestMessage.voiceDuration ? `(${Math.round(chat.latestMessage.voiceDuration)}s)` : ''}`
                              : chat.latestMessage?.isFile
                                ? `📎 ${chat.latestMessage.fileName || 'File'}`
                                : 'No messages yet'}
                          </p>
                        </div>
                    </div>
                  </div>
                );
              })
          )}
         </div>
        </motion.div>
      </AnimatePresence>

       {/* Main Chat View */}
       <AnimatePresence initial={false}>
         <motion.div
           key="chat-main"
           initial="enter"
           animate={activeChat ? 'center' : 'exit'}
           variants={chatVariants}
           transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.9 }}
           className={`chat-main ${activeChat ? 'flex' : 'hidden md:flex'}`}
         >
        {activeChat ? (
          <>
            {/* Main Header */}
            <header className="h-16 px-4 flex items-center justify-between bg-header-bg border-b border-border shrink-0 sticky top-0 z-10 w-full">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-1 -ml-2 text-text-secondary hover:text-brand-primary">
                  <ChevronLeft size={24} />
                </button>
                <img
                  src={getChatAvatar(activeChat)}
                  className="w-10 h-10 rounded-full object-cover"
                  alt=""
                  referrerPolicy="no-referrer"
                />
<div>
                    <h2 className="text-[15.5px] font-bold text-text-primary leading-tight">{getChatDisplayName(activeChat)}</h2>
                    <p className="text-[11px] text-text-secondary">
                      {(() => {
                        const otherUser = getOtherUser(activeChat);
                        const presence = otherUser ? users.get(String(otherUser._id)) : null;
                        // Check both presence Map and user's online status from chat data
                        const isOnline = presence?.isOnline ?? otherUser?.online ?? false;
                        if (isOnline) {
                          return (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-brand-primary rounded-full"></span>
                              Online
                            </span>
                          );
                        }
                        return `Last seen ${formatLastSeen(presence?.lastSeen || otherUser?.lastSeen)}`;
                      })()}
                    </p>
                  </div>
              </div>
               <div className="flex gap-4 text-text-secondary">
                 <motion.button
                   onClick={toggleTheme}
                   className="p-2 hover:text-brand-primary hover:bg-brand-primary/10 rounded-full transition-all"
                   whileHover={{ scale: 1.1 }}
                   whileTap={{ scale: 0.95 }}
                   title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: theme === 'dark' ? 0 : 180 }}
                     transition={{ duration: 0.3 }}
                   >
                     {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                   </motion.div>
                 </motion.button>
                 <Video size={20} className="cursor-pointer hover:text-brand-primary transition-colors" />
                 <Phone size={18} className="cursor-pointer hover:text-brand-primary transition-colors" />
                 <MoreVertical size={20} className="cursor-pointer hover:text-brand-primary transition-colors" />
               </div>
            </header>

             {/* Message Area */}
             <div className="flex-1 overflow-y-auto p-4 md:px-12 space-y-1 bg-chat-bg relative">
               <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-fixed bg-repeat invert" />

              <div className="relative z-10 space-y-1">
                {loadingMessages ? (
                  <div className="text-center py-10 text-text-secondary">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 text-text-secondary">No messages yet. Say hello!</div>
                 ) : (
                   messages.map((msg) => {
                     const isSent = String(msg.sender._id) === String(user?.id);
                     return (
                       <div key={msg._id} className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} mb-1`}>
                          <div className={`chat-bubble ${isSent ? 'chat-bubble-sent' : 'chat-bubble-received'} ${msg.isVoice ? 'chat-bubble-voice' : ''} ${msg.isFile ? 'chat-bubble-file' : ''}`}>
                             {msg.isVoice && msg.voiceData ? (
                               <div className="flex flex-col gap-2">
                                 <audio
                                   controls
                                   src={msg.voiceData.startsWith('data:') ? msg.voiceData : `data:${msg.voiceMimeType || 'audio/webm'};base64,${msg.voiceData}`}
                                   className="h-8 w-full max-w-[200px]"
                                   style={{ filter: isSent ? 'invert(1)' : 'none' }}
                                 />
                                 <span className="text-[11px] text-text-secondary opacity-70">
                                   {msg.voiceDuration ? `${Math.round(msg.voiceDuration)}s` : ''}
                                 </span>
                               </div>
                             ) : msg.isFile && msg.fileData ? (
                               <div className="flex flex-col gap-2">
                                  {msg.fileType.startsWith('image/') ? (
                                    <div className="flex flex-col gap-2">
                                      <img
                                        src={`data:${msg.fileType};base64,${msg.fileData}`}
                                        alt={msg.fileName}
                                        className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                                        loading="lazy"
                                      />
                                      <div className="flex items-center justify-between p-2 bg-input-bg rounded-lg">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{msg.fileName}</p>
                                          <p className="text-xs text-secondary">{formatFileSize(msg.fileSize)}</p>
                                        </div>
                                        <button
                                          onClick={() => handleDownloadFile(msg.fileData!, msg.fileName!, msg.fileType!)}
                                          className="p-2 text-secondary hover:text-brand-primary hover:bg-brand-primary/10 rounded-full transition-all"
                                          title="Download image"
                                        >
                                          <Download size={18} />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3 p-3 bg-header-bg rounded-lg min-w-[200px] border border-border">
                                      <span className="text-2xl">{getFileIcon(msg.fileType)}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{msg.fileName}</p>
                                        <p className="text-xs text-secondary">{formatFileSize(msg.fileSize)}</p>
                                      </div>
                                      <button
                                        onClick={() => handleDownloadFile(msg.fileData!, msg.fileName!, msg.fileType!)}
                                        className="p-2 text-secondary hover:text-brand-primary hover:bg-brand-primary/10 rounded-full transition-all"
                                        title="Download file"
                                      >
                                        <Download size={18} />
                                      </button>
                                    </div>
                                  )}
                               </div>
                             ) : (
                               <p className="whitespace-pre-wrap">{msg.content}</p>
                             )}
<div className={`flex items-center gap-1 mt-1 justify-end translate-x-1 border-t-0 p-0`}>
                              <span className="text-[10px] text-text-secondary font-medium uppercase">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isSent && (
                                <div className="text-text-secondary">
                                  {(() => {
                                    // Check if message is read by other chat participants
                                    const otherParticipants = activeChatRef.current?.users
                                      .filter((u: any) => String(u._id) !== String(user?.id))
                                      .map((u: any) => String(u._id)) || [];
                                    const isRead = otherParticipants.length > 0 
                                      && otherParticipants.every((uid: string) => msg.readBy?.includes(uid));
                                    return isRead ? <CheckCheck size={13} /> : <Check size={13} />;
                                  })()}
                                </div>
                              )}
                            </div>
                           <div className={`absolute top-0 w-2 h-3 ${isSent ? '-right-2 border-l-[10px] border-l-bubble-sent border-b-[10px] border-b-transparent' : '-left-2 border-r-[10px] border-r-bubble-received border-b-[10px] border-b-transparent'}`} />
                         </div>
                       </div>
                     );
                   })
                 )}
                <div ref={messagesEndRef} />
              </div>
            </div>

              {/* Input Bar */}
              <div className="px-4 py-2 bg-header-bg flex items-center gap-4 shrink-0 relative">
                 <div className="flex gap-4 text-text-secondary">
                   <div className="relative" ref={emojiPickerRef}>
                     <Smile
                       size={24}
                       className="cursor-pointer hover:text-brand-primary transition-colors"
                       onClick={handleEmojiPickerToggle}
                     />
                     {showEmojiPicker && (
                       <div className="absolute bottom-full right-0 mb-2 z-50" onClick={(e) => e.stopPropagation()}>
                         <EmojiPicker
                           onEmojiClick={handleEmojiSelect}
                           theme={Theme.DARK}
                           width={320}
                           height={400}
                         />
                       </div>
                     )}
                   </div>
                   <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRecording || !!selectedFile}
                    className="cursor-pointer hover:text-brand-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Attach file"
                  >
                    <Paperclip size={24} />
                  </button>
                </div>

                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.zip,.mp3,.mp4,.mov"
                />

                {/* Hidden avatar upload input */}
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  className="hidden"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                />

                {/* Recording UI */}
                {isRecording ? (
                  <div className="flex-1 flex items-center gap-4 bg-input-bg rounded-lg px-4 py-2">
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                     <span className="text-text-primary text-sm">
                       Recording {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                     </span>
                   </div>
                   <div className="flex gap-2">
                     <button
                       onClick={cancelRecording}
                        className="px-4 py-1.5 text-sm text-text-secondary hover:text-brand-primary transition-colors"
                     >
                       Cancel
                     </button>
                     <button
                       onClick={stopRecording}
                       className="w-10 h-10 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
                     >
                       <div className="w-4 h-4 bg-white rounded-sm"></div>
                     </button>
                   </div>
                 </div>
                 ) : recordedAudioUrl ? (
                   // Preview recorded voice before sending
                   <div className="flex-1 flex items-center gap-4 bg-input-bg rounded-lg px-4 py-2">
                    <audio
                      controls
                      src={recordedAudioUrl}
                      className="h-8 flex-1"
                    />
                    <button
                      onClick={discardRecording}
                      className="w-10 h-10 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                 ) : selectedFile ? (
                   // Preview selected file before sending
                   <div className="flex-1 flex items-center gap-4 bg-input-bg rounded-lg px-4 py-2">
                    <div className="flex items-center gap-3 flex-1">
                      {selectedFile.type.startsWith('image/') && filePreviewUrl ? (
                        <img
                          src={filePreviewUrl}
                          alt="preview"
                          className="h-10 w-10 object-cover rounded"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xl">{getFileIcon(selectedFile.type)}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-text-secondary">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelFileAttachment}
                        className="w-10 h-10 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                      >
                        <X size={20} />
                      </button>
                      <button
                        onClick={sendFileMessage}
                        disabled={isUploading}
                        className="w-10 h-10 flex items-center justify-center bg-brand-primary text-text-primary rounded-full hover:brightness-110 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {isUploading ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send size={20} />
                        )}
                      </button>
                    </div>
                  </div>
                 ) : (
                   <>
                     <div className="flex-1 bg-input-bg rounded-lg px-4 py-2 shadow-sm">
                     <input
                       type="text"
                       placeholder="Type a message"
                       className="w-full border-none outline-none text-sm placeholder:text-text-secondary bg-transparent text-text-primary"
                       value={inputText}
                       onChange={(e) => setInputText(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                     />
                   </div>
                   {inputText.trim() ? (
                      <button
                        onClick={handleSendMessage}
                        className="w-10 h-10 flex items-center justify-center bg-brand-primary text-text-primary rounded-full hover:brightness-110 transition-all shadow-sm active:scale-95"
                      >
                       <Send size={20} />
                     </button>
                    ) : (
                      <button
                        onClick={startRecording}
                        className="w-10 h-10 flex items-center justify-center text-secondary hover:text-brand-primary transition-colors active:scale-95"
                      >
                        <Mic size={24} />
                      </button>
                    )}
                 </>
               )}
             </div>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-text-secondary space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-border/40 flex items-center justify-center">
                <MessageCircle size={48} className="text-border" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center border-4 border-chat-bg">
                <CheckCheck size={16} className="text-chat-bg" />
              </div>
            </div>
            <div className="text-center max-w-sm px-6">
              <h2 className="text-[22px] font-light text-text-primary mb-2">WhatsApp for Dark Mode</h2>
              <p className="text-[13px] leading-relaxed text-text-secondary">
                Send and receive messages without keeping your phone online.<br />
                All messages are end-to-end encrypted.
              </p>
            </div>
             <button
               onClick={() => setShowNewChatModal(true)}
                className="bg-brand-primary text-text-primary font-semibold py-3 px-6 rounded-full hover:bg-opacity-90 transition-all flex items-center gap-2"
             >
              <Plus size={20} />
              New Chat
            </button>
          </div>
          )}
        </motion.div>
      </AnimatePresence>

        {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewChatModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-sidebar-bg rounded-2xl shadow-2xl w-full max-w-md border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">New Chat</h2>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                  <input
                    type="text"
                    placeholder="Search users by name or email"
                    className="w-full bg-header-bg border border-border rounded-lg pl-10 pr-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* User List */}
              <div className="max-h-96 overflow-y-auto">
                {loadingUsers ? (
                  <div className="p-4 text-center text-text-secondary">Searching...</div>
                ) : searchResults.length === 0 && userSearchQuery.length >= 2 ? (
                  <div className="p-4 text-center text-text-secondary">No users found</div>
                ) : (
                  searchResults.map((user) => (
                    <button
                      key={user._id}
                      onClick={() => startNewChat(user)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-header-bg transition-colors border-b border-border text-left"
                    >
                      <div className="relative shrink-0">
                         <img
                           src={getAvatarUrl(user.avatar)}
                           alt={user.username}
                           className="w-12 h-12 rounded-full object-cover border border-border"
                           referrerPolicy="no-referrer"
                         />
                         {(() => {
                           const presence = users.get(String(user._id));
                           return presence?.isOnline && (
                             <div className="absolute bottom-0 right-0 w-3 h-3 bg-brand-primary border-2 border-sidebar-bg rounded-full"></div>
                           );
                         })()}
                       </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text-primary text-sm truncate">
                          {user.fullName || user.username}
                        </h3>
                        <p className="text-xs text-text-secondary truncate">@{user.username}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
