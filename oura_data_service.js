// oura_data_service.js
// Shared function for fetching and saving Oura data

const { OuraDataFetcher, COMBINED_DATA_TYPES, INDIVIDUAL_DATA_TYPES } = require('./OuraDataFetcher');
const DataProcessor = require('./DataProcessor');

async function fetchAndSaveOuraData({ token, startDate, endDate }) {
  const fetcher = new OuraDataFetcher(token, startDate, endDate);
  const outputDir = DataProcessor.ensureOutputDirectory();
  const [combinedData, individualData] = await Promise.all([
    fetcher.fetchDataFor(COMBINED_DATA_TYPES),
    fetcher.fetchDataFor(INDIVIDUAL_DATA_TYPES)
  ]);
  const mergedCombinedData = DataProcessor.mergeDataByDate(combinedData);
  DataProcessor.saveCombinedData(mergedCombinedData, outputDir);
  DataProcessor.saveIndividualData(individualData, outputDir);
}

module.exports = { fetchAndSaveOuraData };
