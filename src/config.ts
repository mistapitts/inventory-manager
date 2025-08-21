// src/config.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const num = (v: string | undefined, d: number) =>
  Number.isFinite(Number(v)) ? Number(v) : d;

const str = (v: string | undefined, d: string) => (v && v.length ? v : d);

// Resolve from the project root regardless of running from src/ or dist/
const ROOT = process.cwd();

export const paths = {
  root: ROOT,
  publicDir: str(process.env.PUBLIC_DIR, 'public'),
  uploadDir: str(process.env.UPLOAD_DIR, 'uploads'),
  qrcodeDir: str(process.env.QRCODE_DIR, 'qrcodes'),
  dataDir: str(process.env.DATA_DIR, 'data'),
};

const runtimeConfig = {
  nodeEnv: str(process.env.NODE_ENV, 'production'),
  port: num(process.env.PORT, 3000),
  baseUrl: str(process.env.BASE_URL, ''),
  jwtSecret: str(process.env.JWT_SECRET, 'change-me-in-prod'),
  dbFile: str(process.env.DB_FILE, 'data.sqlite'),
  paths,
};

// Useful absolute paths (computed once)
export const ABS_PATHS = {
  PUBLIC: path.join(ROOT, paths.publicDir),
  UPLOADS: path.join(ROOT, paths.uploadDir),
  QRCODES: path.join(ROOT, paths.qrcodeDir),
  DATA_DIR: path.join(ROOT, paths.dataDir),
  DB_FILE: path.join(ROOT, paths.dataDir, runtimeConfig.dbFile),
};

// Small helper matching existing imports
export function ensureDirSync(dirPath: string): string {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

// Maintain the default export
export default runtimeConfig;

// Also export a named `config` to satisfy `import { config } from '../config'`
export { runtimeConfig as config };
