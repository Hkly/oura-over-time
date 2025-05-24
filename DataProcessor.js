// DataProcessor.js
// Utility class for data processing and CSV operations

const fs = require('fs');
const { COMBINED_DATA_TYPES } = require('./OuraDataFetcher');

/**
 * Utility class for data processing and CSV operations
 */
class DataProcessor {
  static mergeDataByDate(datasets) {
    const merged = {};

    // Merge single-entry-per-day datasets (sleep, stress, activity)
    COMBINED_DATA_TYPES.forEach(key => {
      if (datasets[key]) {
        datasets[key].forEach(entry => {
          if (!merged[entry.date]) merged[entry.date] = { date: entry.date };
          Object.assign(merged[entry.date], entry);
        });
      }
    });

    return merged;
  }

  static ensureOutputDirectory() {
    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    return outputDir;
  }

  static saveToCsv(data, filename, transformRow = null) {
    if (!data || data.length === 0) return;

    const header = Object.keys(data[0]).join(',');
    const rows = data.map(row => {
      let values = Object.values(row);
      if (transformRow) {
        values = transformRow(row, values);
      }
      return values.join(',');
    });
    const csvContent = [header, ...rows].join('\n');
    fs.writeFileSync(filename, csvContent);
    console.log(`Saved: ${filename}`);
  }

  static saveSessionsData(sessions, outputDir) {
    if (!sessions || sessions.length === 0) return;

    // Transform function to rename 'meditation' to 'meditation session'
    const transformSessionRow = (row, values) => {
      const typeIdx = Object.keys(row).indexOf('type');
      if (typeIdx !== -1 && values[typeIdx] === 'meditation') {
        values[typeIdx] = 'meditation session';
      }
      return values;
    };

    this.saveToCsv(sessions, `${outputDir}/oura_meditation_sessions.csv`, transformSessionRow);
  }

  static saveWorkoutsData(workouts, outputDir) {
    this.saveToCsv(workouts, `${outputDir}/oura_workouts.csv`);
  }

  static saveCombinedData(merged, outputDir) {
    const mergedArray = Object.values(merged);
    if (mergedArray.length === 0) return;

    this.saveToCsv(mergedArray, `${outputDir}/oura_combined_raw.csv`);
  }
}

module.exports = DataProcessor;
