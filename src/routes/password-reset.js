const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();
const prisma = new PrismaClient();

// Request password reset
router.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.json({ message: 'If an account exists, a reset link will be sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token
    await prisma.passwordReset.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt
      }
    });

    // Send reset email
    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'If an account exists, a reset link will be sent' });
  } catch (error) {
    console.error('Reset request error:', error);
    res.status(500).json({ error: 'Error processing reset request' });
  }
});


// Reset password with token
router.post('/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Find valid reset token
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and delete reset token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword }
      }),
      prisma.passwordReset.delete({
        where: { id: resetRecord.id }
      })
    ]);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

module.exports = router;