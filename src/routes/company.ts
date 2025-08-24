import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';

import { authenticateToken } from '../middleware/auth';
import { database } from '../models/database';
import { UserRole } from '../types';
import { config } from '../config';

const router = Router();

// Create a simple company for demo purposes
router.post('/setup-demo', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Check if demo company already exists
    const existingCompany = await database.get('SELECT id FROM companies WHERE name = ?', [
      "Randy's Company",
    ]);

    if (existingCompany) {
      return res.status(400).json({ error: 'Demo company already exists' });
    }

    // Create demo company
    const companyId = generateId();
    await database.run(
      `
            INSERT INTO companies (
                id, name, isActive, createdAt, updatedAt
            ) VALUES (?, ?, 1, datetime('now'), datetime('now'))
        `,
      [companyId, "Randy's Company"],
    );

    // Create demo location
    const locationId = generateId();
    await database.run(
      `
            INSERT INTO locations (
                id, companyId, name, level, isActive, createdAt, updatedAt
            ) VALUES (?, ?, 'Main Lab', 'lab', 1, datetime('now'), datetime('now'))
        `,
      [locationId, companyId],
    );

    // Update current user to be associated with this company
    await database.run(
      `
            UPDATE users 
            SET companyId = ?, role = ?
            WHERE id = ?
        `,
      [companyId, UserRole.COMPANY_OWNER, req.user!.id],
    );

    res.json({
      message: 'Demo company setup successfully',
      companyId,
      locationId,
    });
  } catch (error) {
    console.error('Error setting up demo company:', error);
    res.status(500).json({ error: 'Failed to setup demo company' });
  }
});

// Get company info for current user
router.get('/info', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await database.get(
      `SELECT u.*, c.* FROM users u LEFT JOIN companies c ON u.companyId = c.id WHERE u.id = ?`,
      [userId],
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.companyId) {
      return res.json({ user, company: null, users: [] });
    }

    // Get company info
    const company = await database.get(
      `SELECT * FROM companies WHERE id = ?`,
      [user.companyId],
    );

    // Get company users (for user management)
    const users = await database.all(
      `SELECT id, email, firstName, lastName, role, isActive, createdAt FROM users WHERE companyId = ? ORDER BY role, firstName`,
      [user.companyId],
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
      },
      company,
      users,
    });
  } catch (error) {
    console.error('Error fetching company info:', error);
    res.status(500).json({ error: 'Failed to fetch company info' });
  }
});

// Update company information
router.patch('/update', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, phone, email, website, address, city, state, zipCode, country, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Get user's company
    const user = await database.get('SELECT companyId, role FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Check permissions (only company_owner and admin can update)
    if (user.role !== 'company_owner' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions to update company information' });
    }

    // Update company
    await database.run(
      `UPDATE companies SET 
         name = ?, phone = ?, email = ?, website = ?, address = ?, 
         city = ?, state = ?, zipCode = ?, country = ?, description = ?,
         updatedAt = datetime('now')
       WHERE id = ?`,
      [name.trim(), phone || null, email || null, website || null, address || null, 
       city || null, state || null, zipCode || null, country || 'United States', 
       description || null, user.companyId],
    );

    res.json({ message: 'Company information updated successfully' });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company information' });
  }
});

// Invite user to company
router.post('/invite-user', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { email, firstName, lastName, role } = req.body;

    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate role
    const validRoles = ['company_manager', 'region_manager', 'lab_manager', 'user', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Get user's company
    const user = await database.get('SELECT companyId, role FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Check permissions (only company_owner and admin can invite)
    if (user.role !== 'company_owner' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions to invite users' });
    }

    // Check if user already exists
    const existingUser = await database.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate invite code
    const inviteCode = generateId().substring(0, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create invite code record
    await database.run(
      `INSERT INTO invite_codes (id, companyId, code, role, email, firstName, lastName, expiresAt, isUsed, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
      [generateId(), user.companyId, inviteCode, role, email, firstName, lastName, expiresAt.toISOString()],
    );

    // TODO: Send email with invite code
    // For now, we'll just return the invite code
    res.json({ 
      message: 'Invitation created successfully',
      inviteCode,
      expiresAt: expiresAt.toISOString(),
      // In production, you would send this via email instead of returning it
      inviteLink: `${req.protocol}://${req.get('host')}/register?invite=${inviteCode}`
    });
  } catch (error) {
    console.error('Error creating user invitation:', error);
    res.status(500).json({ error: 'Failed to create user invitation' });
  }
});

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const logoDir = path.join(config.paths.uploadDir, 'logos');
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common image formats
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Please use JPG, PNG, GIF, WEBP, or SVG.`));
    }
  }
});

// Upload company logo
router.post('/upload-logo', authenticateToken, upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user's company
    const user = await database.get('SELECT companyId, role FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Check permissions (only company_owner and admin can upload logo)
    if (user.role !== 'company_owner' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions to upload company logo' });
    }

    // Update company logo path
    const logoPath = `/uploads/logos/${req.file.filename}`;
    await database.run(
      `UPDATE companies SET logo = ?, updatedAt = datetime('now') WHERE id = ?`,
      [logoPath, user.companyId],
    );

    res.json({ 
      message: 'Logo uploaded successfully',
      logoPath 
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Remove company logo
router.delete('/remove-logo', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's company
    const user = await database.get('SELECT companyId, role FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }

    // Check permissions (only company_owner and admin can remove logo)
    if (user.role !== 'company_owner' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions to remove company logo' });
    }

    // Remove logo from company
    await database.run(
      `UPDATE companies SET logo = NULL, updatedAt = datetime('now') WHERE id = ?`,
      [user.companyId],
    );

    res.json({ message: 'Logo removed successfully' });
  } catch (error) {
    console.error('Error removing logo:', error);
    res.status(500).json({ error: 'Failed to remove logo' });
  }
});

// Helper function to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default router;
