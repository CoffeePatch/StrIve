import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const useResolvedTheme = () => {
  const { theme } = useTheme();
  
  if (theme !== 'system') return theme;
  
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  
  return 'dark'; // Fallback
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    // Try to read from localStorage
    try {
      const savedTheme = localStorage.getItem('strive-theme');
      if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') {
        return savedTheme;
      }
    } catch (e) {
      console.warn('Failed to read theme from localStorage', e);
    }
    return 'dark'; // default
  });

  useEffect(() => {
    // Determine the actual theme to apply
    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    // Apply the theme to the document element
    const root = document.documentElement;
    root.setAttribute('data-theme', effectiveTheme);
    
    // Save the user's preference to localStorage
    try {
      localStorage.setItem('strive-theme', theme);
    } catch (e) {
      console.warn('Failed to save theme to localStorage', e);
    }
  }, [theme]);

  // Listen to system theme changes if 'system' is selected
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  const contextValue = useMemo(() => ({
    theme,
    toggleTheme,
    setTheme
  }), [theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
