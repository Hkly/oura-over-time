# Oura Over Time

Local Node.js app for pulling Oura API v2 data (sleep, stress, activity, sessions, workouts), and visualizing them over time.

## Requirements
- Node.js 18+
- npm
- Oura OAuth2 app credentials

## Authentication setup
Oura OpenAPI v1.35 notes that personal access tokens were deprecated in December 2025.

Use the OAuth button flow in the UI:

- Oura API docs: <https://cloud.ouraring.com/v2/docs>
- Oura Authentication section: <https://cloud.ouraring.com/v2/docs#section/Authentication>
- Oura Applications (create/manage OAuth app): <https://cloud.ouraring.com/v2/oauth/applications>

Set OAuth app environment variables:
```sh
export OURA_CLIENT_ID="your-oura-client-id"
export OURA_CLIENT_SECRET="your-oura-client-secret"
export OURA_REDIRECT_URI="http://localhost:3000/auth/callback"
```

OAuth authorization requests these scopes: `daily session workout`.
Start the app and click **Authorize Oura** in the UI.

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

## Graph mappings
- **Sleep duration:** z-score / standard deviation bands
- **Sleep timing clock:** circular density by time-of-day frequency
- **Steps:** z-score / standard deviation bands
- **Daily MET load:** composition heatmap (hue = dominant MET bucket, saturation = dominance strength, lightness = total MET load)
- **Sedentary time:** fixed thresholds (`0-5h`, `5-7h`, `7-9h`, `9h+`)
- **Workout minutes:** z-score / standard deviation bands
- **Stress vs recovery:** signed side-specific tertile buckets (3 recovery + neutral + 3 stress)
- **Meditation minutes:** z-score / standard deviation bands
