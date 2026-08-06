import { describe, expect, it } from 'vitest';
import { LOCATION_COORD_PRECISION, locationsMatch, roundCoord } from './locationIdentity';

describe('roundCoord', () => {
  it('rounds to LOCATION_COORD_PRECISION decimal places', () => {
    expect(LOCATION_COORD_PRECISION).toBe(4);
    expect(roundCoord(35.67623456)).toBe(35.6762);
    expect(roundCoord(-79.38321234)).toBe(-79.3832);
  });
});

describe('locationsMatch', () => {
  it('matches identical coordinates', () => {
    expect(locationsMatch({ lat: 35.6762, lon: 139.6503 }, { lat: 35.6762, lon: 139.6503 })).toBe(
      true,
    );
  });

  it('matches coordinates that only differ beyond 4 decimal places', () => {
    expect(
      locationsMatch({ lat: 35.67621, lon: 139.65031 }, { lat: 35.67624, lon: 139.65034 }),
    ).toBe(true);
  });

  it('does not match different cities', () => {
    expect(
      locationsMatch(
        { lat: 35.6762, lon: 139.6503 }, // Tokyo-ish
        { lat: 43.6532, lon: -79.3832 }, // Toronto-ish
      ),
    ).toBe(false);
  });

  it('returns false when either side is null or undefined', () => {
    const loc = { lat: 35.6762, lon: 139.6503 };
    expect(locationsMatch(null, loc)).toBe(false);
    expect(locationsMatch(loc, undefined)).toBe(false);
    expect(locationsMatch(null, undefined)).toBe(false);
  });

  it('returns false for non-finite coordinates', () => {
    expect(locationsMatch({ lat: NaN, lon: 0 }, { lat: 0, lon: 0 })).toBe(false);
    expect(locationsMatch({ lat: 1, lon: Infinity }, { lat: 1, lon: Infinity })).toBe(false);
  });
});
