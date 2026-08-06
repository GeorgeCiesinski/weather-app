/**
 * Theme context: shares the active color theme across the component tree.
 *
 * Exposes a ThemeProvider that owns the theme preference. Keeping the state in
 * one provider ensures every consumer (header theme menu, settings, etc.) stays in sync.
 *
 * Theme resolution (localStorage key `theme`: light | dark | system; system and
 * missing/invalid values use prefers-color-scheme) must stay in sync with the FOUC
 * script in index.html, which applies data-theme before React loads.
 */
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext } from './ThemeContext';
import type { ThemePreference, ResolvedTheme } from './ThemeContext';

/**
 * Resolves a theme preference to the light/dark appearance to apply.
 *
 * Mirrors the FOUC script in index.html: light/dark apply as-is; system (and
 * anything not light/dark at boot) follows the OS prefers-color-scheme.
 *
 * @param preference - The user's saved preference.
 * @returns The effective light or dark theme.
 */
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Retrieves the saved theme preference from local storage, or defaults to system.
 *
 * @returns The initial theme preference.
 */
function getInitialPreference(): ThemePreference {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

/**
 * Provides theme state to all descendants and persists changes.
 *
 * Owns the single source of theme preference, applies the resolved light/dark
 * appearance to the document's data-theme attribute, and mirrors the preference
 * to local storage. When preference is system, listens for OS color-scheme changes.
 *
 * @param props - Component props.
 * @param props.children - The subtree that can access the theme.
 * @returns The provider wrapping the given children.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(getInitialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getInitialPreference()),
  );

  useEffect(() => {
    const applyResolved = (): void => {
      const resolved = resolveTheme(theme);
      setResolvedTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyResolved();
    localStorage.setItem('theme', theme);

    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      applyResolved();
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  /**
   * Sets the theme preference to an explicit value.
   *
   * @param preference - The preference to save and apply.
   */
  const setTheme = (preference: ThemePreference): void => {
    setThemeState(preference);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
