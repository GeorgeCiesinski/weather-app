/**
 * Location card with multi-day forecast carousel, Ask Advisor overlay, and refresh/remove controls.
 */
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { formatDayLabel } from '../utils/forecastFormatter';
import { buildSlimAlerts } from '../utils/alertSummary';
import {
  buildLocationForecastDays,
  buildDayForecastDays,
  buildSeededAdviceText,
} from '../utils/adviceForecast';
import { fetchAdvice } from '../api/adviceClient';
import { useUnitGroup } from '../hooks/useUnitGroup';
import { useWeatherQuery } from '../hooks/useWeatherQuery';
import WeatherAlertsPanel from './WeatherAlertsPanel';
import DayForecastCarousel from './DayForecastCarousel';
import AdviceAdvisorOverlay from './AdviceAdvisorOverlay';
import type { WeatherCard } from '../types/weather';
import type { AdviceMessage, AdviceScope } from '../types/advice';

type WeatherDisplayProps = {
  card: WeatherCard;
  onRemove: (id: string) => void;
  /**
   * When false on mobile/tablet, the card is hidden so only the active pager location shows.
   * A true → false transition also closes the Ask Advisor overlay for this card.
   */
  isActive?: boolean;
};

/**
 * Renders a location weather card with a multi-day forecast carousel.
 *
 * Advisor chat lives in a per-card overlay opened via Ask Advisor. Session history
 * is kept for UI display only and is not sent to the AI. The overlay closes when the
 * mobile pager leaves this card (`isActive` true → false). Day panels live in a memoized
 * DayForecastCarousel so advisor open/close does not re-render the day track.
 *
 * @param props - Component props.
 * @param props.card - Weather card location identity.
 * @param props.onRemove - Callback invoked with the card id when Remove is clicked.
 * @param props.isActive - When false on mobile/tablet, the card is hidden so only the active
 *   pager location shows. A true → false transition also closes the Ask Advisor overlay.
 * @returns The weather card UI.
 */
