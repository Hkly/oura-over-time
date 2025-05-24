// DataProcessor.js
// Utility class for data processing and CSV operations

const fs = require('fs');
const { COMBINED_DATA_TYPES, INDIVIDUAL_DATA_TYPES } = require('./OuraDataFetcher');

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

  static saveCombinedData(combinedData, outputDir) {
    const merged = this.mergeDataByDate(combinedData);
    const mergedArray = Object.values(merged);
    if (mergedArray.length === 0) return;

    this.saveToCsv(mergedArray, `${outputDir}/oura_combined_raw.csv`);
  }

  static saveIndividualData(individualData, outputDir) {
    INDIVIDUAL_DATA_TYPES.forEach(type => {
      if (individualData[type]) {
        const filename = `${outputDir}/oura_${type}.csv`;
        this.saveToCsv(individualData[type], filename);
      }
    });
  }
}

module.exports = DataProcessor;
