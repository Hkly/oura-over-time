// oura_data_fetcher.js
// A Node.js script to pull raw Oura data (sleep + stress + activity + bedtime info) via API v2
// Dependencies: axios, fs, commander

const { program } = require('commander');
const { OuraDataFetcher, COMBINED_DATA_TYPES, INDIVIDUAL_DATA_TYPES } = require('./OuraDataFetcher');
const DataProcessor = require('./DataProcessor');

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
