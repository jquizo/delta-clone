import { useEffect, useState } from 'react';
import { useAppStore } from '../../app/store';

/** Tracks the OS color-scheme preference so the toggle icon stays correct
 * for users on 'system' (theme === null) even if they switch OS theme
 * while the app is open — the page itself already re-themes live via the
 * prefers-color-scheme media query in index.css; this just keeps the icon
 * in sync with it. */
function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return prefersDark;
}

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const systemPrefersDark = useSystemPrefersDark();
  const isDark = theme === 'dark' || (theme === null && systemPrefersDark);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-muted hover:bg-hairline hover:text-ink"
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
