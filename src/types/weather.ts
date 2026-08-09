import type { LocationResult } from './location';

export interface WeatherAlert {
  event: string;
  headline: string;
  description?: string;
  onset?: string;
  ends?: string;
  onsetEpoch?: number;
  endsEpoch?: number;
  id?: string;
  language?: string;
  link?: string;
}

export interface DailyWeather {
  datetime: string; // "YYYY-MM-DD"
  conditions: string; // per-day condition text
  description: string; // per-day weather summary
  icon: string; // Visual Crossing icon id, maps to /weather-icons/{icon}.png
  temp: number;
  tempmax: number;
  tempmin: number;
  feelslike: number; // Temperature feels like
  feelslikemax: number;
  feelslikemin: number;
  humidity: number;
  cloudcover: number; // Percentage of cloud cover
  preciptype: string[]; // rain, snow, ice, freezingrain
  precip: number; // Precipitation amt
  precipprob: number; // Precipitation probability
  precipcover: number; // Proportion of day it will precipitate
  snow: number; // Daily snow amt
  snowdepth: number; // Total snow depth
  windspeed: number;
  winddir: number;
  visibility: number; // km or mi depending on unitGroup
  // Solar
  solarradiation: number; // W/m², mean for the day
  solarenergy: number; // MJ/m², daily sum of hourly energy
  uvindex: number; // typically 0–10+, daily max of hourly
  // Air Quality (optional — VC covers ~5-day forecast only)
  aqius?: number; // US EPA AQI (0–300+)
  aqieur?: number; // European AQI (1–6)
  pm1?: number; // Particulate matter <1 µm (µg/m³)
  pm2p5?: number; // Particulate matter <2.5 µm (µg/m³)
  pm10?: number; // Particulate matter <10 µm (µg/m³)
  o3?: number; // Ground-level ozone (µg/m³)
  no2?: number; // Nitrogen dioxide (µg/m³)
  so2?: number; // Sulphur dioxide (µg/m³)
  co?: number; // Carbon monoxide (µg/m³)
  hours?: HourlyWeather[];
}

export interface HourlyWeather {
  datetime: string;
  conditions: string;
  icon: string;
  temp: number;
  feelslike: number;
  precipprob: number;
  precip: number;
  preciptype?: string[];
  windspeed: number;
  winddir: number;
  // Optional air quality (same units as daily; ~5-day VC coverage)
  aqius?: number;
  aqieur?: number;
  pm1?: number;
  pm2p5?: number;
  pm10?: number;
  o3?: number;
  no2?: number;
  so2?: number;
  co?: number;
}

export interface WeatherData {
  resolvedAddress: string;
  description?: string; // Multi-day weather overview
  days: DailyWeather[];
  alerts?: WeatherAlert[]; // Alerts if exist
}

export interface WeatherCard {
  id: string; // Random ID for react to differentiate cards
  /** Original search text; label fallback when displayName is missing. */
  query: string;
  location: LocationResult | null;
}
