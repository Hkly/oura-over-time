// oura_data_fetcher.js
// A Node.js script to pull raw Oura data (sleep + stress + activity + bedtime info) via API v2
// Dependencies: axios, fs, commander

const { program } = require('commander');
const { OuraDataFetcher } = require('./OuraDataFetcher');
const DataProcessor = require('./DataProcessor');

/**
 * Main function to fetch and process Oura data
 */
const fetchAndMergeData = async (startDate, endDate, token) => {
  try {
    const fetcher = new OuraDataFetcher(token, startDate, endDate);
    const outputDir = DataProcessor.ensureOutputDirectory();

    // Fetch combined data and individual data separately
    const [combinedData, individualData] = await Promise.all([
      fetcher.fetchCombinedData(),
      fetcher.fetchIndividualData()
    ]);

    // Merge combined data by date
    const mergedCombinedData = DataProcessor.mergeDataByDate(combinedData);
    DataProcessor.saveCombinedData(mergedCombinedData, outputDir);

    // Save individual data types to separate CSVs
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
