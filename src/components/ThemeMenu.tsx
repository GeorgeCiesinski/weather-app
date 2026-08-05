/**
 * Header control for choosing light, dark, or system theme via a dropdown menu.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { ThemePreference } from '../context/ThemeContext';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Renders a circular theme button that opens a menu of theme preferences.
 *
 * The button face shows sun/clouds or moon/stars based on the resolved theme.
 * Menu items set the saved preference (light, dark, or system).
 *
 * @returns The theme menu control.
 */
export default function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectPreference = (preference: ThemePreference): void => {
    setTheme(preference);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="theme-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`theme-menu__button theme-menu__button--${resolvedTheme}`}
        aria-label="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="theme-menu__icon theme-menu__icon--sun" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle fill="currentColor" stroke="none" cx="12" cy="12" r="6" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </span>

        <span className="theme-menu__icon theme-menu__icon--cloud" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" stroke="none">
            <path d="M7 18a4 4 0 0 1-.88-7.9 5 5 0 0 1 9.3-1.2 3.5 3.5 0 0 1 3.1 5.7A3.5 3.5 0 0 1 17 18H7z" />
          </svg>
        </span>

        <span className="theme-menu__icon theme-menu__icon--stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" stroke="none">
            <circle cx="4" cy="4" r="1.2" />
            <circle cx="22" cy="10" r="1" />
            <circle cx="17" cy="21" r="1.1" />
            <circle cx="1" cy="8" r="0.9" />
            <circle cx="5" cy="20" r="0.8" />
            <circle cx="9" cy="23" r="0.9" />
            <circle cx="14" cy="1" r="0.8" />
          </svg>
        </span>

        <span className="theme-menu__icon theme-menu__icon--moon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </span>
      </button>

      {open && (
        <ul id={menuId} role="menu" className="theme-menu__menu" aria-label="Theme">
          {THEME_OPTIONS.map((option) => (
            <li key={option.value} role="none">
              <button
                type="button"
                role="menuitemradio"
                className="theme-menu__option"
                aria-checked={theme === option.value}
                onClick={() => selectPreference(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
