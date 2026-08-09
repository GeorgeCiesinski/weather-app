/**
 * Fetches weather for one lat/lon + unitGroup via TanStack Query.
 *
 * Cache identity is the queryKey: different places or units = different entries.
 * Switching units and back reuses the other key while it remains in the cache.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchWeatherByCoords } from '../api/weatherClient';
import type { UnitGroup } from '../types/unitGroup';

/**
 * Subscribe to weather for coordinates in the current unit group.
 *
 * @param lat - Latitude, or null when the card has no location yet.
 * @param lon - Longitude, or null when the card has no location yet.
 * @param unitGroup - Active unit group (part of the cache key).
 */
export function useWeatherQuery(lat: number | null, lon: number | null, unitGroup: UnitGroup) {
  return useQuery({
    // Identity of server data.
    queryKey: ['weather', lat, lon, unitGroup],
    // How to load it when needed and missing/stale.
    queryFn: () => fetchWeatherByCoords(lat!, lon!, unitGroup),
    // Don't run until we have coords.
    enabled: lat != null && lon != null,
  });
}
