import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { checkAuth, login as apiLogin, logout as apiLogout } from '../api/admin.js';
import { setUnauthorizedHandler } from '../api/client.js';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True when the session expired mid-use (drives the login-page notice). */
  sessionExpired: boolean;
  login: (password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  check: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

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

  const login = useCallback(async (password: string, rememberMe = false) => {
    await apiLogin(password, rememberMe);
    setIsAuthenticated(true);
    setSessionExpired(false);
    setIsLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setIsAuthenticated(false);
    setSessionExpired(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  // When any admin request gets a 401 (expired session), drop auth state and
  // flag it so ProtectedRoute redirects to login and the login page can explain why.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIsAuthenticated(false);
      setSessionExpired(true);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, sessionExpired, login, logout, check }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
