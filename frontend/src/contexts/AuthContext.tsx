import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  _id?: string;
  username: string;
  email: string;
  fullName: string;
  avatar: string;
  online?: boolean;
}

interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me', token)
        .then((data: User) => {
          // Normalize _id to id
          const normalizedUser = {
            ...data,
            id: data._id || data.id
          };
          setUser(normalizedUser);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const response = (await api.post<LoginResponse>('/auth/login', { email, password })) as LoginResponse;
      const { token: newToken, user: userData } = response;

      // Normalize _id to id
      const normalizedUser = {
        ...userData,
        id: userData._id || userData.id
      };

      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(normalizedUser);

      return {};
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      return { error: errorMessage };
    }
  };

  const register = async (username: string, email: string, password: string, fullName?: string) => {
    try {
      const response = (await api.post<AuthResponse>('/auth/register', { username, email, password, fullName })) as AuthResponse;
      const { token: newToken, user: userData } = response;

      // Normalize _id to id
      const normalizedUser = {
        ...userData,
        id: userData._id || userData.id
      };

      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(normalizedUser);

      return {};
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      return { error: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      setUser(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
