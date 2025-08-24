// src/config.ts
import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';

// Load .env if present (harmless in production)
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

/**
 * CORS allowed origins for security
 * Comma-separated list of allowed domains
 */
export const corsAllowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Root for persistent data.
 * Default to /var/data (Render disk). Locally, default to <project>/data.
 */
const DATA_DIR = process.env.DATA_DIR || (isProd ? '/var/data' : path.join(process.cwd(), 'data'));

/**
 * Specific paths derived from DATA_DIR.
 * Allow explicit overrides via env if provided.
 */
const PATHS = {
  dataDir: DATA_DIR,
  dbFile: process.env.DB_PATH || path.join(DATA_DIR, process.env.DB_FILE || 'data.sqlite'),
  uploadDir: process.env.UPLOAD_DIR || path.join(DATA_DIR, 'uploads'),
  uploadDocsDir: process.env.UPLOAD_DOCS_DIR || path.join(DATA_DIR, 'uploads', 'docs'),
  qrcodeDir: process.env.QRCODE_DIR || path.join(DATA_DIR, 'qrcodes'),
  publicDir: process.env.PUBLIC_DIR || path.join(process.cwd(), 'public'), // static assets
};

/**
 * Ensure directories exist. Safe to call at startup.
 */
function ensureDirSync(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function ensureBootPaths() {
  ensureDirSync(PATHS.dataDir);
  ensureDirSync(PATHS.uploadDir);
  ensureDirSync(PATHS.uploadDocsDir);
  ensureDirSync(PATHS.qrcodeDir);
  // Ensure logos directory exists
  ensureDirSync(path.join(PATHS.uploadDir, 'logos'));

  // Note: Don't create the DB file - let SQLite create it when it connects
  // This prevents permission issues and ensures proper SQLite initialization
}

// Call once on import to guarantee structure
ensureBootPaths();

export const config = {
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 3000), // Keep default port 3000 for local dev
    baseUrl:
      process.env.BASE_URL ||
      (isProd ? 'https://inventory-manager-d2we.onrender.com' : 'http://localhost:3000'), // Use actual domain in prod
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-prod',
  },
  paths: PATHS,
  ensureDirSync,
  ensureBootPaths,
};

export default config;
