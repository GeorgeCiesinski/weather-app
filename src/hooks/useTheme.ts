/**
 * useTheme hook.
 *
 * Provides typed access to the theme preference, resolved appearance, and
 * setTheme function from ThemeContext, and guards against being called outside
 * of a ThemeProvider.
 */
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

/**
 * Reads the theme preference, resolved appearance, and setTheme from ThemeContext.
 *
 * @throws If called outside of a ThemeProvider.
 * @returns The preference, resolved theme, and a function to set the preference.
 */
export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
