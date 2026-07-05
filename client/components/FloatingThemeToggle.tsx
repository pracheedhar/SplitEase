'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '../context/ThemeContext';

export default function FloatingThemeToggle() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // Hide the floating button on logged-in dashboard/group pages
  if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/groups')) {
    return null;
  }

  return (
    <button
      onClick={toggleTheme}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '1.5rem',
        zIndex: 100,
        width: '3rem',
        height: '3rem',
        borderRadius: '50%',
        background: theme === 'dark' ? 'rgba(28, 28, 48, 0.85)' : 'rgba(255, 255, 255, 0.9)',
        border: '1px solid var(--c-card-border)',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.25)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'transform 0.2s ease, background 0.3s ease',
      }}
      className="floating-theme-btn"
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
