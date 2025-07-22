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

  // Prepare data for frontend
  // Convert to CSV or JSON string as requested
  let combinedOut, individualOut = {};
  if (format === 'json') {
    combinedOut = JSON.stringify(Object.values(DataProcessor.mergeDataByDate(combinedData)), null, 2);
    INDIVIDUAL_DATA_TYPES.forEach(type => {
      individualOut[type] = JSON.stringify(individualData[type] || [], null, 2);
    });
  } else {
    const merged = Object.values(DataProcessor.mergeDataByDate(combinedData));
    if (merged.length > 0) {
      const header = Object.keys(merged[0]).join(',');
      const rows = merged.map(row => Object.values(row).join(','));
      combinedOut = [header, ...rows].join('\n');
    } else {
      combinedOut = '';
    }
    INDIVIDUAL_DATA_TYPES.forEach(type => {
      const arr = individualData[type] || [];
      if (arr.length > 0) {
        const header = Object.keys(arr[0]).join(',');
        const rows = arr.map(row => Object.values(row).join(','));
        individualOut[type] = [header, ...rows].join('\n');
      } else {
        individualOut[type] = '';
      }
    });
  }
  return { combined: combinedOut, individual: individualOut };
}

module.exports = { fetchAndSaveOuraData };
