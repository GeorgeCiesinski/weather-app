/**
 * Coordinate-based identity for geocoded locations (duplicate detection).
 *
 * Nominatim place_id is not a stable key across searches; lat/lon (rounded)
 * match the weather API basis and avoid display-name collisions (e.g. Springfield).
 */

/** Decimal places used when comparing lat/lon (~11 m at the equator). */
export const LOCATION_COORD_PRECISION = 4;

type CoordPair = {
  lat: number;
  lon: number;
};

/**
 * Rounds a coordinate to the precision used for location identity.
 *
 * @param value - Latitude or longitude in degrees.
 * @returns Rounded number at LOCATION_COORD_PRECISION.
 */
export function roundCoord(value: number): number {
  const factor = 10 ** LOCATION_COORD_PRECISION;
  return Math.round(value * factor) / factor;
}

/**
 * True when both locations share the same rounded latitude and longitude.
 *
 * @param a - First location (or null/undefined).
 * @param b - Second location (or null/undefined).
 * @returns Whether both have coords and they match after rounding.
 */
export function locationsMatch(
  a: CoordPair | null | undefined,
  b: CoordPair | null | undefined,
): boolean {
  if (a == null || b == null) return false;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) return false;
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return false;

  return roundCoord(a.lat) === roundCoord(b.lat) && roundCoord(a.lon) === roundCoord(b.lon);
}
