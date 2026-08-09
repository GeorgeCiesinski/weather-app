import { describe, expect, it } from 'vitest';
import {
  formatPercent,
  slimDay,
  slimHour,
  buildLocationForecastDays,
  buildDayForecastDays,
  buildSeededAdviceText,
} from './adviceForecast';
import type { DailyWeather, HourlyWeather } from '../types/weather';

function makeHour(overrides: Partial<HourlyWeather> = {}): HourlyWeather {
  return {
    datetime: '14:00:00',
    conditions: 'Clear',
    icon: 'clear-day',
    temp: 24,
    feelslike: 25,
    precipprob: 10,
    precip: 0,
    preciptype: [],
    windspeed: 8,
    winddir: 180,
    ...overrides,
  };
}

function makeDay(overrides: Partial<DailyWeather> = {}): DailyWeather {
  return {
    datetime: '2026-07-15',
    conditions: 'Partly cloudy',
    description: 'Partly cloudy throughout the day.',
    icon: 'partly-cloudy-day',
    temp: 22,
    tempmax: 28,
    tempmin: 16,
    feelslike: 23,
    feelslikemax: 29,
    feelslikemin: 15,
    humidity: 55,
    cloudcover: 40,
    preciptype: ['rain'],
    precip: 2.5,
    precipprob: 30,
    precipcover: 10,
    snow: 0,
    snowdepth: 0,
    windspeed: 12,
    winddir: 180,
    solarradiation: 239.1,
    solarenergy: 20.6,
    uvindex: 8,
    visibility: 15.1,
    ...overrides,
  };
}

