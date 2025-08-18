// Vercel serverless function entry point
const app = require('../dist/server.js').default;

// Export the Express app for Vercel
module.exports = app;
