
# Oura Data Fetcher

This project pulls your Oura data (sleep, stress, activity, sessions, workouts) via the Oura API v2 and saves it as CSV or JSON files.

## Prerequisites
- Node.js (v14 or newer recommended)
- An Oura API v2 personal access token

## Setup
1. Install dependencies:
   ```sh
   npm install axios express
   ```

2. Get your personal access token from [Oura](https://cloud.ouraring.com/personal-access-tokens)


## Usage

### Web Interface
Use the simple web form:

1. Start the server:
   ```sh
   node server.js
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser.
3. Enter your token, start date, end date, and choose CSV or JSON output.
4. Submit the form to fetch and save your data.

## Output
- Files are saved in the `output/` directory:
  - `oura_combined_raw.csv` or `oura_combined_raw.json`: Merged sleep, stress, and activity data by date
  - `oura_sessions.csv` or `oura_sessions.json`: Session data
  - `oura_workouts.csv` or `oura_workouts.json`: Workout data

## Code Structure
- `OuraDataFetcher.js`: Handles API requests and data fetching
- `DataProcessor.js`: Merges, transforms, and saves data as CSV/JSON
- `oura_data_service.js`: Orchestrates fetching and saving
- `server.js`: Express server for the web interface
- `public/index.html`: Web form for user input

## Extending
- Easily add new data types or output formats by updating constants and processor logic.

## License
MIT
