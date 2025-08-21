import path from 'path';

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';

import config from './config';
import { database } from './models/database';

// Import routes
import authRoutes from './routes/auth';
import companyRoutes from './routes/company';
import inventoryRoutes from './routes/inventory';

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? config.port);

/** Behind Render's proxy, trust X-Forwarded-* so req.protocol is correct */
app.set('trust proxy', true);

// CORS: permissive for now (can be restricted later with ALLOWED_ORIGINS)
app.use(cors());

// Ensure required directories exist
const PUBLIC_DIR = path.join(process.cwd(), config.paths.publicDir);
const UPLOAD_DIR = path.join(process.cwd(), config.paths.uploadDir);
const QRCODE_DIR = path.join(process.cwd(), config.paths.qrcodeDir);
const DATA_DIR = path.join(process.cwd(), config.paths.dataDir);

for (const dir of [UPLOAD_DIR, QRCODE_DIR, DATA_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

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
        environment: config.nodeEnv,
      });
    }
    return res.json({
      status: 'OK',
      db: !!row?.ok,
      timestamp: new Date().toISOString(),
      message: 'Inventory Manager API is running',
      environment: config.nodeEnv,
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
    console.log(`🚀 Inventory Manager API running on port ${PORT} (env=${config.nodeEnv})`);
    console.log(`📁 Public dir: ${PUBLIC_DIR}`);
    console.log(`📁 Upload dir: ${UPLOAD_DIR}`);
    console.log(`📁 Data dir: ${DATA_DIR}`);
  });
}
