/**
 * Windowed multi-day forecast carousel: mounts selected day ±1.
 * Day index is controlled by the parent so refresh/advisor can share selection without effects.
 */
import { memo } from 'react';
import { formatDayLabel } from '../utils/forecastFormatter';
import DayWeatherPanel from './DayWeatherPanel';
import type { DailyWeather } from '../types/weather';

type DayForecastCarouselProps = {
  days: DailyWeather[];
  selectedDayIndex: number;
  onSelectedDayChange: (index: number) => void;
};

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
  if (days.length === 0) return null;

  const safeIndex = Math.min(Math.max(selectedDayIndex, 0), days.length - 1);

  const windowIndices: number[] = [];
  if (safeIndex > 0) windowIndices.push(safeIndex - 1);
  windowIndices.push(safeIndex);
  if (safeIndex < days.length - 1) windowIndices.push(safeIndex + 1);

  // Within a 2–3 slot track, place the current day under the viewport.
  const activeSlotIndex = safeIndex > 0 ? 1 : 0;

  return (
    <div className="day-carousel">
      <div className="day-nav">
        <button
          type="button"
          className="day-nav-btn"
          onClick={() => onSelectedDayChange(safeIndex - 1)}
          disabled={safeIndex === 0}
          aria-label="Previous day"
        >
          {'<'}
        </button>

        <span className="day-label">{formatDayLabel(safeIndex, days[safeIndex].datetime)}</span>

        <button
          type="button"
          className="day-nav-btn"
          onClick={() => onSelectedDayChange(safeIndex + 1)}
          disabled={safeIndex === days.length - 1}
          aria-label="Next day"
        >
          {'>'}
        </button>
      </div>

      <div className="day-viewport">
        <div
          className="day-track"
          style={{ '--day-index': activeSlotIndex } as React.CSSProperties}
        >
          {windowIndices.map((index) => {
            const day = days[index];
            const isActive = index === safeIndex;
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
