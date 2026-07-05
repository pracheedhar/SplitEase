'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import { authApi, setAccessToken } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  currencyPreference: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'SET_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean };

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: true, isLoading: false };
    case 'LOGOUT':
      return { user: null, isAuthenticated: false, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Silent refresh on app load — uses HTTP-only cookie
  // Skip if the user explicitly logged out this session
  useEffect(() => {
    const silentRefresh = async () => {
      const didLogOut = sessionStorage.getItem('splitease-logged-out');
      if (didLogOut === '1') {
        dispatch({ type: 'LOGOUT' });
        return;
      }
      try {
        const { data } = await authApi.refresh();
        setAccessToken(data.data.accessToken);
        const { data: meData } = await authApi.me();
        dispatch({ type: 'SET_USER', payload: meData.data.user });
      } catch {
        dispatch({ type: 'LOGOUT' });
      }
    };
    silentRefresh();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    sessionStorage.removeItem('splitease-logged-out');
    const { data } = await authApi.login({ email, password });
    setAccessToken(data.data.accessToken);
    dispatch({ type: 'SET_USER', payload: data.data.user });
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { data } = await authApi.register({ name, email, password });
      setAccessToken(data.data.accessToken);
      dispatch({ type: 'SET_USER', payload: data.data.user });
    },
    []
  );

  const loginWithToken = useCallback(async (token: string) => {
    // Clear any logged-out flag when user actively signs in (including OAuth)
    sessionStorage.removeItem('splitease-logged-out');
    setAccessToken(token);
    const { data } = await authApi.me();
    dispatch({ type: 'SET_USER', payload: data.data.user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      // Mark that this session explicitly logged out — prevents silent re-auth on page load
      sessionStorage.setItem('splitease-logged-out', '1');
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, loginWithToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
