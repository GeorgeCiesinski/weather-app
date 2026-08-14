# Getting Started

## Requirements

- Node 22+

## Local Setup

1. Clone the Repository.
1. Run `npm install`.
1. Create an `.env` file in the project root (`.gitignore` ignores `.env` and `.env*`, so do not commit it).
1. Add the variables below.

```bash
WEATHER_API_KEY=your_visual_crossing_key
AI_ADVICE_MODEL=your_preferred_ai_advice_model
AI_GATEWAY_API_KEY=your_ai_gateway_api_key
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

Optional: `AI_ADVICE_MODEL` overrides the default Weather Advisor model.

## Upstash Redis (rate limiting)

Public `/api/weather`, `/api/geocode`, and `/api/advice` routes use [Upstash Redis](https://upstash.com) for IP rate limits.

1. Sign up at [console.upstash.com](https://console.upstash.com).
1. Create a **Redis** database (a regional instance near your Vercel region is enough).
1. On the database details tab, copy the **REST** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Do not use the `rediss://` TCP URL.

`npm run vercel` sets `VERCEL_ENV=development`, so the limiter is skipped locally. Preview and production always enforce limits. If the Upstash env vars are missing there, those routes return **503**.

## Vercel Setup

1. Go to Vercel, connect to your github account, and import the Git Repository.
1. Go to vercel.com → Click your Project → Environment Variables.
1. Add `WEATHER_API_KEY`, `AI_GATEWAY_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. Optional: `AI_ADVICE_MODEL`.
1. Under environments, checkmark Production and Preview for each.
1. Click Save.
1. Redeploy after adding variables so production and preview pick them up.

## Link Github Actions to Vercel (Automated Deployment)

In order for Github Actions to deploy to Vercel, you will need to add three secrets to Github.

**Note:** Production deploys are handled by GitHub Actions; `vercel.json` disables Vercel's auto-deploy on `main`.

### VERCEL_TOKEN

1. Go to vercel.com → top-right avatar → Settings → Tokens (or: https://vercel.com/account/tokens).
1. Under **Create Token**, set TOKEN NAME to `VERCEL_TOKEN` (or your preferred name), set SCOPE to your projects, and set EXPIRATION to your preferred duration. Copy this token immediately as Vercel only shows it once.

### VERCEL_ORG_ID

1. Go to vercel.com → Settings → stay on general and scroll down and copy the **Team ID** for later.

### VERCEL_PROJECT_ID

1. Go to vercel.com → Click your Project → Settings → Copy the project ID for later.

### Add to Github

1. Navigate to your repository.
1. Click Settings.
1. Under **Secrets and variables**, click Actions.
1. Click **New repository secret**, and create the secret VERCEL_TOKEN, pasting the token we created.
1. Repeat the last step, but name the second secret VERCEL_ORG_ID and paste the Team ID we copied.
1. Repeat the step once more, but name the final secret VERCEL_PROJECT_ID and paste the Project ID we copied.

# Development

- Run Vercel Dev environment with `npm run vercel`. Running the dev environment for the first time will prompt you to authenticate with Vercel and link the project.
- Run ESLint, Prettier, and TypeCheck with `npm run check`.
- Run the above checks as well as the Test Suite with `npm run validate`.
- Run `npm run test:watch` to run tests and watch for file changes. This is helpful for developing new tests.

**In case of issues:**

- Fix ESLint issues with `npm run lint:fix`.
- Fix Prettier issues with `npm run format:fix`.

# Production

This app uses Vite to build `/dist` files.

- First, validate files with `npm run validate`.
- Then build production files with `npm run build`.
- (Optional) Preview build with `npm run preview`.

**Note:** Build is automated during deployment. See CI/CD section below.
