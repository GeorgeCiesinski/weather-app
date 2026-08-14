/**
 * Vercel serverless handler that proxies weather requests to Visual Crossing.
 *
 * Validates input, attaches the API key server-side, and returns weather JSON.
 */
import { UNIT_GROUPS } from '../src/types/unitGroup.js';
import type { UnitGroup } from '../src/types/unitGroup';
import { enforceRateLimit, type RateLimitRequest } from './rateLimit';

const BASE_URL =
  'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline';

type WeatherRequest = RateLimitRequest & {
  method?: string;
  query: {
    lat?: string;
    lon?: string;
    unitGroup?: string;
  };
};

type WeatherResponse = {
  status: (code: number) => WeatherResponse;
  json: (body: unknown) => WeatherResponse;
};

/**
 * Parses a coordinate query param into a finite number inside [min, max].
 */
export function parseCoord(raw: string | undefined, min: number, max: number): number | null {
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

/**
 * Validates a unit group string and returns a safe UnitGroup value.
 *
 * @param selected - Raw unit group from a query string or user input.
 * @returns A valid unit group, or 'metric' when selected is missing or invalid.
 */
export function validateUnitGroup(selected: string | undefined): UnitGroup {
  if (selected && UNIT_GROUPS.includes(selected as UnitGroup)) {
    return selected as UnitGroup;
  }
  return 'metric';
}

/**
 * Handles incoming weather API requests from the frontend.
 *
 * @param req - The incoming request with lat, lon, and optional unitGroup query parameters.
 * @param res - The response object used to send status codes and JSON.
 * @returns A JSON response with weather data or an error message.
 */
export default async function handler(req: WeatherRequest, res: WeatherResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limited = await enforceRateLimit(req, 'weather');
  if (!limited.ok) {
    return res.status(limited.status).json({ error: limited.error });
  }

  // Whitelist and default unit group before forwarding to Visual Crossing.
  const unitGroup = validateUnitGroup(req.query.unitGroup);

  const lat = parseCoord(req.query.lat, -90, 90);
  const lon = parseCoord(req.query.lon, -180, 180);

  if (lat === null || lon === null) {
    return res.status(400).json({
      error: 'Latitude and longitude are required',
    });
  }

  const apiKey = process.env.WEATHER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured',
    });
  }

  // Air quality is not in the default Timeline payload; + prefix adds elements.
  const aqElements =
    '%2Baqius%2C%2Baqieur%2C%2Bpm1%2C%2Bpm2p5%2C%2Bpm10%2C%2Bo3%2C%2Bno2%2C%2Bso2%2C%2Bco';
  const url = `${BASE_URL}/${lat},${lon}?unitGroup=${unitGroup}&key=${apiKey}&contentType=json&elements=${aqElements}`;

  const response = await fetch(url);

  if (!response.ok) {
    return res.status(response.status).json({
      error: `Upstream weather request failed (${response.status})`,
    });
  }

  const data = await response.json();

  return res.status(200).json(data);
}
