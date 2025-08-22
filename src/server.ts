import fs from 'fs';
import path from 'path';

import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Request, type Response, type NextFunction } from 'express';

import config from './config';
import { database } from './models/database';

// Import routes
import authRoutes from './routes/auth';
import companyRoutes from './routes/company';
import inventoryRoutes from './routes/inventory';
import storageRoutes from './routes/storage';

const app = express();
// Ensure we respect process.env.PORT for Render deployment
const PORT = Number(process.env.PORT) || config.env.port;

/** Behind Render's proxy, trust X-Forwarded-* so req.protocol is correct */
app.set('trust proxy', true);

// CORS: permissive for now (can be restricted later with ALLOWED_ORIGINS)
app.use(cors());

// Directories are now handled by config.ensureBootPaths()
const PUBLIC_DIR = config.paths.publicDir;
const UPLOAD_DIR = config.paths.uploadDir;
const QRCODE_DIR = config.paths.qrcodeDir;
const DATA_DIR = config.paths.dataDir;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/public', express.static(PUBLIC_DIR));
app.use(express.static(PUBLIC_DIR)); // also serve at root

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/storage', storageRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  // Test database connection
  database.db.get('SELECT 1 as ok', [], (err: any, row: any) => {
    if (err) {
      return res.status(500).json({
        status: 'ERR',
        db: false,
        timestamp: new Date().toISOString(),
        message: 'Database connection failed',
        environment: config.env.nodeEnv,
      });
    }
    return res.json({
      status: 'OK',
      db: !!row?.ok,
      timestamp: new Date().toISOString(),
      message: 'Inventory Manager API is running',
      environment: config.env.nodeEnv,
      dataDir: config.paths.dataDir,
      dbFile: config.paths.dbFile,
      uploadDir: config.paths.uploadDir,
      uploadDocsDir: config.paths.uploadDocsDir,
      qrcodeDir: config.paths.qrcodeDir,
    });
  });
});

// SPA fallback for non-API routes (supports deep links like /item/:id)
app.get(/^\/(?!api|uploads).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// For Vercel serverless deployment, export the app
export default app;

// Only start the server if this file is run directly (development)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Inventory Manager API running on port ${PORT} (env=${config.env.nodeEnv})`);
    console.log(`📁 Public dir: ${PUBLIC_DIR}`);
    console.log(`📁 Upload dir: ${UPLOAD_DIR}`);
    console.log(`📁 Upload docs dir: ${config.paths.uploadDocsDir}`);
    console.log(`📁 Data dir: ${DATA_DIR}`);
    console.log(`🗄️ DB file:   ${config.paths.dbFile}`);
  });
}
