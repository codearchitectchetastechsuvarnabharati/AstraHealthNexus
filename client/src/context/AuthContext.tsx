// Authentication Context - Manages user session and auth state
import { createContext, ReactNode, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'operations' | 'researcher' | 'analyst' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Mock authentication for now - will integrate with backend
function getMockUser(email: string): User {
  // Simulate different users with different roles
  const roles: Record<string, UserRole> = {
    'admin@astrahealth.com': 'admin',
    'ops@astrahealth.com': 'operations',
    'researcher@astrahealth.com': 'researcher',
    'analyst@astrahealth.com': 'analyst',
  };

  return {
    id: email.split('@')[0],
    email,
    name: email.split('@')[0].replace(/[._-]/g, ' '),
    role: roles[email] || 'viewer',
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem('astrahealth_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (err) {
        localStorage.removeItem('astrahealth_user');
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual backend API call
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password }),
      // });
      // const data = await response.json();

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simple validation
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Mock authentication
      const mockUser = getMockUser(email);
      setUser(mockUser);
      localStorage.setItem('astrahealth_user', JSON.stringify(mockUser));
    } catch (error) {
      setUser(null);
      localStorage.removeItem('astrahealth_user');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('astrahealth_user');
    // TODO: Call backend logout endpoint
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual backend API call
      if (!email || !password || !name) {
        throw new Error('All fields are required');
      }

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newUser: User = {
        id: email.split('@')[0],
        email,
        name,
        role: 'viewer', // Default role for new users
      };

      setUser(newUser);
      localStorage.setItem('astrahealth_user', JSON.stringify(newUser));
    } catch (error) {
      setUser(null);
      localStorage.removeItem('astrahealth_user');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: user !== null,
        user,
        isLoading,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
