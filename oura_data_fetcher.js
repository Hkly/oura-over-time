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
    sleep_latency_sec: d.latency,
    total_sleep_sec: d.total_sleep_duration,
    rem_sleep_sec: d.rem_sleep_duration,
    deep_sleep_sec: d.deep_sleep_duration,
    light_sleep_sec: d.light_sleep_duration,
    average_hrv: d.average_hrv,
    average_heart_rate: d.average_heart_rate
  }));

  console.log('Fetching stress data...');
  const stress = await fetchData('daily_stress', start, end);
  datasets.stress = stress.map(d => ({
    date: d.day,
    recovery_high: d.recovery_high,
    stress_high: d.stress_high
  }));

  console.log('Fetching activity data...');
  const activity = await fetchData('daily_activity', start, end);
  datasets.activity = activity.map(d => ({
    date: d.day,
    steps: d.steps,
    active_calories: d.active_calories,
    high_activity_time: d.high_activity_time,
    low_activity_time: d.low_activity_time,
    medium_activity_time: d.medium_activity_time,
    sedentary_time: d.sedentary_time,
    total_calories: d.total_calories
  }));

  // Fetch and flatten session data (may be multiple per day)
  console.log('Fetching session data...');
  const sessions = await fetchData('session', start, end);
  datasets.sessions = sessions.map(d => ({
    date: d.day,
    start_datetime: d.start_datetime,
    end_datetime: d.end_datetime,
    type: d.type,
    mood: d.mood,
    average_heart_rate: d.heart_rate && Array.isArray(d.heart_rate.items) && d.heart_rate.items.length > 0
      ? (d.heart_rate.items.reduce((a, b) => a + b, 0) / d.heart_rate.items.length)
      : "",
    average_heart_rate_variability: d.heart_rate_variability && Array.isArray(d.heart_rate_variability.items) && d.heart_rate_variability.items.length > 0
      ? (d.heart_rate_variability.items.reduce((a, b) => a + b, 0) / d.heart_rate_variability.items.length)
      : ""
  }));

  console.log('Fetching workout data...');
  const workouts = await fetchData('workout', start, end);
  datasets.workouts = workouts.map(d => ({
    date: d.day,
    activity: d.activity,
    calories: d.calories,
    distance: d.distance,
    intensity: d.intensity,
    label: d.label,
    source: d.source,
    start_datetime: d.start_datetime,
    end_datetime: d.end_datetime
  }));

  // Merge datasets by date (sessions and workouts may have multiple per day)
  const merged = {};

  // Merge single-entry-per-day datasets
  ['sleep', 'stress', 'activity'].forEach(key => {
    if (datasets[key]) {
      datasets[key].forEach(entry => {
        if (!merged[entry.date]) merged[entry.date] = { date: entry.date };
        Object.assign(merged[entry.date], entry);
      });
    }
  });

  // For sessions and workouts, collect arrays per day
  ['sessions', 'workouts'].forEach(key => {
    if (datasets[key]) {
      datasets[key].forEach(entry => {
        if (!merged[entry.date]) merged[entry.date] = { date: entry.date };
        if (!merged[entry.date][key]) merged[entry.date][key] = [];
        merged[entry.date][key].push(entry);
      });
    }
  });

  // Ensure output directory exists
  const outputDir = 'output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Save sessions to a separate CSV
  if (datasets.sessions && datasets.sessions.length > 0) {
    // Rename type 'meditation' to 'meditation session' in the output
    const sessionHeader = Object.keys(datasets.sessions[0]).join(',');
    const sessionRows = datasets.sessions.map(row => {
      const values = Object.values(row);
      const typeIdx = Object.keys(row).indexOf('type');
      if (typeIdx !== -1 && values[typeIdx] === 'meditation') {
        values[typeIdx] = 'meditation session';
      }
      return values.join(',');
    });
    const sessionCsv = [sessionHeader, ...sessionRows].join('\n');
    fs.writeFileSync(`${outputDir}/oura_meditation_sessions.csv`, sessionCsv);
    console.log('Saved: output/oura_meditation_sessions.csv');
  }

  // Save workouts to a separate CSV
  if (datasets.workouts && datasets.workouts.length > 0) {
    const workoutHeader = Object.keys(datasets.workouts[0]).join(',');
    const workoutRows = datasets.workouts.map(row => Object.values(row).join(','));
    const workoutCsv = [workoutHeader, ...workoutRows].join('\n');
    fs.writeFileSync(`${outputDir}/oura_workouts.csv`, workoutCsv);
    console.log('Saved: output/oura_workouts.csv');
  }

  // Remove sessions and workouts from merged data for the main CSV
  Object.values(merged).forEach(row => {
    delete row.sessions;
    delete row.workouts;
  });

  const mergedArray = Object.values(merged);
  const csvHeader = Object.keys(mergedArray[0]).join(',');
  const csvRows = mergedArray.map(row => Object.values(row).join(','));

  const csvContent = [csvHeader, ...csvRows].join('\n');
  fs.writeFileSync(`${outputDir}/oura_combined_raw.csv`, csvContent);
  console.log('Saved: output/oura_combined_raw.csv');
};

program
  .requiredOption('--token <token>', 'Oura API personal access token')
  .requiredOption('--start <start>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <end>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    await fetchAndMergeData(options.start, options.end, options.token);
  });

program.parse();
