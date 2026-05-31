import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { checkAuth, login as apiLogin, logout as apiLogout } from '../api/admin.js';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  check: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const ok = await checkAuth();
      setIsAuthenticated(ok);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (password: string) => {
    await apiLogin(password);
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setIsAuthenticated(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, check }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
