/**
 * Allowlists and size-caps AdviceRequest fields before they are sent to the model.
 */
import type { SlimAlert, SlimAlerts, SlimDayForecast, SlimHourForecast } from '../src/types/advice';

export const MAX_LOCATION_LENGTH = 200;
export const MAX_DAY_STRING_LENGTH = 120;
export const MAX_DATETIME_LENGTH = 32;
export const MAX_PRECIP_TYPES = 4;
export const MAX_PRECIP_TYPE_LENGTH = 32;
export const MAX_HOURS = 24;
export const MAX_ALERTS = 20;
export const MAX_ALERT_EVENT_LENGTH = 120;
export const MAX_ALERT_HEADLINE_LENGTH = 200;
export const MAX_ALERT_SUMMARY_LENGTH = 400;
export const MAX_ALERT_TIME_LENGTH = 48;

const DAY_STRING_KEYS = [
  'datetime',
  'conditions',
  'temp',
  'tempmax',
  'tempmin',
  'feelslike',
  'feelslikemax',
  'feelslikemin',
  'precipprob',
  'precip',
  'precipcover',
  'snow',
  'snowdepth',
  'humidity',
  'cloudcover',
  'windspeed',
  'solarradiation',
  'solarenergy',
  'uvindex',
  'visibility',
] as const;

const OPTIONAL_AQ_KEYS = [
  'aqius',
  'aqieur',
  'pm1',
  'pm2p5',
  'pm10',
  'o3',
  'no2',
  'so2',
  'co',
] as const;

const HOUR_STRING_KEYS = [
  'datetime',
  'conditions',
  'temp',
  'feelslike',
  'precipprob',
  'precip',
  'windspeed',
  'winddir',
] as const;

/**
 * Returns a trimmed string when value is a string within maxLen; otherwise null.
 */
function boundedString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

/**
 * Allowlisted preciptype entries, or null when the field is invalid or too large.
 * Missing or null (Visual Crossing dry days) is treated as an empty list.
 */
function sanitizePrecipType(value: unknown): string[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_PRECIP_TYPES) return null;
  const types: string[] = [];
  for (const item of value) {
    const entry = boundedString(item, MAX_PRECIP_TYPE_LENGTH);
    if (entry === null) return null;
    types.push(entry);
  }
  return types;
}

/**
 * Allowlists a single slim hour row.
 *
 * @param raw - Unknown hour object from the request body.
 * @returns A SlimHourForecast, or null when invalid or over cap.
 */
function sanitizeHour(raw: unknown): SlimHourForecast | null {
  if (!raw || typeof raw !== 'object') return null;
  const hour = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of HOUR_STRING_KEYS) {
    const maxLen = key === 'datetime' ? MAX_DATETIME_LENGTH : MAX_DAY_STRING_LENGTH;
    const value = boundedString(hour[key], maxLen);
    if (value === null) return null;
    out[key] = value;
  }
  const preciptype = sanitizePrecipType(hour.preciptype);
  if (preciptype === null) return null;
  out.preciptype = preciptype;
  return out as SlimHourForecast;
}

/**
 * Allowlists a single slim day. Hours are copied only when allowHours is true.
 *
 * @param raw - Unknown day object from the request body.
 * @param allowHours - True for day scope; location scope never includes hours.
 * @returns A SlimDayForecast, or null when invalid or over cap.
 */
function sanitizeDay(raw: unknown, allowHours: boolean): SlimDayForecast | null {
  if (!raw || typeof raw !== 'object') return null;
  const day = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const key of DAY_STRING_KEYS) {
    const maxLen = key === 'datetime' ? MAX_DATETIME_LENGTH : MAX_DAY_STRING_LENGTH;
    const value = boundedString(day[key], maxLen);
    if (value === null) return null;
    out[key] = value;
  }

  const preciptype = sanitizePrecipType(day.preciptype);
  if (preciptype === null) return null;
  out.preciptype = preciptype;

  for (const key of OPTIONAL_AQ_KEYS) {
    if (day[key] === undefined) continue;
    const value = boundedString(day[key], MAX_DAY_STRING_LENGTH);
    if (value === null) return null;
    out[key] = value;
  }

  if (allowHours) {
    if (day.hours === undefined) {
      return out as SlimDayForecast;
    }
    if (!Array.isArray(day.hours) || day.hours.length > MAX_HOURS) return null;
    const hours: SlimHourForecast[] = [];
    for (const hour of day.hours) {
      const sanitized = sanitizeHour(hour);
      if (sanitized === null) return null;
      hours.push(sanitized);
    }
    out.hours = hours;
  }

  return out as SlimDayForecast;
}

/**
 * Copies only slim day fields. Location scope never includes hours (even if sent).
 *
 * @param days - Raw days array from the request body.
 * @param scope - Location (at most 5 days) or day (exactly 1 day).
 * @returns Sanitized days, or null when the payload is invalid or over cap.
 */
export function sanitizeDays(days: unknown, scope: 'location' | 'day'): SlimDayForecast[] | null {
  if (!Array.isArray(days) || days.length === 0) return null;
  if (scope === 'location' && days.length > 5) return null;
  if (scope === 'day' && days.length !== 1) return null;
  const allowHours = scope === 'day';
  const sanitized: SlimDayForecast[] = [];
  for (const day of days) {
    const next = sanitizeDay(day, allowHours);
    if (next === null) return null;
    sanitized.push(next);
  }
  return sanitized;
}

/**
 * Allowlists a single slim alert.
 *
 * @param raw - Unknown alert object from the request body.
 * @returns A SlimAlert, or null when invalid or over cap.
 */
function sanitizeAlert(raw: unknown): SlimAlert | null {
  if (!raw || typeof raw !== 'object') return null;
  const alert = raw as Record<string, unknown>;
  const summary = boundedString(alert.summary, MAX_ALERT_SUMMARY_LENGTH);

  if (summary === null) return null;
  const out: SlimAlert = { summary };
  if (alert.event !== undefined) {
    const event = boundedString(alert.event, MAX_ALERT_EVENT_LENGTH);
    if (event === null) return null;
    out.event = event;
  }

  if (alert.headline !== undefined) {
    const headline = boundedString(alert.headline, MAX_ALERT_HEADLINE_LENGTH);
    if (headline === null) return null;
    out.headline = headline;
  }

  if (alert.onset !== undefined) {
    const onset = boundedString(alert.onset, MAX_ALERT_TIME_LENGTH);
    if (onset === null) return null;
    out.onset = onset;
  }

  if (alert.ends !== undefined) {
    const ends = boundedString(alert.ends, MAX_ALERT_TIME_LENGTH);
    if (ends === null) return null;
    out.ends = ends;
  }

  return out;
}

/**
 * Allowlists slim alerts. count must equal alerts.length.
 *
 * @param alerts - Raw alerts object from the request body.
 * @returns Sanitized SlimAlerts, or null when invalid or over cap.
 */
export function sanitizeAlerts(alerts: unknown): SlimAlerts | null {
  if (!alerts || typeof alerts !== 'object') return null;

  const raw = alerts as { count?: unknown; alerts?: unknown };
  if (typeof raw.count !== 'number' || !Number.isInteger(raw.count) || !Array.isArray(raw.alerts)) {
    return null;
  }

  if (raw.count !== raw.alerts.length || raw.alerts.length > MAX_ALERTS) return null;

  const list: SlimAlert[] = [];
  for (const item of raw.alerts) {
    const next = sanitizeAlert(item);
    if (next === null) return null;
    list.push(next);
  }

  return { count: list.length, alerts: list };
}
