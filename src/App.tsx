/**
 * Root React component for the GaleSage app.
 *
 * Manages up to three location cards (identity only: id, query, location). Geocode search
 * runs as a TanStack mutation; forecast data is loaded in WeatherDisplay via useWeatherQuery.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import Attribution from './components/Attribution';
import Brand from './components/Brand';
import ThemeMenu from './components/ThemeMenu';
import WeatherForm from './components/WeatherForm';
import WeatherDisplay from './components/WeatherDisplay';
import LocationPicker from './components/LocationPicker';
import UnitGroupMenu from './components/UnitGroupMenu';
import { searchLocations } from './api/geocodeClient';
import { useMediaQuery } from './hooks/useMediaQuery';
import type { WeatherCard } from './types/weather';
import type { LocationResult } from './types/location';
import { attachFocusTrap } from './utils/focusTrap';
import { locationsMatch } from './utils/locationIdentity';

/** Matches SCSS `md` (768px): below this, search/settings are full-screen overlays. */
const MOBILE_OVERLAY_QUERY = '(max-width: 767px)';

/** Matches SCSS `lg` (1024px): multi-card grid; below, only the active pager card mounts. */
const LG_UP_QUERY = '(min-width: 1024px)';

/**
 * Renders the GaleSage page and coordinates weather card state with child components.
 *
 * @returns The full application UI.
 */
