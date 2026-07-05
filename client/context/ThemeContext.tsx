'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('splitease-theme') as Theme | null;
    const initial = saved ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('splitease-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

/** Returns theme-aware color tokens for use in inline styles */
export const useColors = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return {
    bg:         isDark ? '#0f0f19'              : '#f0f4ff',
    sidebar:    isDark ? 'rgba(22,22,42,0.97)'  : 'rgba(255,255,255,0.98)',
    text:       isDark ? '#e2e8f0'              : '#1e1b4b',
    textMuted:  isDark ? '#94a3b8'              : '#475569',
    textDim:    isDark ? '#64748b'              : '#6366f1',
    border:     isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.2)',
    tabBg:      isDark ? 'rgba(22,22,42,0.6)'   : 'rgba(224,231,255,0.7)',
    inputBg:    isDark ? 'rgba(22,22,42,0.8)'   : 'rgba(238,242,255,0.9)',
    expRowBg:   isDark ? 'rgba(99,102,241,0.05)': 'rgba(238,242,255,0.6)',
    isDark,
  };
};
