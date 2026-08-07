import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { validateUnitGroup } from './weather';

// Creates the small part of Vercel's response object that the handler uses.
function createMockResponse() {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };

  return res;
}

describe('validateUnitGroup', () => {
  it.each(['metric', 'us', 'uk', 'base'] as const)(
    'returns %s when given a valid unit group',
    (group) => {
      expect(validateUnitGroup(group)).toBe(group);
    },
  );

  it('returns metric when selected is undefined', () => {
    expect(validateUnitGroup(undefined)).toBe('metric');
  });

  it('returns metric when selected is an empty string', () => {
    expect(validateUnitGroup('')).toBe('metric');
  });

  it('returns metric when selected is not a valid unit group', () => {
    expect(validateUnitGroup('invalid')).toBe('metric');
  });
});

describe('weather API handler', () => {
  const originalApiKey = process.env.WEATHER_API_KEY;

  // Replaces the real network layer before every test.
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  // Restores environment variables and mocks so tests do not affect each other.
  afterEach(() => {
    process.env.WEATHER_API_KEY = originalApiKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns 400 when lat or lon is missing', async () => {
    const req = {
      query: {
        lat: '51.5074',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Latitude and longitude are required',
    });
  });

  it('returns 500 when the API key is not configured', async () => {
    delete process.env.WEATHER_API_KEY;

    const req = {
      query: {
        lat: '51.5074',
        lon: '-0.1278',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'API key not configured',
    });
  });

  it('calls Visual Crossing with coordinates and API key', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ resolvedAddress: 'London, UK' }),
    } as unknown as Response);

    const req = {
      query: {
        lat: '51.5074',
        lon: '-0.1278',
        unitGroup: 'us',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    // Checks that the proxy builds the Visual Crossing request without leaking the key to the client.
    expect(global.fetch).toHaveBeenCalledWith(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/51.5074,-0.1278?unitGroup=us&key=test-api-key&contentType=json&elements=%2Baqius%2C%2Baqieur%2C%2Bpm1%2C%2Bpm2p5%2C%2Bpm10%2C%2Bo3%2C%2Bno2%2C%2Bso2%2C%2Bco',
    );
  });

  it('returns weather data from a successful upstream response', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    const weatherData = {
      resolvedAddress: 'Tokyo, Japan',
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(weatherData),
    } as unknown as Response);

    const req = {
      query: {
        lat: '35.6762',
        lon: '139.6503',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(weatherData);
  });

  it('returns the upstream status when Visual Crossing fails', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response);

    const req = {
      query: {
        lat: '35.6762',
        lon: '139.6503',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Upstream weather request failed (503)',
    });
  });

  it('calls the Visual Crossing API with metric unit group', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ resolvedAddress: 'London, UK' }),
    } as unknown as Response);

    const req = {
      query: {
        lat: '51.5074',
        lon: '-0.1278',
        unitGroup: 'metric',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/51.5074,-0.1278?unitGroup=metric&key=test-api-key&contentType=json&elements=%2Baqius%2C%2Baqieur%2C%2Bpm1%2C%2Bpm2p5%2C%2Bpm10%2C%2Bo3%2C%2Bno2%2C%2Bso2%2C%2Bco',
    );
  });

  it('calls the Visual Crossing API with us unit group', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ resolvedAddress: 'London, UK' }),
    } as unknown as Response);

    const req = {
      query: {
        lat: '51.5074',
        lon: '-0.1278',
        unitGroup: 'us',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/51.5074,-0.1278?unitGroup=us&key=test-api-key&contentType=json&elements=%2Baqius%2C%2Baqieur%2C%2Bpm1%2C%2Bpm2p5%2C%2Bpm10%2C%2Bo3%2C%2Bno2%2C%2Bso2%2C%2Bco',
    );
  });

  it('calls the Visual Crossing API with uk unit group', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ resolvedAddress: 'London, UK' }),
    } as unknown as Response);

    const req = {
      query: {
        lat: '51.5074',
        lon: '-0.1278',
        unitGroup: 'uk',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/51.5074,-0.1278?unitGroup=uk&key=test-api-key&contentType=json&elements=%2Baqius%2C%2Baqieur%2C%2Bpm1%2C%2Bpm2p5%2C%2Bpm10%2C%2Bo3%2C%2Bno2%2C%2Bso2%2C%2Bco',
    );
  });

  it('calls the Visual Crossing API with base unit group', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ resolvedAddress: 'London, UK' }),
    } as unknown as Response);

    const req = {
      query: {
        lat: '51.5074',
        lon: '-0.1278',
        unitGroup: 'base',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/51.5074,-0.1278?unitGroup=base&key=test-api-key&contentType=json&elements=%2Baqius%2C%2Baqieur%2C%2Bpm1%2C%2Bpm2p5%2C%2Bpm10%2C%2Bo3%2C%2Bno2%2C%2Bso2%2C%2Bco',
    );
  });

  it('calls the Visual Crossing API with metric unit group if none provided', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ resolvedAddress: 'London, UK' }),
    } as unknown as Response);

    const req = {
      query: {
        lat: '51.5074',
        lon: '-0.1278',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/51.5074,-0.1278?unitGroup=metric&key=test-api-key&contentType=json&elements=%2Baqius%2C%2Baqieur%2C%2Bpm1%2C%2Bpm2p5%2C%2Bpm10%2C%2Bo3%2C%2Bno2%2C%2Bso2%2C%2Bco',
    );
  });

  it('calls the Visual Crossing API with metric unit group if invalid unit provided', async () => {
    process.env.WEATHER_API_KEY = 'test-api-key';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ resolvedAddress: 'London, UK' }),
    } as unknown as Response);

    const req = {
      query: {
        lat: '51.5074',
        lon: '-0.1278',
        unitGroup: 'magic',
      },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/51.5074,-0.1278?unitGroup=metric&key=test-api-key&contentType=json&elements=%2Baqius%2C%2Baqieur%2C%2Bpm1%2C%2Bpm2p5%2C%2Bpm10%2C%2Bo3%2C%2Bno2%2C%2Bso2%2C%2Bco',
    );
  });
});
