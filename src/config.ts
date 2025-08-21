// src/config.ts
import fs from 'fs';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || '',
  dbPath: process.env.DB_PATH || path.resolve('./data/inventory.db'),
  uploadPath: process.env.UPLOAD_PATH || path.resolve('./uploads'),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  isProd,
};

export function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function validateRequiredEnv() {
  if (config.isProd && !config.jwtSecret) {
    throw new Error('JWT_SECRET is required in production');
  }
}
