import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { darkColors, lightColors, type ThemeColors, type ThemeName } from './tokens';
import { getThemeName, setThemeName } from '../storage/session';

type ThemeContextValue = {
  theme: ThemeName;
  colors: ThemeColors;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>('dark');

  useEffect(() => {
    void getThemeName().then(setTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const colors = theme === 'dark' ? darkColors : lightColors;

    return {
      theme,
      colors,
      toggle: () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        void setThemeName(next);
      }
    };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
