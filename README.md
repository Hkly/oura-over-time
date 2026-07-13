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
- Main dashboard is at `/` with contribution-style heatmaps for sleep (duration), activity (steps + workout minutes), and meditation.
- Stress/meditation comparison chart is now on `/stress.html`.
- Both pages post to `POST /fetch`.
- Quick range buttons on the dashboard load the last 3 months, 6 months, or year.
- The stress page uses the same range buttons and shared control section.
- On page load, the UI loads same-day cached data from `localStorage` when available.
- Range buttons reuse any cached dataset that covers the requested timeframe.
- The stress page renders the selected range from the shared cached dataset when available.
- If no same-day cache exists and auth is already configured, the UI auto-fetches the last 6 months on first load.
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
- `public/stress.html` — secondary stress/meditation chart page
- `public/main.js` — frontend request handling
- `public/styles.css` — shared dashboard/page styling
- `public/charts.js` — chart rendering logic

## Notes
- Auth token input has been removed from the browser form; auth is handled server-side.
- `output/` and `node_modules/` are gitignored.
