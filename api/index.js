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
  { id: 'list-1', name: 'Active Equipment', color: '#10b981', textColor: '#ffffff', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'list-2', name: 'Calibration Due', color: '#f59e0b', textColor: '#ffffff', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'list-3', name: 'Maintenance Required', color: '#ef4444', textColor: '#ffffff', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }
];

// Demo inventory items
let demoItems = [];

// Helper functions
function generateToken(userId) { return jwt.sign({ userId }, process.env.JWT_SECRET || 'demo-secret-key', { expiresIn: '24h' }); }
function generateId() { return Math.random().toString(36).substr(2, 9); }
function generateQRCodeUrl(itemId) { return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`item-${itemId}`)}`; }
function formatDate(date) { return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }); }

// Health check endpoint
app.get('/api/health', (req, res) => { res.json({ status: 'OK', timestamp: new Date().toISOString(), message: 'Inventory Manager API is running', environment: process.env.NODE_ENV || 'production' }); });

// Demo login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (email === 'mistapitts@gmail.com' && password === 'demo123') {
      const token = generateToken(demoUser.id);
      res.json({ token, user: demoUser, company: demoCompany, location: null });
    } else { res.status(401).json({ error: 'Invalid credentials. Use: mistapitts@gmail.com / demo123' }); }
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// Company: setup demo company
app.post('/api/company/setup-demo', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  res.json({ company: demoCompany, message: 'Demo company setup successfully' });
});

// Lists
app.get('/api/inventory/lists', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  res.json({ lists: demoLists });
});

app.put('/api/inventory/lists/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  const listId = req.params.id; const idx = demoLists.findIndex(l => l.id === listId);
  if (idx === -1) return res.status(404).json({ error: 'List not found' });
  const { name, color, textColor } = req.body;
  demoLists[idx] = { ...demoLists[idx], name: name || demoLists[idx].name, color: color || demoLists[idx].color, textColor: textColor || demoLists[idx].textColor, updatedAt: new Date().toISOString() };
  res.json(demoLists[idx]);
});

// Inventory: list
app.get('/api/inventory', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  res.json({ items: demoItems });
});

// Inventory: details (return arrays frontend expects)
app.get('/api/inventory/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  const item = demoItems.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item, calibrationRecords: [], maintenanceRecords: [], changelog: [] });
});

// Inventory: create
app.post('/api/inventory', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  try {
    const itemId = generateId();
    const now = new Date();
    const nextCal = new Date(now.getTime() + 365*24*60*60*1000);
    const nextMaint = new Date(now.getTime() + 180*24*60*60*1000);
    const {
      itemType, nickname, labId, make, model, serialNumber, condition,
      dateReceived, datePlacedInService, location,
      calibrationDate, nextCalibrationDue, calibrationInterval, calibrationIntervalType, calibrationMethod, calibrationType,
      maintenanceDate, maintenanceDue, maintenanceInterval, maintenanceIntervalType,
      notes, listId
    } = req.body;

    const item = {
      id: itemId,
      itemType: itemType || 'Equipment',
      nickname: nickname || '',
      labId: labId || `LAB-${itemId.substring(0,4).toUpperCase()}`,
      make: make || '',
      model: model || '',
      serialNumber: serialNumber || `SN-${itemId.substring(0,6).toUpperCase()}`,
      condition: condition || 'Good',
      dateReceived: dateReceived || formatDate(now),
      datePlacedInService: datePlacedInService || dateReceived || formatDate(now),
      location: location || 'In-House',
      // Calibration fields used by table and modal
      calibrationDate: calibrationDate || formatDate(now),
      nextCalibrationDue: nextCalibrationDue || formatDate(nextCal),
      calibrationInterval: calibrationInterval || 12,
      calibrationIntervalType: calibrationIntervalType || 'months',
      calibrationMethod: calibrationMethod || 'In-House',
      calibrationType: calibrationType || 'in_house',
      isOutsourced: calibrationType === 'outsourced',
      // Maintenance fields
      maintenanceDate: maintenanceDate || formatDate(now),
      maintenanceDue: maintenanceDue || formatDate(nextMaint),
      maintenanceInterval: maintenanceInterval || null,
      maintenanceIntervalType: maintenanceIntervalType || null,
      // Misc
      qrCodeUrl: generateQRCodeUrl(itemId),
      listId: listId || 'list-1',
      notes: notes || '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    demoItems.push(item);
    res.status(201).json({ item, qrCodeUrl: item.qrCodeUrl, message: 'Item created successfully' });
  } catch (e) { res.status(500).json({ error: 'Failed to add item' }); }
});

// Inventory: update/delete
app.put('/api/inventory/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  const idx = demoItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  demoItems[idx] = { ...demoItems[idx], ...req.body, updatedAt: new Date().toISOString() };
  res.json(demoItems[idx]);
});

app.delete('/api/inventory/:id', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  const idx = demoItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  demoItems.splice(idx, 1);
  res.json({ message: 'Item deleted successfully' });
});

// Inventory stats
app.get('/api/inventory/stats/overview', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  const totalItems = demoItems.length;
  const now = new Date();
  const dueThisMonth = demoItems.filter(i => { const d = new Date(i.nextCalibrationDue); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const maintenanceDue = demoItems.filter(i => new Date(i.maintenanceDue) <= now).length;
  res.json({ totalItems, dueThisMonth, maintenanceDue });
});

// SPA fallback
app.get(/^\/(?!api).*/, (req, res) => { res.sendFile(path.join(__dirname, '../public/index.html')); });

module.exports = app;