describe('formatPercent', () => {
  it('appends a percent sign', () => {
    expect(formatPercent(55)).toBe('55%');
  });

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('slimDay', () => {
  it('formats temps, precip, snow, and wind for metric', () => {
    expect(slimDay(makeDay(), 'metric')).toEqual({
      datetime: '2026-07-15',
      conditions: 'Partly cloudy',
      temp: '22°C',
      tempmax: '28°C',
      tempmin: '16°C',
      feelslike: '23°C',
      feelslikemax: '29°C',
      feelslikemin: '15°C',
      precipprob: '30%',
      precip: '2.5mm',
      precipcover: '10%',
      preciptype: ['rain'],
      snow: '0cm',
      snowdepth: '0cm',
      humidity: '55%',
      cloudcover: '40%',
      windspeed: '12 km/h',
      solarradiation: '239.1 W/m²',
      solarenergy: '20.6 MJ/m²',
      uvindex: '8',
      visibility: '15.1 km',
    });
  });

  it('formats temps, precip, snow, and wind for us', () => {
    const day = makeDay({
      temp: 72,
      tempmax: 80,
      tempmin: 60,
      feelslike: 74,
      feelslikemax: 82,
      feelslikemin: 58,
      precip: 0.1,
      snow: 1,
      snowdepth: 2,
      windspeed: 8,
      visibility: 10,
    });

    expect(slimDay(day, 'us')).toEqual({
      datetime: '2026-07-15',
      conditions: 'Partly cloudy',
      temp: '72°F',
      tempmax: '80°F',
      tempmin: '60°F',
      feelslike: '74°F',
      feelslikemax: '82°F',
      feelslikemin: '58°F',
      precipprob: '30%',
      precip: '0.1in',
      precipcover: '10%',
      preciptype: ['rain'],
      snow: '1in',
      snowdepth: '2in',
      humidity: '55%',
      cloudcover: '40%',
      windspeed: '8 MPH',
      solarradiation: '239.1 W/m²',
      solarenergy: '20.6 MJ/m²',
      uvindex: '8',
      visibility: '10 mi',
    });
  });

  it('preserves datetime, conditions, and preciptype', () => {
    const day = makeDay({
      datetime: '2026-08-01',
      conditions: 'Snow',
      preciptype: ['snow', 'ice'],
    });
    const slim = slimDay(day, 'metric');
    expect(slim.datetime).toBe('2026-08-01');
    expect(slim.conditions).toBe('Snow');
    expect(slim.preciptype).toEqual(['snow', 'ice']);
  });

  it('formats air quality fields when present', () => {
    const slim = slimDay(
      makeDay({
        aqius: 42,
        aqieur: 2,
        pm1: 5.1,
        pm2p5: 12.3,
        pm10: 20,
        o3: 30,
        no2: 8,
        so2: 1.5,
        co: 200,
      }),
      'metric',
    );

    expect(slim.aqius).toBe('42 (Good)');
    expect(slim.aqieur).toBe('2 (Low)');
    expect(slim.pm1).toBe('5.1 µg/m³');
    expect(slim.pm2p5).toBe('12.3 µg/m³');
    expect(slim.pm10).toBe('20 µg/m³');
    expect(slim.o3).toBe('30 µg/m³');
    expect(slim.no2).toBe('8 µg/m³');
    expect(slim.so2).toBe('1.5 µg/m³');
    expect(slim.co).toBe('200 µg/m³');
  });

  it('omits air quality keys when source values are absent', () => {
    const slim = slimDay(makeDay(), 'metric');
    expect(slim).not.toHaveProperty('aqius');
    expect(slim).not.toHaveProperty('aqieur');
    expect(slim).not.toHaveProperty('pm1');
    expect(slim).not.toHaveProperty('pm2p5');
    expect(slim).not.toHaveProperty('pm10');
    expect(slim).not.toHaveProperty('o3');
    expect(slim).not.toHaveProperty('no2');
    expect(slim).not.toHaveProperty('so2');
    expect(slim).not.toHaveProperty('co');
  });
});

describe('slimHour', () => {
  it('formats hourly fields for metric', () => {
    expect(slimHour(makeHour(), 'metric')).toEqual({
      datetime: '14:00:00',
      conditions: 'Clear',
      temp: '24°C',
      feelslike: '25°C',
      precipprob: '10%',
      precip: '0mm',
      preciptype: [],
      windspeed: '8 km/h',
      winddir: 'from S (180°)',
    });
  });

  it('formats hourly fields for us', () => {
    const hour = makeHour({
      temp: 75,
      feelslike: 76,
      precip: 0.1,
      windspeed: 10,
    });
    expect(slimHour(hour, 'us')).toEqual({
      datetime: '14:00:00',
      conditions: 'Clear',
      temp: '75°F',
      feelslike: '76°F',
      precipprob: '10%',
      precip: '0.1in',
      preciptype: [],
      windspeed: '10 MPH',
      winddir: 'from S (180°)',
    });
  });

  it('treats missing preciptype as an empty array', () => {
    const hour = makeHour({ preciptype: undefined });
    expect(slimHour(hour, 'metric').preciptype).toEqual([]);
  });
});

describe('buildLocationForecastDays', () => {
  it('returns up to five slim days', () => {
    const days = [
      makeDay({ datetime: '2026-07-15' }),
      makeDay({ datetime: '2026-07-16' }),
      makeDay({ datetime: '2026-07-17' }),
      makeDay({ datetime: '2026-07-18' }),
      makeDay({ datetime: '2026-07-19' }),
      makeDay({ datetime: '2026-07-20' }),
    ];
    const result = buildLocationForecastDays(days, 'metric');
    expect(result).toHaveLength(5);
    expect(result.map((d) => d.datetime)).toEqual([
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
    ]);
  });

  it('omits hours even when source days include hourly data', () => {
    const result = buildLocationForecastDays(
      [makeDay({ hours: [makeHour()] }), makeDay({ datetime: '2026-07-16', hours: [makeHour()] })],
      'metric',
    );
    expect(result.every((day) => day.hours === undefined)).toBe(true);
  });

  it('returns fewer than five when the forecast is shorter', () => {
    expect(buildLocationForecastDays([makeDay()], 'metric')).toHaveLength(1);
  });

  it('returns an empty array when there are no days', () => {
    expect(buildLocationForecastDays([], 'metric')).toEqual([]);
  });
});

describe('buildDayForecastDays', () => {
  it('wraps a single day in an array with formatted hours', () => {
    const day = makeDay({
      datetime: '2026-07-20',
      hours: [makeHour({ datetime: '09:00:00', temp: 18, feelslike: 17 })],
    });
    const result = buildDayForecastDays(day, 'metric');
    expect(result).toHaveLength(1);
    expect(result[0].datetime).toBe('2026-07-20');
    expect(result[0].temp).toBe('22°C');
    expect(result[0].hours).toEqual([
      {
        datetime: '09:00:00',
        conditions: 'Clear',
        temp: '18°C',
        feelslike: '17°C',
        precipprob: '10%',
        precip: '0mm',
        preciptype: [],
        windspeed: '8 km/h',
        winddir: 'from S (180°)',
      },
    ]);
  });

  it('uses an empty hours array when the day has no hourly data', () => {
    const result = buildDayForecastDays(makeDay({ datetime: '2026-07-20' }), 'metric');
    expect(result[0].hours).toEqual([]);
  });
});

describe('buildSeededAdviceText', () => {
  it('returns the trimmed description when there are no alerts', () => {
    expect(buildSeededAdviceText('  Warm and sunny.  ', 0)).toBe('Warm and sunny.');
  });

  it('falls back when description is missing', () => {
    expect(buildSeededAdviceText(undefined, 0)).toBe('Forecast loaded.');
  });

  it('falls back when description is blank', () => {
    expect(buildSeededAdviceText('   ', 0)).toBe('Forecast loaded.');
  });

  it('appends a singular alert line', () => {
    expect(buildSeededAdviceText('Warm weekend ahead.', 1)).toBe(
      'Warm weekend ahead.\n\n1 severe weather alert active.',
    );
  });

  it('appends a plural alert line', () => {
    expect(buildSeededAdviceText('Stormy conditions.', 3)).toBe(
      'Stormy conditions.\n\n3 severe weather alerts active.',
    );
  });

  it('uses the fallback overview when alerts exist but description is missing', () => {
    expect(buildSeededAdviceText(undefined, 2)).toBe(
      'Forecast loaded.\n\n2 severe weather alerts active.',
    );
  });
});
