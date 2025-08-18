// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const path = require('path');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Inventory Manager API is running',
    environment: process.env.NODE_ENV || 'production'
  });
});

// Simple login endpoint (placeholder - will need database setup)
app.post('/api/auth/login', (req, res) => {
  res.status(501).json({ 
    error: 'Login not yet implemented in serverless environment',
    message: 'Database setup required for full functionality'
  });
});

// Simple lists endpoint (placeholder)
app.get('/api/inventory/lists', (req, res) => {
  res.status(501).json({ 
    error: 'Lists not yet implemented in serverless environment',
    message: 'Database setup required for full functionality'
  });
});

// SPA fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export the Express app for Vercel
module.exports = app;
