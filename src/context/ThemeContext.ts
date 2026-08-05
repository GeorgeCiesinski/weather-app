/**
 * Theme context definition.
 *
 * Declares the ThemeContext object and its value type, shared by the
 * ThemeProvider (which supplies the value) and the useTheme hook (which
 * consumes it). Kept in its own module so both can import it without creating
 * a circular dependency.
 */
import { createContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export type ThemeContextValue = {
  /** User-chosen preference (saved to localStorage). */
  theme: ThemePreference;
  /** Effective light/dark appearance applied to the document. */
  resolvedTheme: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
};

/**
 * Channel that carries the theme value to descendants.
 *
 * Defaults to undefined so useTheme can detect usage outside a ThemeProvider.
 */
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
