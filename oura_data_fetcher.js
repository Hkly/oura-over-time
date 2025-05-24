// oura_data_fetcher.js
// A Node.js script to pull raw Oura data (sleep + stress + activity + bedtime info) via API v2
// Dependencies: axios, fs, commander

const axios = require('axios');
const fs = require('fs');
const { program } = require('commander');

const BASE_URL = 'https://api.ouraring.com/v2/usercollection';

let ACCESS_TOKEN = null;
let HEADERS = {};

const fetchData = async (endpoint, start, end) => {
  const url = `${BASE_URL}/${endpoint}?start_date=${start}&end_date=${end}`;
  const response = await axios.get(url, { headers: HEADERS });
  return response.data.data;
};

const fetchAndMergeData = async (start, end, token) => {
  ACCESS_TOKEN = token;
  HEADERS = { Authorization: `Bearer ${ACCESS_TOKEN}` };
  const datasets = {};

  console.log('Fetching sleep data...');
  const sleep = await fetchData('sleep', start, end);
  datasets.sleep = sleep.map(d => ({
    date: d.day,
    bedtime_start: d.bedtime_start,
    bedtime_end: d.bedtime_end,
    sleep_latency_sec: d.latency, // updated key
    total_sleep_sec: d.total_sleep_duration, // updated key
    rem_sleep_sec: d.rem_sleep_duration, // updated key
    deep_sleep_sec: d.deep_sleep_duration, // updated key
    light_sleep_sec: d.light_sleep_duration, // updated key
    average_hrv: d.average_hrv, // updated key (average HRV for the night)
    average_heart_rate: d.average_heart_rate 
  }));

  console.log('Fetching stress data...');
  const stress = await fetchData('daily_stress', start, end);
  datasets.stress = stress.map(d => ({
    date: d.day,
    recovery_high: d.recovery_high,     // corrected
    stress_high: d.stress_high    // corrected
  }));


  console.log('Fetching activity data...');
  const activity = await fetchData('daily_activity', start, end);
  datasets.activity = activity.map(d => ({
    date: d.day,
    steps: d.steps,
    active_calories: d.active_calories,     // corrected
    high_activity_time: d.high_activity_time,      // corrected
    low_activity_time: d.low_activity_time,
    medium_activity_time: d.medium_activity_time,
    sedentary_time: d.sedentary_time,
    total_calories: d.total_calories
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
  .requiredOption('--token <token>', 'Oura API personal access token')
  .requiredOption('--start <start>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <end>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    await fetchAndMergeData(options.start, options.end, options.token);
  });

program.parse();
