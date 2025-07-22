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

  static saveToFile(data, filename, format = 'csv', transformRow = null) {
    if (!data || data.length === 0) {
      return;
    }
    let content;
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
    } else {
      const header = Object.keys(data[0]).join(',');
      const rows = data.map(row => {
        let values = Object.values(row);
        if (transformRow) {
          values = transformRow(row, values);
        }
        return values.join(',');
      });
      content = [header, ...rows].join('\n');
    }
    fs.writeFileSync(filename, content);
    console.log(`Saved: ${filename}`);
  }

  static saveCombinedData(combinedData, outputDir, format = 'csv') {
    const merged = this.mergeDataByDate(combinedData);
    const mergedArray = Object.values(merged);
    if (mergedArray.length === 0) return;
    const filename = `${outputDir}/oura_combined_raw.${format}`;
    this.saveToFile(mergedArray, filename, format);
  }

  static saveIndividualData(individualData, outputDir, format = 'csv') {
    INDIVIDUAL_DATA_TYPES.forEach(type => {
      if (individualData[type]) {
        const filename = `${outputDir}/oura_${type}.${format}`;
        this.saveToFile(individualData[type], filename, format);
      }
    });
  }
}

module.exports = DataProcessor;
