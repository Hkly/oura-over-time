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
    const fetcher = new OuraDataFetcher(token, startDate, endDate);
    const outputDir = DataProcessor.ensureOutputDirectory();
    const [combinedData, individualData] = await Promise.all([
      fetcher.fetchDataFor(COMBINED_DATA_TYPES),
      fetcher.fetchDataFor(INDIVIDUAL_DATA_TYPES)
    ]);

    DataProcessor.saveCombinedData(combinedData, outputDir);
    DataProcessor.saveIndividualData(individualData, outputDir);

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
