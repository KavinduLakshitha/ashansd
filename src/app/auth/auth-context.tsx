'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axios from '@/lib/api/axios';
import { usePathname, useRouter } from 'next/navigation';

interface User {
  id: number; 
  name: string;
  userType: string;
  currentBusinessLine: number; 
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, businessLineId: number) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  getUserID: () => number | null;
  getBusinessLineID: () => number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ['/'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }
    
    const handleInvalidAuth = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      
      if (!PUBLIC_ROUTES.includes(pathname)) {
        router.push('/');
      }
    };

    const validateAndSetUser = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          
          if (!parsedUser.id || !parsedUser.currentBusinessLine) {
            throw new Error('Invalid user data: Missing required IDs');
          }
          
          setUser(parsedUser);
          
          try {
            await axios.get('/auth/validate');
          } catch (error) {
            console.error('Token validation failed:', error);
            handleInvalidAuth();
          }
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          handleInvalidAuth();
        }
      } else if (!PUBLIC_ROUTES.includes(pathname)) {
        router.push('/');
      }
      
      setIsLoading(false);
    };

    validateAndSetUser();
  }, [pathname, router]); 

  const login = async (username: string, password: string, businessLineId: number) => {
    try {
      const response = await axios.post('/auth/login', {
        username: username,
        password: password,
        businessLineId: businessLineId
      });

      const { token, user } = response.data;
      
      if (!user.id || !user.currentBusinessLine) {
        throw new Error('Invalid user data received from server');
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/');
  };

  const getUserID = (): number | null => {
    return user?.id || null;
  };

  const getBusinessLineID = (): number | null => {
    return user?.currentBusinessLine || null;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, getUserID, getBusinessLineID }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};