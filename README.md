# Oura Data Fetcher

This is a personal project for pulling Oura data I'm interested in via the Oura API v2 and save it as a CSV file.

## Prerequisites
- Node.js (v14 or newer recommended)
- An Oura API v2 personal access token

## Setup
1. Install dependencies:
   ```sh
   npm install axios commander
   ```

2. Get your personal access token from [Oura](https://cloud.ouraring.com/personal-access-tokens)

## Usage
Run the script with the required options:

```sh
node oura_data_fetcher.js --token <YOUR_OURA_TOKEN> --start <YYYY-MM-DD> --end <YYYY-MM-DD>
```

- `--token` : Your Oura API personal access token
- `--start` : Start date (format: YYYY-MM-DD)
- `--end`   : End date (format: YYYY-MM-DD)

Example:
```sh
node oura_data_fetcher.js --token abcdef123456 --start 2025-05-01 --end 2025-05-10
```

## Output
- The script will generate a file named `oura_combined_raw.csv` in the current directory containing the merged data for the specified date range.
