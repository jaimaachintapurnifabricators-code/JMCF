import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../utils/api';

interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'partner';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          setToken(savedToken);
          const data = await api.get('/auth/me');
          if (data.success && data.user) {
            setUser(data.user);
          } else {
            // Clean invalid token
            logout();
          }
        } catch (err) {
          console.error('Session restoration failed:', err);
          logout();
        }
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.post('/auth/login', { username, password });
    if (data.success && data.token && data.user) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    } else {
      throw new Error(data.message || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
