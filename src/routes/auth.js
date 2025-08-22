'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = require('express');
const bcrypt = __importStar(require('bcryptjs'));
const auth_1 = require('../middleware/auth');
const database_1 = require('../models/database');
const types_1 = require('../types');
const router = (0, express_1.Router)();
// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    // Get user from database
    const user = await database_1.database.get(
      'SELECT * FROM users WHERE email = ? AND isActive = 1',
      [email],
    );
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Generate token
    const token = (0, auth_1.generateToken)(user.id);
    // Get company info if user has one
    let company = null;
    if (user.companyId) {
      company = await database_1.database.get(
        'SELECT id, name, logo, theme FROM companies WHERE id = ?',
        [user.companyId],
      );
    }
    // Location is not used in this simplified flow
    const location = null;
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
        regionId: user.regionId,
      },
      company,
      location,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Register route (for new users with invite codes)
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, inviteCode } = req.body;
    if (!email || !password || !firstName || !lastName || !inviteCode) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    // Check if user already exists
    const existingUser = await database_1.database.get('SELECT id FROM users WHERE email = ?', [
      email,
    ]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    // Validate invite code
    const invite = await database_1.database.get(
      'SELECT * FROM invite_codes WHERE code = ? AND isUsed = 0 AND expiresAt > datetime("now")',
      [inviteCode],
    );
    if (!invite) {
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    // Create user
    const userId = generateId();
    await database_1.database.run(
      'INSERT INTO users (id, email, password, firstName, lastName, role, companyId, locationId, regionId, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        email,
        hashedPassword,
        firstName,
        lastName,
        invite.role,
        invite.companyId,
        invite.locationId,
        invite.regionId,
        true,
      ],
    );
    // Mark invite code as used
    await database_1.database.run('UPDATE invite_codes SET isUsed = 1 WHERE id = ?', [invite.id]);
    // Generate token
    const token = (0, auth_1.generateToken)(userId);
    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        role: invite.role,
        companyId: invite.companyId,
        locationId: invite.locationId,
        regionId: invite.regionId,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Get current user profile
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const user = await database_1.database.get(
      'SELECT id, email, firstName, lastName, role, companyId, regionId, isActive, createdAt FROM users WHERE id = ?',
      [req.user.id],
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Get company info
    let company = null;
    if (user.companyId) {
      company = await database_1.database.get(
        'SELECT id, name, logo, theme FROM companies WHERE id = ?',
        [user.companyId],
      );
    }
    const location = null;
    res.json({
      user: {
        ...user,
        company,
        location,
      },
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Change password
router.put('/change-password', auth_1.authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    // Get current user
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const user = await database_1.database.get('SELECT password FROM users WHERE id = ?', [
      req.user.id,
    ]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    // Update password
    await database_1.database.run(
      'UPDATE users SET password = ?, updatedAt = datetime("now") WHERE id = ?',
      [hashedPassword, req.user.id],
    );
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Admin: Create new user
router.post(
  '/admin/create-user',
  auth_1.authenticateToken,
  (0, auth_1.requireRole)([types_1.UserRole.ADMIN]),
  async (req, res) => {
    try {
      const { email, password, firstName, lastName, role, companyId, locationId, regionId } =
        req.body;
      if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ error: 'Required fields missing' });
      }
      // Check if user already exists
      const existingUser = await database_1.database.get('SELECT id FROM users WHERE email = ?', [
        email,
      ]);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      // Create user
      const userId = generateId();
      await database_1.database.run(
        'INSERT INTO users (id, email, password, firstName, lastName, role, companyId, locationId, regionId, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          userId,
          email,
          hashedPassword,
          firstName,
          lastName,
          role,
          companyId || null,
          locationId || null,
          regionId || null,
          true,
        ],
      );
      res.status(201).json({
        message: 'User created successfully',
        userId,
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
// Admin: Get all users
router.get(
  '/admin/users',
  auth_1.authenticateToken,
  (0, auth_1.requireRole)([types_1.UserRole.ADMIN]),
  async (req, res) => {
    try {
      const users = await database_1.database.all(
        'SELECT id, email, firstName, lastName, role, companyId, locationId, regionId, isActive, createdAt FROM users ORDER BY createdAt DESC',
      );
      res.json({ users });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
exports.default = router;
