// Simple debug endpoint to test serverless function and environment variables
const express = require('express');
const app = express();

app.use(express.json());

// Debug endpoint to check environment variables and basic functionality
app.get('/api/debug', (req, res) => {
  try {
    const envVars = {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      NODE_ENV: process.env.NODE_ENV || 'Not set',
      timestamp: new Date().toISOString()
    };
    
    res.json({
      status: 'Debug endpoint working',
      environment: envVars,
      message: 'If you see this, the basic serverless function is working'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message,
      stack: error.stack
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Debug API is running'
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.json({
    message: 'Debug API endpoint',
    availableEndpoints: ['/api/debug', '/api/health'],
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
