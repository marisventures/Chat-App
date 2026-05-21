import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../services/api';
import { useAuth } from './AuthContext';

export type StatusType = 'text' | 'image' | 'video' | 'contact';

export interface StatusItem {
  _id: string;
  userId: string;
  user: {
    _id: string;
    username: string;
    fullName?: string;
    avatar: string;
  };
  type: StatusType;
  content?: string;
  mediaUrl?: string;
  backgroundColor?: string;
  contactInfo?: {
    name: string;
    phone: string;
    avatar?: string;
  };
  createdAt: string;
  expiresAt: string;
  viewedBy: string[];
  duration?: number;
}

interface StatusViewerState {
  statuses: StatusItem[];
  currentIndex: number;
  progress: number;
  isPaused: boolean;
  isVisible: boolean;
}

interface StatusContextType {
  myStatuses: StatusItem[];
  contactsStatuses: Map<string, StatusItem[]>;
  viewer: StatusViewerState;
  isConnected: boolean;
  fetchMyStatuses: () => Promise<void>;
  fetchContactsStatuses: () => Promise<void>;
  createStatus: (data: {
    type: StatusType;
    content?: string;
    mediaData?: string;
    mediaType?: string;
    backgroundColor?: string;
    contactInfo?: { name: string; phone: string; avatar?: string };
  }) => Promise<void>;
  deleteStatus: (statusId: string) => Promise<void>;
  openStatusViewer: (statuses: StatusItem[], startIndex?: number) => void;
  closeStatusViewer: () => void;
  nextStatus: () => void;
  prevStatus: () => void;
  pauseStatus: () => void;
  resumeStatus: () => void;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export const StatusProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);
  const [contactsStatuses, setContactsStatuses] = useState<Map<string, StatusItem[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [viewer, setViewer] = useState<StatusViewerState>({
    statuses: [],
    currentIndex: 0,
    progress: 0,
    isPaused: false,
    isVisible: false
  });

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    const newSocket = io(SERVER_URL, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('status-created', (status: StatusItem) => {
      if (status.userId === user.id) {
        setMyStatuses(prev => [status, ...prev]);
      }
    });

    newSocket.on('status-deleted', ({ statusId, userId }: { statusId: string; userId: string }) => {
      if (userId === user.id) {
        setMyStatuses(prev => prev.filter(s => s._id !== statusId));
      }
      setContactsStatuses(prev => {
        const newMap = new Map(prev);
        newMap.forEach((statuses: StatusItem[], key: string) => {
          newMap.set(key, statuses.filter(s => s._id !== statusId));
        });
        return newMap;
      });
    });

    newSocket.on('status-viewed', ({ statusId, viewerId }: { statusId: string; viewerId: string }) => {
      setMyStatuses(prev => prev.map(s => 
        s._id === statusId ? { ...s, viewedBy: [...new Set([...s.viewedBy, viewerId])] } : s
      ));
    });

    return () => newSocket.close();
  }, [user]);

  const fetchMyStatuses = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${SERVER_URL}/api/status/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyStatuses(data);
      }
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  }, []);

  const fetchContactsStatuses = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${SERVER_URL}/api/status/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const statusMap = new Map<string, StatusItem[]>();
        data.forEach((item: { userId: string; statuses: StatusItem[] }) => {
          statusMap.set(item.userId, item.statuses);
        });
        setContactsStatuses(statusMap);
      }
    } catch (error) {
      console.error('Error fetching contacts statuses:', error);
    }
  }, []);

  const createStatus = useCallback(async (data: {
    type: StatusType;
    content?: string;
    mediaData?: string;
    mediaType?: string;
    backgroundColor?: string;
    contactInfo?: { name: string; phone: string; avatar?: string };
  }) => {
    if (!user) return;
    
    const token = localStorage.getItem('token');
    const response = await fetch(`${SERVER_URL}/api/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create status' }));
      throw new Error(error.error || 'Failed to create status');
    }

    const newStatus = await response.json();
    setMyStatuses(prev => [newStatus, ...prev]);
  }, [user]);

  const deleteStatus = useCallback(async (statusId: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${SERVER_URL}/api/status/${statusId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      setMyStatuses(prev => prev.filter(s => s._id !== statusId));
    }
  }, []);

  const openStatusViewer = useCallback((statuses: StatusItem[], startIndex = 0) => {
    setViewer({
      statuses,
      currentIndex: startIndex,
      progress: 0,
      isPaused: false,
      isVisible: true
    });
  }, []);

  const closeStatusViewer = useCallback(() => {
    setViewer(prev => ({ ...prev, isVisible: false, statuses: [], currentIndex: 0, progress: 0 }));
  }, []);

  const nextStatus = useCallback(() => {
    setViewer(prev => {
      if (prev.currentIndex < prev.statuses.length - 1) {
        return { ...prev, currentIndex: prev.currentIndex + 1, progress: 0 };
      }
      return { ...prev, isVisible: false };
    });
  }, []);

  const prevStatus = useCallback(() => {
    setViewer(prev => {
      if (prev.currentIndex > 0) {
        return { ...prev, currentIndex: prev.currentIndex - 1, progress: 0 };
      }
      return prev;
    });
  }, []);

  const pauseStatus = useCallback(() => {
    setViewer(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeStatus = useCallback(() => {
    setViewer(prev => ({ ...prev, isPaused: false }));
  }, []);

  useEffect(() => {
    if (viewer.isVisible && !viewer.isPaused) {
      const interval = setInterval(() => {
        setViewer(prev => {
          const newProgress = prev.progress + 0.5;
          if (newProgress >= 100) {
            return { ...prev, progress: 100 };
          }
          return { ...prev, progress: newProgress };
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [viewer.isVisible, viewer.isPaused]);

  useEffect(() => {
    if (viewer.progress >= 100 && viewer.isVisible) {
      const timer = setTimeout(() => nextStatus(), 200);
      return () => clearTimeout(timer);
    }
  }, [viewer.progress, viewer.isVisible, nextStatus]);

  useEffect(() => {
    fetchMyStatuses();
    fetchContactsStatuses();
  }, [fetchMyStatuses, fetchContactsStatuses]);

  return (
    <StatusContext.Provider value={{
      myStatuses,
      contactsStatuses,
      viewer,
      isConnected,
      fetchMyStatuses,
      fetchContactsStatuses,
      createStatus,
      deleteStatus,
      openStatusViewer,
      closeStatusViewer,
      nextStatus,
      prevStatus,
      pauseStatus,
      resumeStatus
    }}>
      {children}
    </StatusContext.Provider>
  );
};

export const useStatus = () => {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error('useStatus must be used within a StatusProvider');
  }
  return context;
};