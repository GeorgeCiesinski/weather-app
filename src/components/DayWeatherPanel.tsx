/**
 * Presentational component for a single day's forecast fields in open-by-default
 * collapsible groups (Conditions, Precipitation, Atmospheric Conditions, Sun),
 * plus an hourly forecast details section.
 */
import WindDirectionArrow from './WindDirectionArrow';
import HourlyForecast from './HourlyForecast';
import {
  formatTemp,
  formatPrecip,
  formatSnow,
  formatWindSpeed,
  formatSolarRadiation,
  formatSolarEnergy,
  formatVisibility,
  formatUvIndex,
} from '../utils/units';
import { formatPrecipType, formatWindDir } from '../utils/forecastFormatter';
import { getFallbackWeatherIconSrc, getWeatherIconSrc } from '../utils/weatherIcon';
import { useUnitGroup } from '../hooks/useUnitGroup';
import type { DailyWeather } from '../types/weather';

type DayWeatherPanelProps = {
  day: DailyWeather;
  isActive: boolean; // Controls aria-hidden for inactive carousel slides
};

/**
 * Renders one day's forecast fields and hourly details.
 *
 * @param props - Component props.
 * @param props.day - Daily weather values for this slide.
 * @param props.isActive - When false, the slide is aria-hidden (inactive carousel slide).
 * @returns The day forecast panel UI.
 */
export default function DayWeatherPanel({ day, isActive }: DayWeatherPanelProps) {
  const { unitGroup } = useUnitGroup();

  return (
    <div className="day-weather-panel" aria-hidden={!isActive}>
      <div className="icon-wrapper">
        <img
          className="weather-icon"
          src={getWeatherIconSrc(day.icon)}
          alt={day.conditions}
          onError={(e) => {
            e.currentTarget.src = getFallbackWeatherIconSrc();
          }}
        />
      </div>

      <details className="day-section day-section--conditions" open>
        <summary>Conditions</summary>
        <div className="day-section__body">
          <div className="conditions">
            <span>{day.conditions}</span>
          </div>

          <div className="temperature">
            <h3>Temperature:</h3>
            <span>
              {formatTemp(day.temp, unitGroup)} (Max: {formatTemp(day.tempmax, unitGroup)} / Min:{' '}
              {formatTemp(day.tempmin, unitGroup)})
            </span>
          </div>

          <div className="feels-like">
            <h3>Feels like:</h3>
            <span>
              {formatTemp(day.feelslike, unitGroup)} (Max: {formatTemp(day.feelslikemax, unitGroup)}{' '}
              / Min: {formatTemp(day.feelslikemin, unitGroup)})
            </span>
          </div>
        </div>
      </details>

      <details className="day-section day-section--precipitation" open>
        <summary>Precipitation</summary>
        <div className="day-section__body">
          <div className="precipitation">
            <h3>Precipitation Type and Probability:</h3>
            <span>
              {day.precipprob}% chance of{' '}
              {day.preciptype === null
                ? 'Precipitation (type unknown)'
                : formatPrecipType(day.preciptype)}
            </span>
          </div>

          {day.precip > 0 && (
            <div className="precipitation-amount">
              <h3>Precipitation Amount:</h3>
              <span>{formatPrecip(day.precip, unitGroup)}</span>
            </div>
          )}

          {day.precipcover > 0 && (
            <div className="precipitation-cover">
              <h3>Proportion of Day it May Precipitate:</h3>
              <span>{day.precipcover}%</span>
            </div>
          )}

          {day.snow > 0 && (
            <div className="snow-today">
              <h3>Snowfall:</h3>
              <span>{formatSnow(day.snow, unitGroup)}</span>
            </div>
          )}

          {day.snowdepth > 0 && (
            <div className="snow-depth">
              <h3>Snow on Ground:</h3>
              <span>{formatSnow(day.snowdepth, unitGroup)}</span>
            </div>
          )}

          <div className="humidity">
            <h3>Humidity:</h3>
            <span>{day.humidity}%</span>
          </div>
        </div>
      </details>

      <details className="day-section day-section--atmospheric" open>
        <summary>Atmospheric Conditions</summary>
        <div className="day-section__body">
          <div className="wind-info">
            <h3>Wind Speed & Direction</h3>
            <div className="wind-info__content">
              <WindDirectionArrow degrees={day.winddir} className="wind-direction-arrow" />
              <span>
                {formatWindSpeed(day.windspeed, unitGroup)} {formatWindDir(day.winddir)}
              </span>
            </div>
          </div>

          <div className="cloud-cover">
            <h3>Cloud Cover:</h3>
            <span>{day.cloudcover}%</span>
          </div>

          <div className="visibility">
            <h3>Visibility:</h3>
            <span>{formatVisibility(day.visibility, unitGroup)}</span>
          </div>
        </div>
      </details>

      <details className="day-section day-section--sun" open>
        <summary>Sun</summary>
        <div className="day-section__body">
          <div className="uv-index">
            <h3>UV Index:</h3>
            <span>{formatUvIndex(day.uvindex)}</span>
          </div>

          <div className="solar-radiation">
            <h3>Solar Radiation:</h3>
            <span>{formatSolarRadiation(day.solarradiation)}</span>
          </div>

          <div className="solar-energy">
            <h3>Solar Energy:</h3>
            <span>{formatSolarEnergy(day.solarenergy)}</span>
          </div>
        </div>
      </details>

      {isActive ? <HourlyForecast hours={day.hours} /> : null}
    </div>
  );
}
