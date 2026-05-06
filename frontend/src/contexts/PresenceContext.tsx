import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../services/api';

interface PresenceUser {
  userId: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface PresenceContextType {
  users: Map<string, PresenceUser>;
  isConnected: boolean;
  updateUserPresence: (userId: string, isOnline: boolean) => void;
  formatLastSeen: (lastSeen?: Date | string) => string;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io(SERVER_URL, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for presence updates from server
    newSocket.on('user-presence', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setUsers(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(userId) as PresenceUser | undefined;
        // When user comes online, preserve existing lastSeen if any
        // When user goes offline, set lastSeen to now
        const newLastSeen = isOnline ? (existing?.lastSeen ?? new Date()) : new Date();
        newMap.set(userId, {
          userId,
          isOnline,
          lastSeen: newLastSeen
        });
        return newMap;
      });
    });

    // Handle ping-pong heartbeat
    newSocket.on('ping', () => {
      newSocket.emit('heartbeat');
    });

    // Setup activity listeners for user interaction
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    let activityTimeout: ReturnType<typeof setTimeout>;

    const handleActivity = () => {
      newSocket.emit('user-active');
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        // Activity timeout reached - user is idle but still online
      }, 60000);
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      clearTimeout(activityTimeout);
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      newSocket.close();
    };
  }, []);

  const updateUserPresence = useCallback((userId: string, isOnline: boolean) => {
    setUsers(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(userId) as PresenceUser | undefined;
      const newLastSeen = isOnline ? (existing?.lastSeen ?? new Date()) : new Date();
      newMap.set(userId, {
        userId,
        isOnline,
        lastSeen: newLastSeen
      });
      return newMap;
    });
  }, []);

  const formatLastSeen = useCallback((lastSeen?: Date | string): string => {
    if (!lastSeen) return '';
    
    const date = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }, []);

  return (
    <PresenceContext.Provider value={{ users, isConnected, updateUserPresence, formatLastSeen }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};