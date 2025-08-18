// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Database setup
let db;
async function initDatabase() {
  if (!db) {
    db = await open({
      filename: path.join(__dirname, '../data/inventory.db'),
      driver: sqlite3.Database
    });
  }
  return db;
}

// Helper function to generate IDs
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Helper function to generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Inventory Manager API is running',
    environment: process.env.NODE_ENV || 'production'
  });
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const database = await initDatabase();

    // Get user from database
    const user = await database.get(
      'SELECT * FROM users WHERE email = ? AND isActive = 1',
      [email]
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
    const token = generateToken(user.id);

    // Get company info if user has one
    let company = null;
    if (user.companyId) {
      company = await database.get(
        'SELECT id, name, logo, theme FROM companies WHERE id = ?',
        [user.companyId]
      );
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
        regionId: user.regionId
      },
      company,
      location: null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Lists: get all lists for current user's company
app.get('/api/inventory/lists', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const database = await initDatabase();
    
    const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
    if (!user || !user.companyId) {
      return res.status(400).json({ error: 'User not associated with a company' });
    }
    
    let lists = await database.all(
      'SELECT id, name, color, textColor, createdAt, updatedAt FROM lists WHERE companyId = ? ORDER BY name', 
      [user.companyId]
    );
    res.json({ lists });
  } catch (error) {
    console.error('Error fetching lists:', error);
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

// SPA fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export the Express app for Vercel
module.exports = app;
