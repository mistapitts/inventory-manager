import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { database } from './models/database';
import { config, validateRequiredEnv, ensureDirSync } from './config';

// Import routes
import authRoutes from './routes/auth';
import inventoryRoutes from './routes/inventory';
import companyRoutes from './routes/company';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/** Behind Render's proxy, trust X-Forwarded-* so req.protocol is correct */
app.set('trust proxy', true);

// Validate required environment variables
validateRequiredEnv();

// CORS: restrict if ALLOWED_ORIGINS is set, else permissive (dev)
if (config.allowedOrigins.length) {
  app.use(cors({ origin: config.allowedOrigins }));
} else {
  app.use(cors());
}

// Ensure upload directories exist
ensureDirSync(config.uploadPath);
ensureDirSync(path.join(config.uploadPath, 'docs'));
ensureDirSync(path.join(config.uploadPath, 'qr-codes'));
ensureDirSync(path.join(config.uploadPath, 'images'));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads', express.static(config.uploadPath));
app.use(express.static(path.join(__dirname, '../public')));

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
        environment: config.nodeEnv
      });
    }
    return res.json({ 
      status: 'OK', 
      db: !!row?.ok,
      timestamp: new Date().toISOString(),
      message: 'Inventory Manager API is running',
      environment: config.nodeEnv
    });
  });
});

// SPA fallback for non-API routes (supports deep links like /item/:id)
app.get(/^\/(?!api|uploads).*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  app.listen(PORT, () => {
    console.log(`🚀 Inventory Manager API running on port ${PORT} (env=${config.nodeEnv})`);
    console.log(`📊 Database initialized successfully`);
    console.log(`🔐 Admin account ready`);
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    database.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    database.close();
    process.exit(0);
  });
}