function WeatherDisplay({ card, onRemove, isActive = true }: WeatherDisplayProps) {
  // Identity
  const { id, query, location } = card;
  const locationLabel = location?.displayName ?? query;
  const { unitGroup } = useUnitGroup();

  // Weather is server state: Query loads/caches it by lat, lon, and unitGroup
  const lat = location?.lat ?? null;
  const lon = location?.lon ?? null;
  const {
    data, // WeatherData | undefined
    error, // Error | null
    isPending, // first load for this key, no data yet
    isFetching, // any network activity (first load or refresh)
    refetch, // manual Refresh
  } = useWeatherQuery(lat, lon, unitGroup);

  const {
    mutateAsync: requestAdvice,
    isPending: isAdviceLoading,
    error: adviceMutationError,
    reset: resetAdviceMutation,
  } = useMutation({ mutationFn: fetchAdvice });

  const adviceError =
    adviceMutationError instanceof Error
      ? adviceMutationError.message
      : adviceMutationError
        ? String(adviceMutationError)
        : null;

  const days = data?.days ?? [];
  // Query's error is unknown/Error-shaped; UI wants a string.
  const weatherError = error instanceof Error ? error.message : error ? String(error) : null;

  // Advisor state
  const advisorOverlayId = useId();
  const askAdvisorButtonRef = useRef<HTMLButtonElement>(null);
  // Shared with DayForecastCarousel (controlled) for advisor day scope + refresh reset.
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [prevIsActive, setPrevIsActive] = useState(isActive);
  const [history, setHistory] = useState<AdviceMessage[]>([]);
  const wasAdvisorOpenRef = useRef(false);

  const slimAlerts = buildSlimAlerts(data?.alerts ?? []);
  const seededText = buildSeededAdviceText(data?.description, slimAlerts.count);

  // Keep day index valid when the forecast list shrinks (render-time adjustment).
  const maxDayIndex = Math.max(days.length - 1, 0);
  if (days.length > 0 && selectedDayIndex > maxDayIndex) {
    setSelectedDayIndex(maxDayIndex);
  }

  const selectedDayLabel =
    days.length > 0 && days[selectedDayIndex]
      ? formatDayLabel(selectedDayIndex, days[selectedDayIndex].datetime)
      : 'Selected day';

  const handleSelectedDayChange = useCallback((index: number): void => {
    setSelectedDayIndex(index);
  }, []);

  // Restore focus to Ask Advisor after the overlay closes.
  useEffect(() => {
    if (wasAdvisorOpenRef.current && !isAdvisorOpen) {
      const frameId = requestAnimationFrame(() => {
        askAdvisorButtonRef.current?.focus({ preventScroll: true });
      });
      wasAdvisorOpenRef.current = false;
      return () => cancelAnimationFrame(frameId);
    }
    wasAdvisorOpenRef.current = isAdvisorOpen;
  }, [isAdvisorOpen]);

  // Close advisor when the mobile pager leaves this card (isActive true → false).
  if (isActive !== prevIsActive) {
    setPrevIsActive(isActive);
    if (!isActive && isAdvisorOpen) {
      setIsAdvisorOpen(false);
    }
  }

  /**
   * Clears chat history and advice error for this card.
   */
  function clearAdviceSession(): void {
    setHistory([]);
    resetAdviceMutation();
  }

  /**
   * Closes the advisor overlay without clearing session history.
   */
  const closeAdvisor = useCallback((): void => {
    setIsAdvisorOpen(false);
  }, []);

  /**
   * Asks the weather advisor for the given scope and question.
   *
   * Appends the user message to UI history immediately, then fetches advice and
   * appends the assistant reply on success. Does not send prior conversation turns
   * to the API. Early-returns when forecast data is missing, the question is blank,
   * a request is already in flight, or day scope lacks a valid day.
   *
   * @param scope - Whether the question targets the multi-day location window or a single day.
   * @param question - User or preset question text.
   */
  async function askAdvice(scope: AdviceScope, question: string): Promise<void> {
    const trimmed = question.trim();
    if (!data || !trimmed || isAdviceLoading) return;

    const locationName = location?.displayName ?? query;
    if (!locationName.trim()) return;

    if (scope === 'day' && !data.days[selectedDayIndex]) return;

    setHistory((prev) => [...prev, { role: 'user', content: trimmed }]);

    resetAdviceMutation(); // Clears previous error so UI isn't stuck on old failure

    const forecastDays =
      scope === 'location'
        ? buildLocationForecastDays(data.days, unitGroup)
        : buildDayForecastDays(data.days[selectedDayIndex], unitGroup);

    try {
      const answer = await requestAdvice({
        scope,
        location: locationName,
        question: trimmed,
        history: [],
        days: forecastDays,
        alerts: slimAlerts,
      });
      setHistory((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch {
      // Error is already on adviceMutationError.
    }
  }

  return (
    <div className={`weather-display${isActive ? ' weather-display--active' : ''}`}>
      <div className="card-actions">
        <button
          type="button"
          className="refresh-btn"
          onClick={() => {
            setSelectedDayIndex(0);
            setIsAdvisorOpen(false);
            clearAdviceSession();
            void refetch(); // local Query refetch
          }}
          disabled={isFetching}
        >
          {isFetching && data ? 'Refreshing...' : 'Refresh'}
        </button>
        <button
          type="button"
          className="remove-btn"
          onClick={() => onRemove(id)}
          aria-label={`Remove ${locationLabel}`}
        >
          x
        </button>
      </div>

      {location && <h2 className="location">{location.displayName}</h2>}

      {weatherError && <p className="error">{weatherError}</p>}
      {isPending && !data && <p>Loading weather for {locationLabel}...</p>}

      <div className="weather-display__body">
        {data && (
          <>
            {data.alerts?.length ? <WeatherAlertsPanel alerts={data.alerts} /> : null}

            <div className="ask-advisor">
              <p className="ask-advisor__overview">{seededText}</p>
              <button
                ref={askAdvisorButtonRef}
                type="button"
                className="ask-advisor-btn"
                id={`${advisorOverlayId}-trigger`}
                aria-expanded={isAdvisorOpen}
                aria-controls={advisorOverlayId}
                onClick={() => setIsAdvisorOpen(true)}
              >
                Ask Advisor
              </button>
              <p className="ask-advisor__hint">Choose a day first to ask advice for that day.</p>
            </div>

            <AdviceAdvisorOverlay
              id={advisorOverlayId}
              isOpen={isAdvisorOpen}
              locationName={locationLabel}
              dayLabel={selectedDayLabel}
              history={history}
              isLoading={isAdviceLoading}
              error={adviceError}
              onClose={closeAdvisor}
              onAsk={(scope, question) => void askAdvice(scope, question)}
              disabled={isAdviceLoading}
            />

            {days.length === 0 ? (
              <p>No forecast data available.</p>
            ) : (
              <DayForecastCarousel
                days={days}
                selectedDayIndex={selectedDayIndex}
                onSelectedDayChange={handleSelectedDayChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(WeatherDisplay);
