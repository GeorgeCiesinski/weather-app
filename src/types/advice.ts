export type AdviceScope = 'location' | 'day';

export type AdviceMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type SlimAlert = {
  event?: string;
  headline?: string;
  summary: string;
  onset?: string;
  ends?: string;
};

export type SlimAlerts = {
  count: number;
  alerts: SlimAlert[];
};

/** Pre-formatted strings only — no raw temps, no unitGroup. */
export type SlimHourForecast = {
  datetime: string;
  conditions: string;
  temp: string;
  feelslike: string;
  precipprob: string;
  precip: string;
  preciptype: string[];
  windspeed: string;
  winddir: string;
};

/** Pre-formatted strings only — no raw temps, no unitGroup. */
export type SlimDayForecast = {
  datetime: string;
  conditions: string;
  temp: string;
  tempmax: string;
  tempmin: string;
  feelslike: string;
  feelslikemax: string;
  feelslikemin: string;
  precipprob: string;
  precip: string;
  precipcover: string;
  preciptype: string[];
  snow: string;
  snowdepth: string;
  humidity: string;
  cloudcover: string;
  windspeed: string;
  solarradiation: string;
  solarenergy: string;
  uvindex: string;
  visibility: string;
  // Optional AQ strings (VC ~5-day coverage); omitted when absent in slimDay.
  aqius?: string;
  aqieur?: string;
  pm1?: string;
  pm2p5?: string;
  pm10?: string;
  o3?: string;
  no2?: string;
  so2?: string;
  co?: string;
  /** Present only on day-scope advice payloads. */
  hours?: SlimHourForecast[];
};

export type AdviceRequest = {
  scope: AdviceScope;
  location: string;
  question: string;
  history: AdviceMessage[];
  days: SlimDayForecast[];
  alerts: SlimAlerts;
};

export type AdviceSuccess = { answer: string };
export type AdviceError = { error: string };
