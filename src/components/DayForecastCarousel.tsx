/**
 * Windowed multi-day forecast carousel: mounts selected day ±1.
 * Day index is controlled by the parent so refresh/advisor can share selection without effects.
 *
 * Swipe uses a 2–3 slide track. After leaving day 0 the active slot stays at 1, so navigation
 * animates the slot first (1→2 or 1→0), then recenters the window with transitions disabled.
 */
import { memo, useEffect, useLayoutEffect, useState } from 'react';
import type { CSSProperties, TransitionEvent } from 'react';
import { formatDayLabel } from '../utils/forecastFormatter';
import DayWeatherPanel from './DayWeatherPanel';
import type { DailyWeather } from '../types/weather';

type DayForecastCarouselProps = {
  days: DailyWeather[];
  selectedDayIndex: number;
  onSelectedDayChange: (index: number) => void;
};

type AnimDirection = 'next' | 'prev' | null;

/** Matches `.day-track` transition duration; used as a transitionend safety net. */
const DAY_TRACK_TRANSITION_MS = 250;
const ANIM_FALLBACK_MS = DAY_TRACK_TRANSITION_MS + 50;

/**
 * Renders prev/next day navigation and a track with at most three day slides.
 *
 * @param props - Component props.
 * @returns The day carousel UI, or null when days is empty.
 */
function DayForecastCarousel({
  days,
  selectedDayIndex,
  onSelectedDayChange,
}: DayForecastCarouselProps) {
  // Track center used to build the ±1 window while animating.
  const [trackIndex, setTrackIndex] = useState(selectedDayIndex);
  const [slotIndex, setSlotIndex] = useState(selectedDayIndex > 0 ? 1 : 0);
  const [skipTransition, setSkipTransition] = useState(false);
  const [animDirection, setAnimDirection] = useState<AnimDirection>(null);

  const animating = animDirection !== null;

  // Sync when parent changes selection outside our animation (e.g. refresh reset).
  useEffect(() => {
    if (animating) return;
    setTrackIndex(selectedDayIndex);
    setSlotIndex(selectedDayIndex > 0 ? 1 : 0);
  }, [selectedDayIndex, animating]);

  // After a no-transition recenter, re-enable transitions on the next frame.
  useLayoutEffect(() => {
    if (!skipTransition) return;
    const frameId = requestAnimationFrame(() => {
      setSkipTransition(false);
    });
    return () => cancelAnimationFrame(frameId);
  }, [skipTransition]);

  const safeTrackIndex =
    days.length === 0 ? 0 : Math.min(Math.max(trackIndex, 0), days.length - 1);

  const windowIndices: number[] = [];
  if (days.length > 0) {
    if (safeTrackIndex > 0) windowIndices.push(safeTrackIndex - 1);
    windowIndices.push(safeTrackIndex);
    if (safeTrackIndex < days.length - 1) windowIndices.push(safeTrackIndex + 1);
  }

  const recenterToIndex = (nextIndex: number): void => {
    setSkipTransition(true);
    setTrackIndex(nextIndex);
    setSlotIndex(nextIndex > 0 ? 1 : 0);
    setAnimDirection(null);
  };

  // If transitionend is skipped (e.g. click during skipTransition), unlock controls.
  useEffect(() => {
    if (!animDirection) return;
    const timerId = window.setTimeout(() => {
      recenterToIndex(selectedDayIndex);
    }, ANIM_FALLBACK_MS);
    return () => window.clearTimeout(timerId);
  }, [animDirection, selectedDayIndex]);

  if (days.length === 0) return null;

  const canGoPrev = selectedDayIndex > 0 && !animating;
  const canGoNext = selectedDayIndex < days.length - 1 && !animating;

  const commitInstant = (nextIndex: number): void => {
    onSelectedDayChange(nextIndex);
    recenterToIndex(nextIndex);
  };

  const handlePrev = (): void => {
    if (!canGoPrev) return;
    const nextIndex = safeTrackIndex - 1;

    // Clicks during the post-animation recenter frame would snap with no transitionend.
    if (skipTransition) {
      commitInstant(nextIndex);
      return;
    }

    setAnimDirection('prev');
    setSlotIndex(0);
    onSelectedDayChange(nextIndex);
  };

  const handleNext = (): void => {
    if (!canGoNext) return;
    const nextIndex = safeTrackIndex + 1;

    if (skipTransition) {
      commitInstant(nextIndex);
      return;
    }

    setAnimDirection('next');
    // Day 0 track is [0,1] with slot 0 → animate to 1.
    // Later days are [i-1,i,i+1] with slot 1 → animate to 2.
    setSlotIndex(safeTrackIndex === 0 ? 1 : 2);
    onSelectedDayChange(nextIndex);
  };

  const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
    if (!animDirection) return;

    const nextIndex =
      animDirection === 'next' ? safeTrackIndex + 1 : Math.max(safeTrackIndex - 1, 0);

    recenterToIndex(nextIndex);
  };

  return (
    <div className="day-carousel">
      <div className="day-nav">
        <button
          type="button"
          className="day-nav-btn"
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Previous day"
        >
          {'<'}
        </button>

        <span className="day-label">
          {formatDayLabel(selectedDayIndex, days[selectedDayIndex].datetime)}
        </span>

        <button
          type="button"
          className="day-nav-btn"
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Next day"
        >
          {'>'}
        </button>
      </div>

      <div className="day-viewport">
        <div
          className="day-track"
          style={
            {
              '--day-index': slotIndex,
              ...(skipTransition ? { transition: 'none' } : null),
            } as CSSProperties
          }
          onTransitionEnd={handleTransitionEnd}
        >
          {windowIndices.map((index) => {
            const day = days[index];
            const isActive = index === selectedDayIndex;
            return (
              <div className="day-slide" key={day.datetime} inert={isActive ? undefined : true}>
                <DayWeatherPanel day={day} isActive={isActive} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(DayForecastCarousel);
