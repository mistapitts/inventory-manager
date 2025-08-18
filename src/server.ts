import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { database } from './models/database';

// Import routes
import authRoutes from './routes/auth';
import inventoryRoutes from './routes/inventory';
import companyRoutes from './routes/company';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Ensure upload directories exist (only in development)
if (process.env.NODE_ENV !== 'production') {
  const uploadBase = path.join(__dirname, '../uploads');
  const docsDir = path.join(uploadBase, 'docs');
  const qrDir = path.join(uploadBase, 'qr-codes');
  const imagesDir = path.join(uploadBase, 'images');
  [uploadBase, docsDir, qrDir, imagesDir].forEach((dir) => {
    try {
      if (!require('fs').existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed creating upload dir', dir, e);
    }
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/company', companyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Inventory Manager API is running',
    environment: process.env.NODE_ENV || 'development'
  });
});

// SPA fallback for non-API routes (supports deep links like /item/:id)
app.get(/^\/(?!api|uploads).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// For Vercel serverless deployment, export the app
export default app;

// Only start the server if this file is run directly (development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Inventory Manager API running on port ${PORT}`);
    console.log(`📊 Database initialized successfully`);
    console.log(`🔐 Admin account ready`);
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
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
