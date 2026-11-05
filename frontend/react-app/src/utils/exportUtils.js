/**
 * Export data to a CSV file.
 * 
 * @param {Array<Object>} data - Array of objects to export.
 * @param {string} filename - The name of the downloaded file.
 * @param {Object} columns - A mapping of object keys to CSV column headers (e.g. { id: "ID", name: "Nom" }).
 */
export const exportToCSV = (data, filename = 'export.csv', columns = null) => {
  if (!data || !data.length) return;

  // Determine the keys to export and their corresponding headers
  let keys = [];
  let headers = [];
  
  if (columns) {
    keys = Object.keys(columns);
    headers = Object.values(columns);
  } else {
    keys = Object.keys(data[0]);
    headers = keys;
  }

  // Helper to format values for CSV (escaping quotes, handling commas, newlines)
  const formatValue = (value) => {
    if (value === null || value === undefined) return '';
    let stringValue = String(value);
    
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      stringValue = `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Build the CSV string
  const csvRows = [];
  csvRows.push(headers.map(formatValue).join(',')); // Add headers
  
  for (const row of data) {
    const values = keys.map(key => {
      // Handle nested properties if necessary (e.g., "client.name")
      const val = key.split('.').reduce((o, k) => (o || {})[k], row);
      return formatValue(val);
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  
  // Add UTF-8 BOM so Excel opens it with correct encoding (handles accents)
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  
  // Create link and trigger download
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
