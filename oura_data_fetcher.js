// oura_data_fetcher.js
// A Node.js script to pull raw Oura data (sleep + stress + activity + bedtime info) via API v2
// Dependencies: axios, fs, commander

const axios = require('axios');
const fs = require('fs');
const { program } = require('commander');

// === USER SETUP ===
const ACCESS_TOKEN = 'YOUR_PERSONAL_ACCESS_TOKEN_HERE'; // Replace with your Oura token
const BASE_URL = 'https://api.ouraring.com/v2/usercollection';

const HEADERS = {
  Authorization: `Bearer ${ACCESS_TOKEN}`,
};

const fetchData = async (endpoint, start, end) => {
  const url = `${BASE_URL}/${endpoint}?start_date=${start}&end_date=${end}`;
  const response = await axios.get(url, { headers: HEADERS });
  return response.data[endpoint];
};

const fetchAndMergeData = async (start, end) => {
  const datasets = {};

  console.log('Fetching sleep data...');
  const sleep = await fetchData('sleep', start, end);
  datasets.sleep = sleep.map(d => ({
    date: d.day,
    bedtime_start: d.bedtime_start,
    bedtime_end: d.bedtime_end,
    sleep_latency_sec: d.sleep_latency,
    total_sleep_sec: d.duration,
    rem_sleep_sec: d.rem,
    deep_sleep_sec: d.deep,
    light_sleep_sec: d.light,
  }));

  console.log('Fetching stress data...');
  const stress = await fetchData('daily_stress', start, end);
  datasets.stress = stress.map(d => ({
    date: d.day,
    stress_avg: d.stress_avg,
    stress_high: d.stress_high,
  }));

  console.log('Fetching heart rate data...');
  const hr = await fetchData('daily_heart_rate', start, end);
  datasets.hr = hr.map(d => ({
    date: d.day,
    resting_hr_avg: d.resting_hr_avg,
    resting_hr_low: d.resting_hr_low,
  }));

  console.log('Fetching HRV data...');
  const hrv = await fetchData('daily_hrv', start, end);
  datasets.hrv = hrv.map(d => ({
    date: d.day,
    hrv_rmssd: d.rmssd,
  }));

  console.log('Fetching activity data...');
  const activity = await fetchData('daily_activity', start, end);
  datasets.activity = activity.map(d => ({
    date: d.day,
    steps: d.steps,
    cal_active: d.cal_active,
    total_burn: d.cal_total,
    movement_activities: d.movement_activities,
  }));

  // Merge datasets by date
  const merged = {};

  Object.values(datasets).forEach(dataset => {
    dataset.forEach(entry => {
      if (!merged[entry.date]) merged[entry.date] = { date: entry.date };
      Object.assign(merged[entry.date], entry);
    });
  });

  const mergedArray = Object.values(merged);
  const csvHeader = Object.keys(mergedArray[0]).join(',');
  const csvRows = mergedArray.map(row => Object.values(row).join(','));

  const csvContent = [csvHeader, ...csvRows].join('\n');
  fs.writeFileSync('oura_combined_raw.csv', csvContent);
  console.log('Saved: oura_combined_raw.csv');
};

program
  .requiredOption('--start <start>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <end>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    await fetchAndMergeData(options.start, options.end);
  });

program.parse();
