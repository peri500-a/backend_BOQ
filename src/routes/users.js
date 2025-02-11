const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get company users (admin only)
router.get('/company-users', authMiddleware, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.user.companyId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Add new user to company (admin only)
router.post('/company-users', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        companyId: req.user.companyId
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Update user (admin only)
router.put('/company-users/:id', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    // Verify user belongs to same company
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        updatedAt: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Delete user (admin only)
router.delete('/company-users/:id', authMiddleware, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Verify user belongs to same company
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.companyId !== req.user.companyId) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last admin
    const adminCount = await prisma.user.count({
      where: {
        companyId: req.user.companyId,
        role: 'ADMIN'
      }
    });

    if (adminCount <= 1 && user.role === 'ADMIN') {
      return res.status(400).json({ error: 'Cannot delete last admin user' });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
});

module.exports = router;