const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const DocumentGenerator = require('../utils/documentGenerator');
const { Packer } = require('docx');

// Generate quote number
async function generateQuoteNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const count = await prisma.quote.count({
    where: {
      createdAt: {
        gte: new Date(date.getFullYear(), date.getMonth(), 1),
        lt: new Date(date.getFullYear(), date.getMonth() + 1, 1)
      }
    }
  });

  return `Q${year}${month}-${String(count + 1).padStart(3, '0')}`;
}

// Create new quote
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, items } = req.body;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price * (1 - item.discount/100)), 0);
    const vat = subtotal * 0.18; // 18% VAT
    const total = subtotal + vat;

    const quote = await prisma.quote.create({
      data: {
        number: await generateQuoteNumber(),
        title,
        subtotal,
        vat: 18,
        total,
        companyId: req.user.companyId,
        items: {
          create: items.map(item => ({
            catalogItemId: item.catalogItemId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount || 0,
            total: item.quantity * item.price * (1 - (item.discount || 0)/100),
            notes: item.notes
          }))
        }
      },
      include: {
        items: {
          include: {
            catalogItem: true
          }
        }
      }
    });

    res.json(quote);
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ error: 'Error creating quote' });
  }
});

// Get all quotes
router.get('/', authMiddleware, async (req, res) => {
    try {
      const quotes = await prisma.quote.findMany({
        where: {
          companyId: req.user.companyId
        },
        include: {
          items: {
            include: {
              catalogItem: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      res.json(quotes);
    } catch (error) {
      console.error('Fetch quotes error:', error);
      res.status(500).json({ error: 'Error fetching quotes' });
    }
  });
  
  // Get quote by ID
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const quote = await prisma.quote.findUnique({
        where: { id: req.params.id },
        include: {
          items: {
            include: {
              catalogItem: true
            }
          }
        }
      });
  
      if (!quote || quote.companyId !== req.user.companyId) {
        return res.status(404).json({ error: 'Quote not found' });
      }
  
      res.json(quote);
    } catch (error) {
      console.error('Fetch quote error:', error);
      res.status(500).json({ error: 'Error fetching quote' });
    }
  });
  
  // Update quote status
  router.patch('/:id/status', authMiddleware, async (req, res) => {
    try {
      const { status } = req.body;
      
      const quote = await prisma.quote.findUnique({
        where: { id: req.params.id }
      });
  
      if (!quote || quote.companyId !== req.user.companyId) {
        return res.status(404).json({ error: 'Quote not found' });
      }
  
      const updatedQuote = await prisma.quote.update({
        where: { id: req.params.id },
        data: { status },
        include: {
          items: {
            include: {
              catalogItem: true
            }
          }
        }
      });
  
      res.json(updatedQuote);
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Error updating quote status' });
    }
  });
  
  // Delete quote
  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const quote = await prisma.quote.findUnique({
        where: { id: req.params.id }
      });
  
      if (!quote || quote.companyId !== req.user.companyId) {
        return res.status(404).json({ error: 'Quote not found' });
      }
  
      await prisma.quote.delete({
        where: { id: req.params.id }
      });
  
      res.json({ message: 'Quote deleted successfully' });
    } catch (error) {
      console.error('Delete quote error:', error);
      res.status(500).json({ error: 'Error deleting quote' });
    }
  });

  const DocumentGenerator = require('../utils/documentGenerator');
const { Packer } = require('docx');

// Export quote as PDF
router.get('/:id/export/pdf', authMiddleware, async (req, res) => {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            catalogItem: true
          }
        }
      }
    });

    if (!quote || quote.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quote.number}.pdf"`);

    await DocumentGenerator.generatePDF(quote, res);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Error generating PDF' });
  }
});

// Export quote as Word document
router.get('/:id/export/word', authMiddleware, async (req, res) => {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            catalogItem: true
          }
        }
      }
    });

    if (!quote || quote.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const doc = await DocumentGenerator.generateWord(quote);
    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quote.number}.docx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Word generation error:', error);
    res.status(500).json({ error: 'Error generating Word document' });
  }
});

  
  module.exports = router;

