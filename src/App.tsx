/**
 * Root React component for the GaleSage app.
 *
 * Manages weather cards state (up to 3), handles search and refresh, and renders the header and results.
 */

import { useState, useEffect, useRef } from 'react';
import Attribution from './components/Attribution';
import Brand from './components/Brand';
import ThemeMenu from './components/ThemeMenu';
import WeatherForm from './components/WeatherForm';
import WeatherDisplay from './components/WeatherDisplay';
import LocationPicker from './components/LocationPicker';
import UnitGroupMenu from './components/UnitGroupMenu';
import { searchLocations } from './api/geocodeClient';
import { fetchWeatherByCoords } from './api/weatherClient';
import { useUnitGroup } from './hooks/useUnitGroup';
import type { WeatherCard } from './types/weather';
import type { LocationResult } from './types/location';
import { attachFocusTrap } from './utils/focusTrap';

/** Matches SCSS `md` (768px): below this, search/settings are full-screen overlays. */
const MOBILE_OVERLAY_QUERY = '(max-width: 767px)';

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
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null); // which location card the mobile pager shows; null when none

  const { unitGroup } = useUnitGroup();

  // Skip the unitGroup effect on mount so we don't refetch before any cards exist.
  const isFirstRender = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);
  const menuOverlayRef = useRef<HTMLDivElement>(null);

  /**
   * Fetches weather for a card and updates only the matching card by id.
   *
   * Uses the current unitGroup from context for the API request.
   *
   * @param id - Weather card id to update.
   * @param lat - Location latitude.
   * @param lon - Location longitude.
   */
  async function fetchWeatherForCard(id: string, lat: number, lon: number): Promise<void> {
    try {
      const data = await fetchWeatherByCoords(lat, lon, unitGroup);
      setCards((prev) => {
        if (!prev.some((c) => c.id === id)) return prev;
        return prev.map((c) => (c.id === id ? { ...c, data, isLoading: false, error: null } : c));
      });
    } catch (error) {
      console.error('Weather search failed:', error);
      const message = error instanceof Error ? error.message : 'Weather request failed';
      setCards((prev) => {
        if (!prev.some((c) => c.id === id)) return prev;
        return prev.map((c) => (c.id === id ? { ...c, isLoading: false, error: message } : c));
      });
    }
  }

  /**
   * Creates a new weather card for the given search term and starts a fetch, up to a maximum of 3 locations.
   *
   * @param searchTerm - The location name entered by the user.
   */
  async function handleSearch(searchTerm: string): Promise<void> {
    if (cards.length >= MAX_LOCATIONS) return;

    setFeedbackMessage('');
    setPendingLocations([]);
    setPendingQuery('');
    setIsGeocoding(true);

    try {
      const results = await searchLocations(searchTerm);

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
    } finally {
      setIsGeocoding(false);
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
   * Creates a weather card for a resolved location and starts fetching its forecast.
   *
   * Skips duplicates, sets `activeCardId` to the new card, clears the search input, and
   * closes the search overlay on success.
   *
   * @param query - Original search text used to create the card.
   * @param location - Geocoded location to add.
   */
  function addLocationCard(query: string, location: LocationResult): void {
    const isDuplicate = cards.some((c) => c.location?.placeId === location.placeId);

    if (isDuplicate) {
      setFeedbackMessage('That location is already listed.');
      return;
    }

    const newCard: WeatherCard = {
      id: crypto.randomUUID(),
      query,
      location,
      data: null,
      isLoading: true,
      error: null,
    };

    setCards((prev) => [...prev, newCard]);
    setActiveCardId(newCard.id);
    fetchWeatherForCard(newCard.id, location.lat, location.lon);
    clearSearchInput();
    closeSearch({ restoreFocus: true });
  }

  /**
   * Marks a card as loading and re-fetches its weather using the current unit group.
   *
   * @param card - The weather card to refresh. Skipped if it has no location.
   */
  function refetchCard(card: WeatherCard): void {
    if (!card.location) return;

    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, isLoading: true, error: null } : c)),
    );
    fetchWeatherForCard(card.id, card.location.lat, card.location.lon);
  }

  /**
   * Re-fetches weather for the card with the given id using its stored coordinates.
   *
   * @param id - Weather card id to refresh.
   */
  function handleRefresh(id: string): void {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    refetchCard(card);
  }

  /**
   * Removes the weather card with the given id from the list.
   *
   * If the removed card was active, selects a neighbor by id (same slot, or the new last
   * card). Otherwise leaves `activeCardId` unchanged.
   *
   * @param id - Weather card id to remove.
   */
  function handleRemove(id: string): void {
    setCards((prev) => prev.filter((c) => c.id !== id));

    setActiveCardId((current) => {
      if (current !== id) return current; // removed a different card; keep selection

      // Active card was removed: pick a neighbor from the pre-remove list.
      const remaining = cards.filter((c) => c.id !== id);
      if (remaining.length === 0) return null;

      const removedAt = cards.findIndex((c) => c.id === id);
      // Prefer the card that slides into the same slot; otherwise the new last card.
      const next = remaining[Math.min(removedAt, remaining.length - 1)];
      return next.id;
    });
  }

  /**
   * Re-fetches every card when the user changes unit group.
   *
   * Depends only on unitGroup; cards are read from the render when the preference changes.
   */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    cards.forEach((card) => refetchCard(card));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when unitGroup changes, not when cards change
  }, [unitGroup]);

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

        {cards.length > 0 && (
          <div className="weather-cards">
            {cards.map((card) => (
              <WeatherDisplay
                key={card.id}
                card={card}
                isActive={card.id === activeCardId}
                onRefresh={handleRefresh}
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
