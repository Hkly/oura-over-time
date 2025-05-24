// oura_data_fetcher.js
// A Node.js script to pull raw Oura data (sleep + stress + activity + bedtime info) via API v2
// Dependencies: axios, fs, commander

const fs = require('fs');
const { program } = require('commander');
const { OuraDataFetcher, COMBINED_DATA_TYPES, INDIVIDUAL_DATA_TYPES } = require('./OuraDataFetcher');

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

/**
 * Main function to fetch and process Oura data
 */
const fetchAndMergeData = async (startDate, endDate, token) => {
  try {
    // Create fetcher instance with token and date range
    const fetcher = new OuraDataFetcher(token, startDate, endDate);

    console.log('Fetching combined data types:', COMBINED_DATA_TYPES);
    console.log('Fetching individual data types:', INDIVIDUAL_DATA_TYPES);

    // Fetch combined data and individual data separately
    const [combinedData, individualData] = await Promise.all([
      fetcher.fetchCombinedData(),
      fetcher.fetchIndividualData()
    ]);

    // Merge combined data by date
    const merged = DataProcessor.mergeDataByDate(combinedData);

    // Ensure output directory exists
    const outputDir = DataProcessor.ensureOutputDirectory();

    // Save combined data to one CSV
    DataProcessor.saveCombinedData(merged, outputDir);

    // Save individual data types to separate CSVs
    DataProcessor.saveSessionsData(individualData.sessions, outputDir);
    DataProcessor.saveWorkoutsData(individualData.workouts, outputDir);

    console.log('\nData fetching and processing completed successfully!');

  } catch (error) {
    console.error('Error fetching or processing data:', error.message);
    throw error;
  }
};

program
  .requiredOption('--token <token>', 'Oura API personal access token')
  .requiredOption('--start <start>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <end>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    await fetchAndMergeData(options.start, options.end, options.token);
  });

program.parse();
