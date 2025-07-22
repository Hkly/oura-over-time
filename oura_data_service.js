// oura_data_service.js
// Shared function for fetching and saving Oura data

const { OuraDataFetcher, COMBINED_DATA_TYPES, INDIVIDUAL_DATA_TYPES } = require('./OuraDataFetcher');
const DataProcessor = require('./DataProcessor');

async function fetchAndSaveOuraData({ token, startDate, endDate, format = 'csv' }) {
  const fetcher = new OuraDataFetcher(token, startDate, endDate);
  const outputDir = DataProcessor.ensureOutputDirectory();
  const [combinedData, individualData] = await Promise.all([
    fetcher.fetchDataFor(COMBINED_DATA_TYPES),
    fetcher.fetchDataFor(INDIVIDUAL_DATA_TYPES)
  ]);
  DataProcessor.saveCombinedData(combinedData, outputDir, format);
  DataProcessor.saveIndividualData(individualData, outputDir, format);
}

module.exports = { fetchAndSaveOuraData };
