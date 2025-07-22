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
  // Always save as JSON
  DataProcessor.saveCombinedData(combinedData, outputDir, 'json');
  DataProcessor.saveIndividualData(individualData, outputDir, 'json');

  // Prepare data for frontend (always JSON)
  let combinedOut, individualOut = {};
  combinedOut = JSON.stringify(Object.values(DataProcessor.mergeDataByDate(combinedData)), null, 2);
  INDIVIDUAL_DATA_TYPES.forEach(type => {
    individualOut[type] = JSON.stringify(individualData[type] || [], null, 2);
  });
  return { combined: combinedOut, individual: individualOut };
}

module.exports = { fetchAndSaveOuraData };
