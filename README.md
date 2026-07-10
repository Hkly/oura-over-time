
# Oura Data Fetcher

Local Node.js app for pulling Oura API v2 data (sleep, stress, activity, sessions, workouts), saving raw exports, and previewing a stress/meditation chart in the browser.

## Requirements
- Node.js 18+
- npm
- Oura personal access token: <https://cloud.ouraring.com/personal-access-tokens>

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
4. Enter your token and date range, then submit.

## Runtime behavior
- The UI posts to `POST /fetch`.
- Data is currently exported as JSON (the `format` field is accepted but JSON is what is written).
- Output files are written to `output/`:
  - `oura_combined_raw.json` (sleep + stress + activity merged by date)
  - `oura_sessions.json`
  - `oura_workouts.json`

## Project structure
- `server.js` — Express server + `/fetch` endpoint
- `OuraDataService.js` — fetch orchestration and save flow
- `OuraDataFetcher.js` — Oura API client and endpoint mappers
- `DataProcessor.js` — merge + file write utilities
- `public/index.html` — form UI
- `public/main.js` — frontend request handling
- `public/charts.js` — chart rendering logic

## Notes
- The Oura token is entered in the browser form and sent to the local server for each request.
- `output/` and `node_modules/` are gitignored.
