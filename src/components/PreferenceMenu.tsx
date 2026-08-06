/**
 * Shared shell for header preference menus (theme, unit group, etc.).
 *
 * Handles open/close, outside click, Escape, Tab through options, and
 * Arrow/Home/End navigation. Feature wrappers supply the trigger face and value.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

export type PreferenceOption<T extends string> = {
  value: T;
  label: string;
};

export type PreferenceMenuProps<T extends string> = {
  /** Accessible name for the trigger and menu. */
  label: string;
  value: T;
  options: PreferenceOption<T>[];
  onChange: (value: T) => void;
  /** Extra classes on the trigger button (e.g. icon vs text variant). */
  triggerClassName?: string;
  /** Content inside the trigger button. */
  triggerChildren: ReactNode;
  /** Extra class on the root (e.g. theme-menu for icon styles). */
  className?: string;
};

/**
 * Renders a disclosure button and a list of exclusive preference options.
 *
 * @returns The preference menu control.
 */
export default function PreferenceMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  triggerClassName = '',
  triggerChildren,
  className = '',
}: PreferenceMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const closeAndFocusTrigger = useCallback((): void => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const selectOption = useCallback(
    (next: T): void => {
      onChange(next);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndFocusTrigger();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closeAndFocusTrigger]);

  // Focus selected (or first) option when the menu opens.
  useLayoutEffect(() => {
    if (!open) return;

    const selectedIndex = options.findIndex((option) => option.value === value);
    const index = selectedIndex >= 0 ? selectedIndex : 0;
    optionRefs.current[index]?.focus();
  }, [open, options, value]);

  const focusOptionAt = (index: number): void => {
    const count = options.length;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    optionRefs.current[next]?.focus();
  };

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>): void => {
    const focusedIndex = optionRefs.current.findIndex((el) => el === document.activeElement);
    const current = focusedIndex >= 0 ? focusedIndex : 0;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOptionAt(current + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOptionAt(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOptionAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusOptionAt(options.length - 1);
        break;
      default:
        break;
    }
  };

  const rootClass = ['preference-menu', className].filter(Boolean).join(' ');
  const triggerClass = ['preference-menu__trigger', triggerClassName].filter(Boolean).join(' ');

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {triggerChildren}
      </button>

      {open && (
        <ul
          id={menuId}
          role="menu"
          className="preference-menu__list"
          aria-label={label}
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => (
            <li key={option.value} role="none">
              <button
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                className="preference-menu__option"
                aria-checked={value === option.value}
                onClick={() => selectOption(option.value)}
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