export default function App() {
  const MAX_LOCATIONS = 3;
  const [cards, setCards] = useState<WeatherCard[]>([]);
  const [pendingLocations, setPendingLocations] = useState<LocationResult[]>([]);
  const [pendingQuery, setPendingQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null); // which location card the mobile pager shows; null when none

  // Search on submit: mutation owns pending state; results drive add-card or location picker.
  const { mutateAsync: geocodeSearch, isPending: isGeocoding } = useMutation({
    mutationFn: searchLocations,
  });

  const isLgUp = useMediaQuery(LG_UP_QUERY);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);
  const menuOverlayRef = useRef<HTMLDivElement>(null);

  /**
   * Geocodes the search term (mutation), then adds a card or opens the disambiguation picker.
   * Does not fetch weather; WeatherDisplay loads the forecast for each card's location.
   *
   * @param searchTerm - The location name entered by the user.
   */
  async function handleSearch(searchTerm: string): Promise<void> {
    if (cards.length >= MAX_LOCATIONS) return;
    if (isGeocoding) return; // ignore double submits while pending

    setFeedbackMessage('');
    setPendingLocations([]);
    setPendingQuery('');

    try {
      const results = await geocodeSearch(searchTerm);

      if (results.length === 0) {
        setFeedbackMessage('No locations found. Try a more specific search.');
        return;
      }

      if (results.length === 1) {
        addLocationCard(searchTerm, results[0]);
      } else {
        setPendingQuery(searchTerm);
        setPendingLocations(results);
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      setFeedbackMessage('Could not look up that location.');
    }
  }

  /**
   * Adds a card for the location chosen from the disambiguation picker.
   *
   * @param location - Geocoded location the user selected.
   */
  function handleLocationSelect(location: LocationResult): void {
    addLocationCard(pendingQuery, location);
    setPendingLocations([]);
    setPendingQuery('');
  }

  /**
   * Dismisses the location picker without adding a card.
   */
  function handleLocationCancel(): void {
    setPendingLocations([]);
    setPendingQuery('');
  }

  /**
   * Clears the uncontrolled location search input via `searchInputRef`.
   *
   * Called after a location is successfully added so the field is empty for the next search.
   * No-ops if the input is not mounted.
   */
  function clearSearchInput(): void {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
  }

  /**
   * Closes the search overlay and clears pending geocode picker state.
   *
   * @param options - Close behavior.
   * @param options.restoreFocus - When not `false`, moves focus back to the search toggle
   *   after the overlay hides (default true).
   */
  function closeSearch(options?: { restoreFocus?: boolean }): void {
    setIsSearchOpen(false);
    setPendingLocations([]);
    setPendingQuery('');
    if (options?.restoreFocus !== false) {
      // Defer so mobile CSS can hide the overlay before focusing the toggle. Avoids race condition/glitchy experience.
      requestAnimationFrame(() => searchToggleRef.current?.focus());
    }
  }

  /**
   * Closes the settings menu overlay.
   *
   * @param options - Close behavior.
   * @param options.restoreFocus - When not `false`, moves focus back to the menu toggle
   *   after the overlay hides (default true).
   */
  function closeMenu(options?: { restoreFocus?: boolean }): void {
    setIsMenuOpen(false);
    if (options?.restoreFocus !== false) {
      requestAnimationFrame(() => menuToggleRef.current?.focus());
    }
  }

  /**
   * Opens the search overlay and closes the settings menu if it was open.
   */
  function openSearch(): void {
    setIsMenuOpen(false);
    setIsSearchOpen(true);
  }

  /**
   * Opens the settings menu and closes search (clearing any pending location picker).
   */
  function openMenu(): void {
    setIsSearchOpen(false);
    setPendingLocations([]);
    setPendingQuery('');
    setIsMenuOpen(true);
  }

  /**
   * Creates a location card for a resolved location.
   *
   * Skips duplicates by rounded lat/lon (not Nominatim place_id), sets `activeCardId`
   * to the new card, clears the search input, and closes the search overlay on success.
   *
   * @param query - Original search text used to create the card.
   * @param location - Geocoded location to add.
   */
  function addLocationCard(query: string, location: LocationResult): void {
    const isDuplicate = cards.some((c) => locationsMatch(c.location, location));

    if (isDuplicate) {
      setFeedbackMessage('That location is already listed.');
      return;
    }

    const newCard: WeatherCard = {
      id: crypto.randomUUID(),
      query,
      location,
    };

    setCards((prev) => [...prev, newCard]);
    setActiveCardId(newCard.id);
    clearSearchInput();
    closeSearch({ restoreFocus: true });
  }

  /**
   * Removes the weather card with the given id from the list.
   *
   * If the removed card was active, selects a neighbor by id (same slot, or the new last
   * card). Otherwise leaves `activeCardId` unchanged.
   *
   * @param id - Weather card id to remove.
   */
  const handleRemove = useCallback((id: string): void => {
    setCards((prev) => {
      const removedAt = prev.findIndex((c) => c.id === id);
      const remaining = prev.filter((c) => c.id !== id);

      setActiveCardId((current) => {
        if (current !== id) return current;
        if (remaining.length === 0) return null;
        const next = remaining[Math.min(Math.max(removedAt, 0), remaining.length - 1)];
        return next.id;
      });

      return remaining;
    });
  }, []);

  // Focus the location input after the search overlay opens (mobile).
  useEffect(() => {
    if (!isSearchOpen) return;

    const frameId = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frameId);
  }, [isSearchOpen]);

  // Lock body scroll while a mobile overlay is open.
  useEffect(() => {
    const shouldLock = isSearchOpen || isMenuOpen;
    if (!shouldLock) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSearchOpen, isMenuOpen]);

  // Escape closes the active overlay.
  useEffect(() => {
    if (!isSearchOpen && !isMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      if (isSearchOpen) closeSearch();
      else closeMenu();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isMenuOpen]);

  // On mobile overlays: inert background chrome and trap Tab in the open dialog.
  useEffect(() => {
    if (!isSearchOpen && !isMenuOpen) return;

    const media = window.matchMedia(MOBILE_OVERLAY_QUERY);

    function applyOverlayInert(): (() => void) | undefined {
      if (!media.matches) return undefined;

      const content = document.querySelector<HTMLElement>('.content');
      const headerTop = document.querySelector<HTMLElement>('.header-top');
      const searchOverlay = searchOverlayRef.current;
      const menuOverlay = menuOverlayRef.current;
      const activeOverlay = isSearchOpen ? searchOverlay : menuOverlay;
      const inactiveOverlay = isSearchOpen ? menuOverlay : searchOverlay;

      const targets = [content, headerTop, inactiveOverlay].filter(
        (el): el is HTMLElement => el != null,
      );
      const previousInert = targets.map((el) => el.inert);
      for (const el of targets) {
        el.inert = true;
      }

      const releaseTrap = activeOverlay ? attachFocusTrap(activeOverlay) : undefined;

      return () => {
        targets.forEach((el, index) => {
          el.inert = previousInert[index] ?? false;
        });
        releaseTrap?.();
      };
    }

    let release = applyOverlayInert();

    function handleMediaChange(): void {
      release?.();
      release = applyOverlayInert();
    }

    media.addEventListener('change', handleMediaChange);
    return () => {
      media.removeEventListener('change', handleMediaChange);
      release?.();
    };
  }, [isSearchOpen, isMenuOpen]);

  // Pager position derived from activeCardId (not stored). -1 if id is missing/null.
  const activeCardIndex = cards.findIndex((c) => c.id === activeCardId);
  const safeActiveIndex = activeCardIndex >= 0 ? activeCardIndex : 0;

  // Mobile/tablet: only the active location card mounts. Desktop lg+: all cards (grid).
  const cardsToRender = isLgUp ? cards : cards.filter((card) => card.id === activeCardId);

  return (
    <>
      <header
        className="site-header"
        data-search-open={isSearchOpen ? 'true' : 'false'}
        data-menu-open={isMenuOpen ? 'true' : 'false'}
      >
        <div className="header-top">
          <Brand />
          <div className="header-top__actions">
            <button
              ref={searchToggleRef}
              type="button"
              className="search-toggle"
              aria-controls="header-search"
              aria-expanded={isSearchOpen}
              aria-label={isSearchOpen ? 'Close search' : 'Add location'}
              onClick={() => (isSearchOpen ? closeSearch() : openSearch())}
            >
              <svg
                className="search-toggle__icon"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
            <button
              ref={menuToggleRef}
              type="button"
              className="menu-toggle"
              aria-controls="header-menu"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => (isMenuOpen ? closeMenu() : openMenu())}
            >
              <svg
                className="menu-toggle__icon"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={searchOverlayRef}
          id="header-search"
          className="header-search"
          role={isSearchOpen ? 'dialog' : undefined}
          aria-modal={isSearchOpen ? true : undefined}
          aria-label={isSearchOpen ? 'Search for a location' : undefined}
        >
          <div className="header-search__panel">
            <Brand />
            <div className="header-search__toolbar">
              <p className="header-search__title">Search</p>
              <button
                type="button"
                className="header-search__close"
                aria-label="Close search"
                onClick={() => closeSearch()}
              >
                Close
              </button>
            </div>

            <WeatherForm
              onSearch={handleSearch}
              isAtLimit={cards.length >= MAX_LOCATIONS}
              feedbackMessage={feedbackMessage}
              isGeocoding={isGeocoding}
              inputRef={searchInputRef}
            />

            <div className="header-search__dropdown">
              {pendingLocations.length > 0 && (
                <LocationPicker
                  query={pendingQuery}
                  locations={pendingLocations}
                  onSelect={handleLocationSelect}
                  onCancel={handleLocationCancel}
                />
              )}
            </div>
          </div>
        </div>

        <div
          ref={menuOverlayRef}
          id="header-menu"
          className="header-menu"
          role={isMenuOpen ? 'dialog' : undefined}
          aria-modal={isMenuOpen ? true : undefined}
          aria-label={isMenuOpen ? 'Settings' : undefined}
        >
          <div className="header-menu__panel">
            <Brand />
            <div className="header-menu__toolbar">
              <p className="header-menu__title">Settings</p>
              <button
                type="button"
                className="header-menu__close"
                aria-label="Close menu"
                onClick={() => closeMenu()}
              >
                Close
              </button>
            </div>
            <div className="header-controls">
              <UnitGroupMenu />
              <ThemeMenu />
            </div>
          </div>
        </div>
      </header>

      <div className="content">
        {cards.length > 0 && (
          <div className="weather-cards-pager" role="navigation" aria-label="Location cards">
            {cards.length < MAX_LOCATIONS && (
              <button
                type="button"
                className="weather-cards-pager__btn weather-cards-pager__add"
                aria-label="Add location"
                onClick={() => openSearch()}
              >
                +
              </button>
            )}

            <div className="weather-cards-pager__nav">
              <button
                type="button"
                className="weather-cards-pager__btn"
                aria-label="Previous location"
                disabled={safeActiveIndex <= 0}
                onClick={() => {
                  const prev = cards[safeActiveIndex - 1];
                  if (prev) setActiveCardId(prev.id);
                }}
              >
                {'<'}
              </button>

              <div className="weather-cards-pager__dots">
                {cards.map((card) => {
                  const label = card.location?.displayName ?? card.query;
                  const isCurrent = card.id === activeCardId;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`weather-cards-pager__dot${isCurrent ? ' weather-cards-pager__dot--active' : ''}`}
                      aria-label={label}
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => setActiveCardId(card.id)}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                className="weather-cards-pager__btn"
                aria-label="Next location"
                disabled={safeActiveIndex >= cards.length - 1}
                onClick={() => {
                  const next = cards[safeActiveIndex + 1];
                  if (next) setActiveCardId(next.id);
                }}
              >
                {'>'}
              </button>
            </div>
          </div>
        )}

        {cards.length === 0 && (
          <div className="empty-locations">
            <button type="button" className="empty-locations__cta" onClick={() => openSearch()}>
              Add location
            </button>
            <p className="empty-locations__instructions">
              Search for a location to see the forecast
            </p>
          </div>
        )}

        {cardsToRender.length > 0 && (
          <div className="weather-cards">
            {cardsToRender.map((card) => (
              <WeatherDisplay
                key={card.id}
                card={card}
                isActive={card.id === activeCardId}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        <Attribution />
      </div>
    </>
  );
}
