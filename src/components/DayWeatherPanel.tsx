/**
 * Presentational component for a single day's forecast fields in open-by-default
 * collapsible groups (Conditions, Precipitation, Atmospheric Conditions, Sun,
 * Air Quality), plus an hourly forecast details section.
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
  formatAqiUs,
  formatAqiEur,
  formatPollutant,
} from '../utils/units';
import { formatPrecipType, formatWindDir } from '../utils/forecastFormatter';
import { getFallbackWeatherIconSrc, getWeatherIconSrc } from '../utils/weatherIcon';
import { useUnitGroup } from '../hooks/useUnitGroup';
import type { DailyWeather } from '../types/weather';

type DayWeatherPanelProps = {
  day: DailyWeather;
  isActive: boolean; // Controls aria-hidden for inactive carousel slides
};

/** Air quality field keys used to decide whether the AQ section has any data. */
const AQ_FIELDS = [
  'aqius',
  'aqieur',
  'pm1',
  'pm2p5',
  'pm10',
  'o3',
  'no2',
  'so2',
  'co',
] as const satisfies readonly (keyof DailyWeather)[];

/**
 * Returns true when at least one air quality field is present on the day.
 *
 * @param day - Daily weather values for this slide.
 * @returns Whether the Air Quality section should render.
 */
function hasAirQualityData(day: DailyWeather): boolean {
  return AQ_FIELDS.some((key) => day[key] != null);
}

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
  const showAirQuality = hasAirQualityData(day);

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

      {showAirQuality ? (
        <details className="day-section day-section--air-quality" open>
          <summary>Air Quality</summary>
          <div className="day-section__body">
            {day.aqius != null && (
              <div className="aqi-us">
                <h3>US AQI:</h3>
                <span>{formatAqiUs(day.aqius)}</span>
              </div>
            )}

            {day.aqieur != null && (
              <div className="aqi-eur">
                <h3>European AQI:</h3>
                <span>{formatAqiEur(day.aqieur)}</span>
              </div>
            )}

            {day.pm1 != null && (
              <div className="pm1">
                <h3>{`PM1 (Particles < ~1 µm):`}</h3>
                <span>{formatPollutant(day.pm1)}</span>
              </div>
            )}

            {day.pm2p5 != null && (
              <div className="pm2p5">
                <h3>{`PM2.5 (Particles ≤ ~2.5 µm):`}</h3>
                <span>{formatPollutant(day.pm2p5)}</span>
              </div>
            )}

            {day.pm10 != null && (
              <div className="pm10">
                <h3>{`PM10 (Particles ≤ ~10 µm):`}</h3>
                <span>{formatPollutant(day.pm10)}</span>
              </div>
            )}

            {day.o3 != null && (
              <div className="o3">
                <h3>Ozone (O₃):</h3>
                <span>{formatPollutant(day.o3)}</span>
              </div>
            )}

            {day.no2 != null && (
              <div className="no2">
                <h3>Nitrogen Dioxide (NO₂):</h3>
                <span>{formatPollutant(day.no2)}</span>
              </div>
            )}

            {day.so2 != null && (
              <div className="so2">
                <h3>Sulphur Dioxide (SO₂):</h3>
                <span>{formatPollutant(day.so2)}</span>
              </div>
            )}

            {day.co != null && (
              <div className="co">
                <h3>Carbon Monoxide (CO):</h3>
                <span>{formatPollutant(day.co)}</span>
              </div>
            )}
          </div>
        </details>
      ) : null}

      {isActive ? <HourlyForecast hours={day.hours} /> : null}
    </div>
  );
}
