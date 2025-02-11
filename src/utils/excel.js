const XLSX = require('xlsx');

const processExcelFile = (buffer) => {
  try {
    // Read Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const items = XLSX.utils.sheet_to_json(worksheet);

    // Format data
    return items.map(item => ({
      code: item.code?.toString() || '',
      description: item.description || '',
      unit: item.unit || '',
      price: parseFloat(item.price) || 0,
      category: item.category || 'Uncategorized',
      notes: item.notes || ''
    }));
  } catch (error) {
    throw new Error(`Excel processing error: ${error.message}`);
  }
};

const generateExcel = (items) => {
  try {
    // Format data for Excel
    const data = items.map(item => ({
      code: item.code,
      description: item.description,
      unit: item.unit,
      price: item.price,
      category: item.category.name,
      notes: item.notes || ''
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catalog Items');

    // Generate buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  } catch (error) {
    throw new Error(`Excel generation error: ${error.message}`);
  }
};

module.exports = {
  processExcelFile,
  generateExcel
};