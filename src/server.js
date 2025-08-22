'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const path_1 = __importDefault(require('path'));
const express_1 = __importDefault(require('express'));
const cors_1 = __importDefault(require('cors'));
const dotenv_1 = __importDefault(require('dotenv'));
const config_1 = require('./config');
const database_1 = require('./models/database');
// Import routes
const auth_1 = __importDefault(require('./routes/auth'));
const company_1 = __importDefault(require('./routes/company'));
const inventory_1 = __importDefault(require('./routes/inventory'));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
/** Behind Render's proxy, trust X-Forwarded-* so req.protocol is correct */
app.set('trust proxy', true);
// Validate required environment variables
(0, config_1.validateRequiredEnv)();
// CORS: restrict if ALLOWED_ORIGINS is set, else permissive (dev)
if (config_1.config.allowedOrigins.length) {
  app.use((0, cors_1.default)({ origin: config_1.config.allowedOrigins }));
} else {
  app.use((0, cors_1.default)());
}
// Ensure upload directories exist
(0, config_1.ensureDirSync)(config_1.config.uploadPath);
(0, config_1.ensureDirSync)(path_1.default.join(config_1.config.uploadPath, 'docs'));
(0, config_1.ensureDirSync)(path_1.default.join(config_1.config.uploadPath, 'qr-codes'));
(0, config_1.ensureDirSync)(path_1.default.join(config_1.config.uploadPath, 'images'));
// Middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Serve static files
app.use('/uploads', express_1.default.static(config_1.config.uploadPath));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/inventory', inventory_1.default);
app.use('/api/company', company_1.default);
// Health check endpoint
app.get('/api/health', (req, res) => {
  // Test database connection
  database_1.database.db.get('SELECT 1 as ok', [], (err, row) => {
    if (err) {
      return res.status(500).json({
        status: 'ERR',
        db: false,
        timestamp: new Date().toISOString(),
        message: 'Database connection failed',
        environment: config_1.config.nodeEnv,
      });
    }
    return res.json({
      status: 'OK',
      db: !!row?.ok,
      timestamp: new Date().toISOString(),
      message: 'Inventory Manager API is running',
      environment: config_1.config.nodeEnv,
    });
  });
});
// SPA fallback for non-API routes (supports deep links like /item/:id)
app.get(/^\/(?!api|uploads).*/, (_req, res) => {
  res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});
// For Vercel serverless deployment, export the app
exports.default = app;
// Only start the server if this file is run directly (development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `🚀 Inventory Manager API running on port ${PORT} (env=${config_1.config.nodeEnv})`,
    );
    console.log(`📊 Database initialized successfully`);
    console.log(`🔐 Admin account ready`);
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${config_1.config.nodeEnv}`);
  });
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    database_1.database.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    database_1.database.close();
    process.exit(0);
  });
}
