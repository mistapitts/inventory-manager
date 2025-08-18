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

// Helper function to generate QR code URL
function generateQRCodeUrl(itemId) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`item-${itemId}`)}`;
}

// Helper function to format date
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
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

// Inventory: get specific item
app.get('/api/inventory/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const itemId = req.params.id;
  const item = demoItems.find(item => item.id === itemId);
  
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Return the item in the structure the frontend expects
  res.json({ item: item });
});

// Inventory: add new item
app.post('/api/inventory', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    console.log('Received item data:', req.body); // Debug log
    
    const itemId = generateId();
    const currentDate = new Date();
    const nextCalDate = new Date(currentDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const nextMaintenanceDate = new Date(currentDate.getTime() + 180 * 24 * 60 * 60 * 1000);
    
    // Use the actual form data from the frontend
    const newItem = {
      id: itemId,
      itemType: req.body.itemType || 'Equipment',
      nickname: req.body.nickname || '',
      labId: req.body.labId || req.body.labNumber || `LAB-${itemId.substring(0, 4).toUpperCase()}`,
      make: req.body.make || '',
      model: req.body.model || '',
      serialNumber: req.body.serialNumber || req.body.serial || `SN-${itemId.substring(0, 6).toUpperCase()}`,
      condition: req.body.condition || req.body.conditionWhenReceived || 'Good',
      dateReceived: req.body.dateReceived || formatDate(currentDate),
      inService: req.body.inService !== undefined ? req.body.inService : true,
      datePlacedInService: req.body.datePlacedInService || req.body.dateReceived || formatDate(currentDate),
      location: req.body.location || 'In-House',
      calType: req.body.calType || req.body.calibrationType || 'In-House',
      lastCal: req.body.lastCal || req.body.lastCalibrationDate || formatDate(currentDate),
      nextCalDue: req.body.nextCalDue || formatDate(nextCalDate),
      calInterval: req.body.calInterval || '12 months',
      calMethod: req.body.calMethod || req.body.calibrationMethod || 'In-House',
      lastMaintenance: req.body.lastMaintenance || formatDate(currentDate),
      maintenanceDue: req.body.maintenanceDue || formatDate(nextMaintenanceDate),
      qrCodeUrl: generateQRCodeUrl(itemId),
      listId: req.body.listId || 'list-1',
      notes: req.body.notes || '',
      createdAt: currentDate.toISOString(),
      updatedAt: currentDate.toISOString()
    };

    console.log('Created item:', newItem); // Debug log
    
    demoItems.push(newItem);
    
    res.status(201).json({
      item: newItem,
      qrCodeUrl: newItem.qrCodeUrl,
      message: 'Item created successfully'
    });
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

// Inventory stats endpoint (to fix the 404 error)
app.get('/api/inventory/stats/overview', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const totalItems = demoItems.length;
  const dueThisMonth = demoItems.filter(item => {
    const nextCal = new Date(item.nextCalDue);
    const now = new Date();
    return nextCal.getMonth() === now.getMonth() && nextCal.getFullYear() === now.getFullYear();
  }).length;
  
  const maintenanceDue = demoItems.filter(item => {
    const maintenanceDate = new Date(item.maintenanceDue);
    const now = new Date();
    return maintenanceDate <= now;
  }).length;

  res.json({
    totalItems,
    dueThisMonth,
    maintenanceDue
  });
});

// SPA fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export the Express app for Vercel
module.exports = app;
