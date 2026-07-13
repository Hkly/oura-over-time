# Oura Data Fetcher

Local Node.js app for pulling Oura API v2 data (sleep, stress, activity, sessions, workouts), saving raw exports, and previewing a stress/meditation chart in the browser.

## Requirements
- Node.js 18+
- npm
- Oura OAuth2 app credentials or an OAuth2 access token

## Authentication setup
Oura OpenAPI v1.35 notes that personal access tokens were deprecated in December 2025.

This app supports two server-side auth options:

1. OAuth button flow in the UI (recommended):
   - Set OAuth app environment variables:
     ```sh
     export OURA_CLIENT_ID="your-oura-client-id"
     export OURA_CLIENT_SECRET="your-oura-client-secret"
     export OURA_REDIRECT_URI="http://localhost:3000/auth/callback"
     ```
   - OAuth authorization requests these scopes: `daily session workout`
   - Start the app and click **Authorize Oura** in the UI.
2. Direct bearer token via environment variable:
   ```sh
   export OURA_ACCESS_TOKEN="your-oauth-access-token"
   ```

## Development setup
1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the app:
   ```sh
   npm run dev
   ```
3. Open <http://localhost:3000>.
4. If needed, click **Authorize Oura**, then enter your date range and submit.

## Runtime behavior
- The UI posts to `POST /fetch`.
- Data is currently exported as JSON (the `format` field is accepted but JSON is what is written).
- Output files are written to `output/`:
  - `oura_combined_raw.json` (sleep + stress + activity merged by date)
  - `oura_sessions.json`
  - `oura_workouts.json`

## Project structure
- `server.js` — Express server + `/fetch` endpoint + OAuth routes
- `OuraDataService.js` — fetch orchestration and save flow
- `OuraDataFetcher.js` — Oura API client and endpoint mappers
- `DataProcessor.js` — merge + file write utilities
- `public/index.html` — form UI
- `public/main.js` — frontend request handling
- `public/charts.js` — chart rendering logic

## Notes
- Auth token input has been removed from the browser form; auth is handled server-side.
- `output/` and `node_modules/` are gitignored.
