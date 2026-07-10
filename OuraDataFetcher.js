// OuraDataFetcher.js
// Class to handle Oura data fetching operations

const axios = require('axios');

const BASE_URL = 'https://api.ouraring.com/v2/usercollection';

// Data types that get combined into a single CSV by date
const COMBINED_DATA_TYPES = ['sleep', 'stress', 'activity'];

// Data types that get their own separate CSV files
const INDIVIDUAL_DATA_TYPES = ['sessions', 'workouts', 'heartrate'];

/**
 * Class to handle Oura data fetching operations
 */
class OuraDataFetcher {
  constructor(accessToken, startDate, endDate) {
    this.accessToken = accessToken;
    this.startDate = startDate;
    this.endDate = endDate;
    this.headers = { Authorization: `Bearer ${accessToken}` };

    // Method map for all data fetching methods
    this.methodMap = {
      sleep: this.fetchSleepData,
      stress: this.fetchStressData,
      activity: this.fetchActivityData,
      sessions: this.fetchSessionData,
      workouts: this.fetchWorkoutData,
      heartrate: this.fetchHeartRateData
    };
  }

  async fetchAllPages(endpoint, params) {
    const allRows = [];
    const seenTokens = new Set();
    let nextToken = null;

    while (true) {
      const pageParams = { ...params };
      if (nextToken) {
        pageParams.next_token = nextToken;
      }

      const response = await axios.get(`${BASE_URL}/${endpoint}`, {
        headers: this.headers,
        params: pageParams
      });

      const pageRows = Array.isArray(response.data?.data) ? response.data.data : [];
      allRows.push(...pageRows);

      const returnedToken = response.data?.next_token || null;
      if (!returnedToken || seenTokens.has(returnedToken)) {
        break;
      }

      seenTokens.add(returnedToken);
      nextToken = returnedToken;
    }

    return allRows;
  }

  async fetchDataByDate(endpoint) {
    try {
      return await this.fetchAllPages(endpoint, {
        start_date: this.startDate,
        end_date: this.endDate
      });
    } catch (error) {
      throw new Error(this.formatApiError(endpoint, error));
    }
  }

  async fetchDataByDateTime(endpoint) {
    try {
      return await this.fetchAllPages(endpoint, {
        start_datetime: `${this.startDate}T00:00:00Z`,
        end_datetime: `${this.endDate}T23:59:59Z`
      });
    } catch (error) {
      throw new Error(this.formatApiError(endpoint, error));
    }
  }

  formatApiError(endpoint, error) {
    const status = error?.response?.status;
    const errorBody = error?.response?.data;
    if (!status) {
      return `Oura API request failed for ${endpoint}: ${error.message}`;
    }
    const bodyText = typeof errorBody === 'string'
      ? errorBody
      : JSON.stringify(errorBody);
    return `Oura API request failed for ${endpoint} (${status}): ${bodyText}`;
  }

  calculateAverage(items) {
    if (!Array.isArray(items) || items.length === 0) return "";
    return items.reduce((a, b) => a + b, 0) / items.length;
  }

  async fetchSleepData() {
    console.log('Fetching sleep data...');
    const sleep = await this.fetchDataByDate('sleep');
    return sleep.map(d => ({
      date: d.day,
      bedtime_start: d.bedtime_start,
      bedtime_end: d.bedtime_end,
      sleep_latency_sec: d.latency,
      total_sleep_sec: d.total_sleep_duration,
      rem_sleep_sec: d.rem_sleep_duration,
      deep_sleep_sec: d.deep_sleep_duration,
      light_sleep_sec: d.light_sleep_duration,
      average_hrv: d.average_hrv,
      average_heart_rate: d.average_heart_rate,
      lowest_heart_rate: d.lowest_heart_rate,
      heart_rate_samples: d.heart_rate || null,
      hrv_samples: d.hrv || null
    }));
  }

  async fetchStressData() {
    console.log('Fetching stress data...');
    const stress = await this.fetchDataByDate('daily_stress');
    return stress.map(d => ({
      date: d.day,
      recovery_high: d.recovery_high,
      stress_high: d.stress_high
    }));
  }

  async fetchActivityData() {
    console.log('Fetching activity data...');
    const activity = await this.fetchDataByDate('daily_activity');
    return activity.map(d => ({
      date: d.day,
      steps: d.steps,
      active_calories: d.active_calories,
      high_activity_time: d.high_activity_time,
      low_activity_time: d.low_activity_time,
      medium_activity_time: d.medium_activity_time,
      sedentary_time: d.sedentary_time,
      total_calories: d.total_calories
    }));
  }

  async fetchSessionData() {
    console.log('Fetching session data...');
    const sessions = await this.fetchDataByDate('session');
    return sessions.map(d => ({
      date: d.day,
      start_datetime: d.start_datetime,
      end_datetime: d.end_datetime,
      type: d.type,
      mood: d.mood,
      average_heart_rate: d.heart_rate && d.heart_rate.items
        ? this.calculateAverage(d.heart_rate.items)
        : "",
      average_heart_rate_variability: d.heart_rate_variability && d.heart_rate_variability.items
        ? this.calculateAverage(d.heart_rate_variability.items)
        : "",
      heart_rate_samples: d.heart_rate || null,
      heart_rate_variability_samples: d.heart_rate_variability || null
    }));
  }

  async fetchWorkoutData() {
    console.log('Fetching workout data...');
    const workouts = await this.fetchDataByDate('workout');
    return workouts.map(d => ({
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
  }

  async fetchHeartRateData() {
    console.log('Fetching heartrate data...');
    const heartrate = await this.fetchDataByDateTime('heartrate');
    return heartrate.map(d => ({
      timestamp: d.timestamp,
      timestamp_unix: d.timestamp_unix,
      bpm: d.bpm,
      source: d.source
    }));
  }

  async fetchDataFor(data_types) {
    const promises = data_types.map(type => this.methodMap[type].call(this));
    const results = await Promise.all(promises);

    const data = {};
    data_types.forEach((type, index) => {
      data[type] = results[index];
    });

    return data;
  }
}

module.exports = { OuraDataFetcher, COMBINED_DATA_TYPES, INDIVIDUAL_DATA_TYPES };
