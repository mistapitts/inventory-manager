// Test Supabase connection and database access
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

// Test endpoint
app.get('/api/test-supabase', async (req, res) => {
  try {
    console.log('Testing Supabase connection...');

    // Test 1: Basic connection
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .limit(1);

    if (companiesError) {
      console.error('Companies query error:', companiesError);
      return res.status(500).json({
        error: 'Companies query failed',
        details: companiesError.message,
        code: companiesError.code,
      });
    }

    // Test 2: Lists query
    const { data: lists, error: listsError } = await supabase.from('lists').select('*').limit(1);

    if (listsError) {
      console.error('Lists query error:', listsError);
      return res.status(500).json({
        error: 'Lists query failed',
        details: listsError.message,
        code: listsError.code,
      });
    }

    res.json({
      status: 'Supabase connection successful!',
      companies: companies,
      lists: lists,
      message: 'Database queries are working',
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      error: 'Test endpoint failed',
      message: error.message,
      stack: error.stack,
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Test Supabase API is running',
    supabaseUrl: supabaseUrl ? 'Set' : 'Missing',
    supabaseKey: supabaseKey ? 'Set' : 'Missing',
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.json({
    message: 'Test Supabase API',
    availableEndpoints: ['/api/test-supabase', '/api/health'],
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;
