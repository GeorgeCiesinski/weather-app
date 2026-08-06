![GaleSage Brand](public/images/brand.png)

# GaleSage

GaleSage is a weather forecast web app for comparing conditions across locations, with a built-in AI advisor that answers questions from the forecast data.

View the live app at [galesage.app](https://galesage.app).

## Features

- Search for locations and pick the right match when results are ambiguous
- Compare weather for up to three locations at once
- Daily forecast details—temperature, feels-like, precipitation, snow, wind, solar radiation and energy, UV index, visibility, and more—plus hourly forecast
- Weather alerts when they are available for a location
- AI Weather Advisor for location-wide or per-day questions
- Unit preferences: metric, US, UK, and base
- Light, dark, and system theme menu

## Weather Advisor

Ask about the next few days or a specific day in the forecast. Day questions include hourly detail; multi-day questions use daily summaries only. Answers are grounded in that location’s forecast data. The advisor uses the Vercel AI Gateway and the `openai/gpt-5-nano` model.

## Setup

For local development, Vercel environment variables, GitHub Actions deploy secrets, and useful npm scripts, see [GETTING_STARTED.md](GETTING_STARTED.md).

## CI/CD

- Pull requests to `develop` and `main` run checks (ESLint, Prettier, type check, and tests) and build the app when those checks pass.
- Merging to `main` deploys via GitHub Actions using `vercel build`. Vercel auto-deploy on `main` is disabled.

## Technology

- [TypeScript](https://www.typescriptlang.org/)
- [React](https://react.dev/)
- [Vite](https://vite.dev/)
- [Vitest](https://vitest.dev/)
- [Vercel](https://vercel.com/) for serverless APIs and hosting
- [Vercel AI](https://sdk.vercel.ai/) Gateway for the Weather Advisor

## APIs

- [Nominatim](https://nominatim.org/) for searching OpenStreetMap
- [Visual Crossing](https://www.visualcrossing.com/) for weather data

## attribution

- [OpenStreetMap](https://www.openstreetmap.org/copyright) provides the location data for geocoding

## License

- This project is published under the [MIT License](LICENSE.md).
