// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Demo user data
const demoUser = {
  id: 'demo-user-123',
  email: 'mistapitts@gmail.com',
  firstName: 'Mista',
  lastName: 'Pitts',
  role: 'admin',
  companyId: 'demo-company-456',
  regionId: 'demo-region-789'
};

const demoCompany = {
  id: 'demo-company-456',
  name: 'Demo Company',
  logo: null,
  theme: 'default'
};

// Helper function to generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'demo-secret-key', { expiresIn: '24h' });
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

// Demo login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Demo credentials
    if (email === 'mistapitts@gmail.com' && password === 'demo123') {
      const token = generateToken(demoUser.id);
      
      res.json({
        token,
        user: {
          id: demoUser.id,
          email: demoUser.email,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          role: demoUser.role,
          companyId: demoUser.companyId,
          regionId: demoUser.regionId
        },
        company: demoCompany,
        location: null
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials. Use: mistapitts@gmail.com / demo123' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Demo lists endpoint
app.get('/api/inventory/lists', (req, res) => {
  // Check for authorization header
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Demo lists data
  const demoLists = [
    {
      id: 'list-1',
      name: 'Active Equipment',
      color: '#10b981',
      textColor: '#ffffff',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'list-2', 
      name: 'Calibration Due',
      color: '#f59e0b',
      textColor: '#ffffff',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'list-3',
      name: 'Maintenance Required',
      color: '#ef4444',
      textColor: '#ffffff',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    }
  ];

  res.json({ lists: demoLists });
});

// SPA fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export the Express app for Vercel
module.exports = app;
