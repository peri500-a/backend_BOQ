const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');

// CSV headers for catalog items
const CSV_HEADERS = ['code', 'description', 'unit', 'price', 'category', 'notes'];

// Parse CSV data
function parseCSV(fileData) {
  return new Promise((resolve, reject) => {
    parse(fileData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }, (err, records) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
}

// Convert data to CSV
function generateCSV(data) {
  return new Promise((resolve, reject) => {
    stringify(data, {
      header: true,
      columns: CSV_HEADERS
    }, (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
}

module.exports = {
  parseCSV,
  generateCSV,
  CSV_HEADERS
};