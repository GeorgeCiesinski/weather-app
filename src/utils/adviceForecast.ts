/**
 * Format daily and hourly forecasts for AI advice payloads, plus card overview text.
 */
import type { UnitGroup } from '../types/unitGroup';
import type { DailyWeather, HourlyWeather } from '../types/weather';
import type { SlimDayForecast, SlimHourForecast } from '../types/advice';
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
} from './units';
import { formatWindDir } from './forecastFormatter';

/**
 * Formats a number as a percent string.
 *
 * @param n - Number to format.
 * @returns Percent string.
 */
export function formatPercent(n: number): string {
  return `${n}%`;
}

/**
 * Maps present air quality fields on a day into pre-formatted slim keys.
 * Omits a key when the source value is null or undefined (VC ~5-day coverage).
 *
 * @param day - Raw daily weather data.
 * @returns Partial slim day fields for air quality only.
 */
export function slimAirQuality(day: DailyWeather): Partial<SlimDayForecast> {
  return {
    ...(day.aqius != null && { aqius: formatAqiUs(day.aqius) }),
    ...(day.aqieur != null && { aqieur: formatAqiEur(day.aqieur) }),
    ...(day.pm1 != null && { pm1: formatPollutant(day.pm1) }),
    ...(day.pm2p5 != null && { pm2p5: formatPollutant(day.pm2p5) }),
    ...(day.pm10 != null && { pm10: formatPollutant(day.pm10) }),
    ...(day.o3 != null && { o3: formatPollutant(day.o3) }),
    ...(day.no2 != null && { no2: formatPollutant(day.no2) }),
    ...(day.so2 != null && { so2: formatPollutant(day.so2) }),
    ...(day.co != null && { co: formatPollutant(day.co) }),
  };
}

/**
 * Maps an HourlyWeather hour into a SlimHourForecast with unit-formatted strings.
 *
 * @param hour - Raw hourly weather data.
 * @param unitGroup - Unit group used for temp, precip, and wind suffixes.
 * @returns Slim hour forecast for day-scope advice payloads.
 */
export function slimHour(hour: HourlyWeather, unitGroup: UnitGroup): SlimHourForecast {
  return {
    datetime: hour.datetime,
    conditions: hour.conditions,
    temp: formatTemp(hour.temp, unitGroup),
    feelslike: formatTemp(hour.feelslike, unitGroup),
    precipprob: formatPercent(hour.precipprob),
    precip: formatPrecip(hour.precip, unitGroup),
    preciptype: hour.preciptype ?? [],
    windspeed: formatWindSpeed(hour.windspeed, unitGroup),
    winddir: formatWindDir(hour.winddir),
  };
}

/**
 * Maps a DailyWeather day into a SlimDayForecast with unit-formatted strings.
 * Does not include hourly rows — use buildDayForecastDays for day-scope hours.
 * Solar radiation/energy use fixed units; UV index is unitless.
 * Air quality fields are omitted when absent (VC ~5-day coverage).
 *
 * @param day - Raw daily weather data.
 * @param unitGroup - Unit group for temp, precip, snow, wind, and visibility suffixes.
 * @returns Slim day forecast for advice payloads.
 */
export function slimDay(day: DailyWeather, unitGroup: UnitGroup): SlimDayForecast {
  return {
    datetime: day.datetime,
    conditions: day.conditions,
    temp: formatTemp(day.temp, unitGroup),
    tempmax: formatTemp(day.tempmax, unitGroup),
    tempmin: formatTemp(day.tempmin, unitGroup),
    feelslike: formatTemp(day.feelslike, unitGroup),
    feelslikemax: formatTemp(day.feelslikemax, unitGroup),
    feelslikemin: formatTemp(day.feelslikemin, unitGroup),
    precipprob: formatPercent(day.precipprob),
    precip: formatPrecip(day.precip, unitGroup),
    precipcover: formatPercent(day.precipcover),
    preciptype: day.preciptype,
    snow: formatSnow(day.snow, unitGroup),
    snowdepth: formatSnow(day.snowdepth, unitGroup),
    humidity: formatPercent(day.humidity),
    cloudcover: formatPercent(day.cloudcover),
    windspeed: formatWindSpeed(day.windspeed, unitGroup),
    visibility: formatVisibility(day.visibility, unitGroup),
    solarradiation: formatSolarRadiation(day.solarradiation),
    solarenergy: formatSolarEnergy(day.solarenergy),
    uvindex: formatUvIndex(day.uvindex),
    ...slimAirQuality(day),
  };
}

/**
 * Builds up to 5 slim day forecasts for location-scope advice asks.
 * Omits hourly data to keep multi-day context lean.
 *
 * @param days - Daily weather forecast data.
 * @param unitGroup - Unit group used for formatted suffixes.
 * @returns Slim day forecasts (at most 5) without hours.
 */
export function buildLocationForecastDays(
  days: DailyWeather[],
  unitGroup: UnitGroup,
): SlimDayForecast[] {
  return days.slice(0, 5).map((day) => slimDay(day, unitGroup));
}

/**
 * Builds a one-element slim day forecast array for day-scope advice asks,
 * including unit-formatted hourly rows when present.
 *
 * @param day - Single daily weather day.
 * @param unitGroup - Unit group used for formatted suffixes.
 * @returns Array containing one SlimDayForecast with hours.
 */
export function buildDayForecastDays(day: DailyWeather, unitGroup: UnitGroup): SlimDayForecast[] {
  return [
    {
      ...slimDay(day, unitGroup),
      hours: (day.hours ?? []).map((hour) => slimHour(hour, unitGroup)),
    },
  ];
}

/**
 * Builds overview text from the forecast description and active alert count.
 * Shown on the location card above Ask Advisor (not in the advisor chat).
 *
 * @param description - Multi-day weather overview; falls back to "Forecast loaded." when blank.
 * @param alertCount - Number of active severe weather alerts.
 * @returns Overview text, with an alert summary line appended when alertCount > 0.
 */
export function buildSeededAdviceText(description: string | undefined, alertCount: number): string {
  const overview = description?.trim() || 'Forecast loaded.';
  if (alertCount <= 0) return overview;
  const label = alertCount === 1 ? 'alert' : 'alerts';
  return `${overview}\n\n${alertCount} severe weather ${label} active.`;
}
