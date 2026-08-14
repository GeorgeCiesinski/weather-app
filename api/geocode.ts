/**
 * Vercel serverless handler that proxies location requests to Nominatim.
 *
 * GET only. Rate-limits by IP, caps the free-form query q, and returns up to
 * the limit of locations.
 */
import type { LocationResult } from '../src/types/location';
import { enforceRateLimit, type RateLimitRequest } from './rateLimit.js';

const BASE_URL = 'https://nominatim.openstreetmap.org/search';

const MAX_QUERY_LENGTH = 200;

type LocationRequest = RateLimitRequest & {
  method?: string;
  query: {
    q?: string;
  };
};

type GeocodeResponse = {
  status: (code: number) => GeocodeResponse;
  json: (body: unknown) => GeocodeResponse;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

/**
 * Handles incoming location API requests from the frontend.
 *
 * Allows GET only, enforces the geocode rate limit, and rejects empty or
 * oversized q before calling Nominatim.
 *
 * @param req - The incoming request containing the q (location) query parameter.
 * @param res - The response object used to send status codes and JSON.
 * @returns A JSON response with location data or an error message.
 */
export default async function handler(req: LocationRequest, res: GeocodeResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limited = await enforceRateLimit(req, 'geocode');
  if (!limited.ok) {
    return res.status(limited.status).json({ error: limited.error });
  }

  const q = req.query.q?.trim();

  if (!q) {
    return res.status(400).json({
      error: 'Location is required',
    });
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      error: 'Location is too long',
    });
  }

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    'accept-language': 'en',
  });

  const url = `${BASE_URL}?${params}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'GaleSage/1.0' },
  });

  if (!response.ok) {
    return res.status(response.status).json({
      error: `Upstream location request failed (${response.status})`,
    });
  }

  const data = (await response.json()) as NominatimResult[];
  const results: LocationResult[] = data.map((item) => ({
    placeId: String(item.place_id),
    displayName: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
  }));

  return res.status(200).json(results);
}
