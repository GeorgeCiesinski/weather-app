/**
 * Functions for formatting units used in forecast data.
 *
 * Temp, precip, snow, wind, and visibility append unitGroup-specific suffixes.
 * Solar radiation and energy use fixed Visual Crossing units (W/m², MJ/m²).
 * UV index is unitless and formatted without a suffix.
 * Air quality pollutants use µg/m³; US/EU AQI include category labels.
 */
import { UnitGroup } from '../types/unitGroup';

/** Display temperature suffixes keyed by Visual Crossing unitGroup. */
const TEMP_SUFFIX: Record<UnitGroup, string> = {
  metric: '°C',
  us: '°F',
  uk: '°C',
  base: ' K',
};

/**
 * Formats a temperature value with the suffix for the active unit group.
 *
 * @param value - Temperature number as returned by the API.
 * @param unitGroup - Active unit group used for the current fetch.
 * @returns Formatted string.
 */
export function formatTemp(value: number, unitGroup: UnitGroup): string {
  return `${value}${TEMP_SUFFIX[unitGroup]}`;
}

/** Display precipitation suffixes keyed by Visual Crossing unitGroup. */
const PRECIP_SUFFIX: Record<UnitGroup, string> = {
  metric: 'mm',
  us: 'in',
  uk: 'mm',
  base: 'mm',
};

/**
 * Formats a precipitation value with the suffix for the active unit group.
 *
 * @param value - Precipitation number as returned by the API.
 * @param unitGroup - Active unit group used for the current fetch.
 * @returns Formatted string.
 */
export function formatPrecip(value: number, unitGroup: UnitGroup): string {
  return `${value}${PRECIP_SUFFIX[unitGroup]}`;
}

/** Display Snow suffixes keyed by Visual Crossing unitGroup. */
const SNOW_SUFFIX: Record<UnitGroup, string> = {
  metric: 'cm',
  us: 'in',
  uk: 'cm',
  base: 'cm',
};

/**
 * Formats a snow value with the suffix for the active unit group.
 *
 * @param value - Snow number as returned by the API.
 * @param unitGroup - Active unit group used for the current fetch.
 * @returns Formatted string.
 */
export function formatSnow(value: number, unitGroup: UnitGroup): string {
  return `${value}${SNOW_SUFFIX[unitGroup]}`;
}

/** Display windspeed suffixes keyed by Visual Crossing unitGroup. */
const WIND_SUFFIX: Record<UnitGroup, string> = {
  metric: ' km/h',
  us: ' MPH',
  uk: ' MPH',
  base: ' m/s',
};

/**
 * Formats a wind speed value with the suffix for the active unit group.
 *
 * @param value - Wind speed number as returned by the API.
 * @param unitGroup - Active unit group used for the current fetch.
 * @returns Formatted string.
 */
export function formatWindSpeed(value: number, unitGroup: UnitGroup): string {
  return `${value}${WIND_SUFFIX[unitGroup]}`;
}

/**
 * Formats solar radiation (always W/m² from Visual Crossing).
 *
 * @param value - Solar radiation in W/m².
 * @returns Formatted string.
 */
export function formatSolarRadiation(value: number): string {
  return `${value} W/m²`;
}

/**
 * Formats solar energy (always MJ/m² from Visual Crossing).
 *
 * @param value - Solar energy in MJ/m².
 * @returns Formatted string.
 */
export function formatSolarEnergy(value: number): string {
  return `${value} MJ/m²`;
}

/** Display visibility suffixes keyed by Visual Crossing unitGroup. */
const VISIBILITY_SUFFIX: Record<UnitGroup, string> = {
  metric: ' km',
  us: ' mi',
  uk: ' mi',
  base: ' km',
};

/**
 * Formats a visibility value with the suffix for the active unit group.
 *
 * @param value - Visibility number as returned by the API (km or mi).
 * @param unitGroup - Active unit group used for the current fetch.
 * @returns Formatted string.
 */
export function formatVisibility(value: number, unitGroup: UnitGroup): string {
  return `${value}${VISIBILITY_SUFFIX[unitGroup]}`;
}

/**
 * Formats a UV index value (unitless; typically 0–10+).
 *
 * @param value - UV index number as returned by the API.
 * @returns Formatted string without a unit suffix.
 */
export function formatUvIndex(value: number): string {
  return `${value}`;
}

/**
 * Maps a US EPA AQI value to its category label.
 *
 * @param value - US AQI as returned by the API (typically 0–300+).
 * @returns EPA category name.
 */
function aqiUsCategory(value: number): string {
  if (value <= 50) return 'Good';
  if (value <= 100) return 'Moderate';
  if (value <= 150) return 'Unhealthy for Sensitive Groups';
  if (value <= 200) return 'Unhealthy';
  if (value <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/**
 * Formats a US AQI value with its EPA category.
 *
 * @param value - US EPA AQI number as returned by the API.
 * @returns Formatted string, e.g. "42 (Good)".
 */
export function formatAqiUs(value: number): string {
  return `${value} (${aqiUsCategory(value)})`;
}

/** European AQI labels keyed by index level 1–6. */
const AQI_EUR_LABELS: Record<number, string> = {
  1: 'Very Low',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Very High',
  6: 'Extremely High',
};

/**
 * Formats a European AQI value with a short severity label.
 *
 * @param value - European AQI number as returned by the API (1–6).
 * @returns Formatted string, e.g. "2 (Low)".
 */
export function formatAqiEur(value: number): string {
  const label = AQI_EUR_LABELS[value];
  return label ? `${value} (${label})` : `${value}`;
}

/**
 * Formats a pollutant concentration (always µg/m³ from Visual Crossing).
 *
 * @param value - Pollutant amount in µg/m³.
 * @returns Formatted string.
 */
export function formatPollutant(value: number): string {
  return `${value} µg/m³`;
}
