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

// Demo lists data
let demoLists = [
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

// Demo inventory items
let demoItems = [];

// Helper function to generate JWT token
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'demo-secret-key', { expiresIn: '24h' });
}

// Helper function to generate IDs
function generateId() {
  return Math.random().toString(36).substr(2, 9);
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

// Company: setup demo company
app.post('/api/company/setup-demo', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Return the demo company data
    res.json({
      company: demoCompany,
      message: 'Demo company setup successfully'
    });
  } catch (error) {
    console.error('Error setting up demo company:', error);
    res.status(500).json({ error: 'Failed to setup demo company' });
  }
});

// Lists: get all lists
app.get('/api/inventory/lists', (req, res) => {
  // Check for authorization header
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  res.json({ lists: demoLists });
});

// Lists: update a specific list
app.put('/api/inventory/lists/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const listId = req.params.id;
  const { name, color, textColor } = req.body;

  const listIndex = demoLists.findIndex(list => list.id === listId);
  if (listIndex === -1) {
    return res.status(404).json({ error: 'List not found' });
  }

  // Update the list
  demoLists[listIndex] = {
    ...demoLists[listIndex],
    name: name || demoLists[listIndex].name,
    color: color || demoLists[listIndex].color,
    textColor: textColor || demoLists[listIndex].textColor,
    updatedAt: new Date().toISOString()
  };

  res.json(demoLists[listIndex]);
});

// Inventory: get all items
app.get('/api/inventory', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  res.json({ items: demoItems });
});

// Inventory: add new item
app.post('/api/inventory', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const newItem = {
      id: generateId(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    demoItems.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Inventory: update item
app.put('/api/inventory/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const itemId = req.params.id;
  const itemIndex = demoItems.findIndex(item => item.id === itemId);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  demoItems[itemIndex] = {
    ...demoItems[itemIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  res.json(demoItems[itemIndex]);
});

// Inventory: delete item
app.delete('/api/inventory/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const itemId = req.params.id;
  const itemIndex = demoItems.findIndex(item => item.id === itemId);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  demoItems.splice(itemIndex, 1);
  res.json({ message: 'Item deleted successfully' });
});

// SPA fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export the Express app for Vercel
module.exports = app;
