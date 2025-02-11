const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { processLogo } = require('../utils/fileUpload');
const router = express.Router();
const prisma = new PrismaClient();

// Get company profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });
    res.json(company);
  } catch (error) {
    console.error('Company profile error:', error);
    res.status(500).json({ error: 'Error fetching company profile' });
  }
});

// Update company profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const company = await prisma.company.update({
      where: { id: req.user.companyId },
      data: { name, phone, email, address }
    });
    res.json(company);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Error updating company profile' });
  }
});


// Upload company logo
router.post('/logo', authMiddleware, async (req, res) => {
  try {
    if (!req.body.logo) {
      return res.status(400).json({ error: 'No logo provided' });
    }

    // Process base64 logo data
    const logoBuffer = Buffer.from(req.body.logo, 'base64');
    const processedLogo = await processLogo(logoBuffer);

    // Update company with logo
    const company = await prisma.company.update({
      where: { id: req.user.companyId },
      data: {
        logoData: processedLogo,
        logoMime: req.body.mimeType || 'image/png'
      }
    });

    res.json({ message: 'Logo updated successfully' });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'Error uploading logo' });
  }
});

// Delete company logo
router.delete('/logo', authMiddleware, async (req, res) => {
  try {
    await prisma.company.update({
      where: { id: req.user.companyId },
      data: {
        logoData: null,
        logoMime: null
      }
    });

    res.json({ message: 'Logo removed successfully' });
  } catch (error) {
    console.error('Logo deletion error:', error);
    res.status(500).json({ error: 'Error removing logo' });
  }
});

module.exports = router;