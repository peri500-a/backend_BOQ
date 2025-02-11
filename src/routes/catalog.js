const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { parseCSV, generateCSV } = require('../utils/csv');
const { processExcelFile, generateExcel } = require('../utils/excel');

const router = express.Router();
const prisma = new PrismaClient();

// Get all categories for company
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { companyId: req.user.companyId },
      include: { items: true }
    });
    res.json(categories);
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ error: 'Error fetching categories' });
  }
});

// Create new category
router.post('/categories', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.create({
      data: {
        name,
        description,
        companyId: req.user.companyId
      }
    });
    res.json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Error creating category' });
  }
});

// Get all catalog items for company
router.get('/items', authMiddleware, async (req, res) => {
  try {
    const items = await prisma.catalogItem.findMany({
      where: { 
        companyId: req.user.companyId,
        isActive: true
      },
      include: { category: true }
    });
    res.json(items);
  } catch (error) {
    console.error('Fetch items error:', error);
    res.status(500).json({ error: 'Error fetching items' });
  }
});

// Create new catalog item
router.post('/items', authMiddleware, async (req, res) => {
  try {
    const { code, description, unit, price, categoryId, notes } = req.body;
    const item = await prisma.catalogItem.create({
      data: {
        code,
        description,
        unit,
        price: parseFloat(price),
        categoryId,
        notes,
        companyId: req.user.companyId
      },
      include: { category: true }
    });
    res.json(item);
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Error creating item' });
  }
});

// Update catalog item
router.put('/items/:id', authMiddleware, async (req, res) => {
  try {
    const { code, description, unit, price, categoryId, notes, isActive } = req.body;
    
    // Verify item belongs to company
    const existingItem = await prisma.catalogItem.findUnique({
      where: { id: req.params.id }
    });

    if (!existingItem || existingItem.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = await prisma.catalogItem.update({
      where: { id: req.params.id },
      data: {
        code,
        description,
        unit,
        price: parseFloat(price),
        categoryId,
        notes,
        isActive
      },
      include: { category: true }
    });
    res.json(item);
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Error updating item' });
  }
});

// Search catalog items
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { query, categoryId } = req.query;
    const items = await prisma.catalogItem.findMany({
      where: {
        companyId: req.user.companyId,
        isActive: true,
        categoryId: categoryId || undefined,
        OR: [
          { description: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: { category: true }
    });
    res.json(items);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Error searching items' });
  }
});


// Bulk import items
router.post('/bulk-import', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    
    const results = {
      successful: [],
      failed: []
    };

    // Process each item
    for (const item of items) {
      try {
        // Find or create category
        let category = await prisma.category.findFirst({
          where: {
            name: item.category,
            companyId: req.user.companyId
          }
        });

        if (!category) {
          category = await prisma.category.create({
            data: {
              name: item.category,
              companyId: req.user.companyId
            }
          });
        }

        // Create catalog item
        const catalogItem = await prisma.catalogItem.create({
          data: {
            code: item.code,
            description: item.description,
            unit: item.unit,
            price: parseFloat(item.price),
            notes: item.notes,
            categoryId: category.id,
            companyId: req.user.companyId
          }
        });

        results.successful.push(catalogItem);
      } catch (itemError) {
        results.failed.push({
          item,
          error: itemError.message
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Error during bulk import' });
  }
});

// Export items to CSV
router.get('/export', authMiddleware, async (req, res) => {
  try {
    // Get all items with their categories
    const items = await prisma.catalogItem.findMany({
      where: {
        companyId: req.user.companyId
      },
      include: {
        category: true
      }
    });

    // Format data for CSV
    const csvData = items.map(item => ({
      code: item.code,
      description: item.description,
      unit: item.unit,
      price: item.price.toString(),
      category: item.category.name,
      notes: item.notes || ''
    }));

    // Generate CSV
    const csv = await generateCSV(csvData);

    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=catalog-items.csv');
    
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Error exporting items' });
  }
});

// Parse CSV file and import items
router.post('/import-csv', authMiddleware, async (req, res) => {
  try {
    const fileData = req.body.fileContent;
    
    // Parse CSV data
    const items = await parseCSV(fileData);
    
    // Use bulk import endpoint
    const response = await router.handle(req.method, '/bulk-import').json({
      items
    });

    res.json(response);
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Error importing CSV' });
  }
});


// Import from Excel
router.post('/import-excel', authMiddleware, async (req, res) => {
  try {
    if (!req.body.fileContent) {
      return res.status(400).json({ error: 'No file content provided' });
    }

    // Convert base64 to buffer if needed
    const buffer = Buffer.from(req.body.fileContent, 'base64');
    
    // Process Excel file
    const items = processExcelFile(buffer);

    // Use bulk import logic
    const results = {
      successful: [],
      failed: []
    };

    // Process each item
    for (const item of items) {
      try {
        // Find or create category
        let category = await prisma.category.findFirst({
          where: {
            name: item.category,
            companyId: req.user.companyId
          }
        });

        if (!category) {
          category = await prisma.category.create({
            data: {
              name: item.category,
              companyId: req.user.companyId
            }
          });
        }

        // Create catalog item
        const catalogItem = await prisma.catalogItem.create({
          data: {
            code: item.code,
            description: item.description,
            unit: item.unit,
            price: item.price,
            notes: item.notes,
            categoryId: category.id,
            companyId: req.user.companyId
          }
        });

        results.successful.push(catalogItem);
      } catch (itemError) {
        results.failed.push({
          item,
          error: itemError.message
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Excel import error:', error);
    res.status(500).json({ error: 'Error importing Excel file' });
  }
});

// Export to Excel
router.get('/export-excel', authMiddleware, async (req, res) => {
  try {
    // Get all items with their categories
    const items = await prisma.catalogItem.findMany({
      where: {
        companyId: req.user.companyId
      },
      include: {
        category: true
      }
    });

    // Generate Excel file
    const buffer = generateExcel(items);

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=catalog-items.xlsx');
    
    res.send(buffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Error exporting to Excel' });
  }
});

module.exports = router;