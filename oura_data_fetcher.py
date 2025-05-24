# oura_data_fetcher.py
# A Python script to pull raw Oura data (sleep + stress + activity + bedtime info) via API v2
# Dependencies: requests, pandas

import requests
import pandas as pd
from datetime import datetime, timedelta
import argparse

# === USER SETUP ===
ACCESS_TOKEN = "YOUR_PERSONAL_ACCESS_TOKEN_HERE"  # Replace with your Oura token

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}"
}

base_url = "https://api.ouraring.com/v2/usercollection"


def fetch_data(endpoint, start_date, end_date):
    url = f"{base_url}/{endpoint}?start_date={start_date}&end_date={end_date}"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()[endpoint]


def fetch_and_merge_data(start_date, end_date):
    # Endpoints to collect raw data
    datasets = {}

    print("Fetching sleep data (with bedtime, latency)...")
    sleep_data = fetch_data("sleep", start_date, end_date)
    sleep_df = pd.json_normalize(sleep_data)
    sleep_df = sleep_df[[
        'day', 'bedtime_start', 'bedtime_end', 'sleep_latency', 'duration',
        'rem', 'deep', 'light'
    ]].rename(columns={
        'day': 'date',
        'sleep_latency': 'sleep_latency_sec',
        'duration': 'total_sleep_sec',
        'rem': 'rem_sleep_sec',
        'deep': 'deep_sleep_sec',
        'light': 'light_sleep_sec'
    })
    datasets['sleep'] = sleep_df

    print("Fetching stress data...")
    stress_data = fetch_data("daily_stress", start_date, end_date)
    stress_df = pd.json_normalize(stress_data)[['day', 'stress_avg', 'stress_high']].rename(columns={'day': 'date'})
    datasets['stress'] = stress_df

    print("Fetching heart rate data...")
    hr_data = fetch_data("daily_heart_rate", start_date, end_date)
    hr_df = pd.json_normalize(hr_data)[['day', 'resting_hr_avg', 'resting_hr_low']].rename(columns={'day': 'date'})
    datasets['hr'] = hr_df

    print("Fetching HRV data...")
    hrv_data = fetch_data("daily_hrv", start_date, end_date)
    hrv_df = pd.json_normalize(hrv_data)[['day', 'rmssd']].rename(columns={'day': 'date', 'rmssd': 'hrv_rmssd'})
    datasets['hrv'] = hrv_df

    print("Fetching activity data...")
    activity_data = fetch_data("daily_activity", start_date, end_date)
    activity_df = pd.json_normalize(activity_data)[['day', 'steps', 'cal_active', 'cal_total', 'movement_activities']].rename(columns={'day': 'date', 'cal_total': 'total_burn'})
    datasets['activity'] = activity_df

    # Merge all datasets on date
    df_merged = datasets['sleep']
    for key in ['stress', 'hr', 'hrv', 'activity']:
        df_merged = df_merged.merge(datasets[key], on='date', how='left')

    # Save to one combined file
    df_merged.to_csv("oura_combined_raw.csv", index=False)
    print("Saved: oura_combined_raw.csv")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch raw Oura data for a given date range.")
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")
    args = parser.parse_args()

    fetch_and_merge_data(args.start, args.end)
