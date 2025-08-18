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

// SPA fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export the Express app for Vercel
module.exports = app;
