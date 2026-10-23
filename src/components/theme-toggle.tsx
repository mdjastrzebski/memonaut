import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

// Also read by the inline script in index.html, which applies the theme before the first paint.
const STORAGE_KEY = 'memonaut:theme';

type Theme = 'light' | 'dark';

/** The theme picked on this device, else the system's. */
function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be blocked, e.g. in private mode; fall back to the system theme.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be full or blocked; the theme is then only kept until reload.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(loadTheme);
  const dark = theme === 'dark';

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  };

  return (
    <Button
      variant="sticker"
      size="lg"
      className="ml-auto rounded-full px-3"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    >
      {dark ? <Moon /> : <Sun />}
      <span className="max-sm:hidden">{dark ? 'Dark' : 'Light'}</span>
    </Button>
  );
}
