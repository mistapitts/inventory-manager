// src/config.ts
import 'dotenv/config'; // loads .env if present

const num = (v: string | undefined, d: number) =>
  Number.isFinite(Number(v)) ? Number(v) : d;

const str = (v: string | undefined, d: string) => (v && v.length ? v : d);

// Base paths: use cwd so it works from /dist and from src
// (Render runs from project root, app runs from dist, this stays stable)
export const paths = {
  root: process.cwd(),
  publicDir: str(process.env.PUBLIC_DIR, 'public'),
  uploadDir: str(process.env.UPLOAD_DIR, 'uploads'),
  qrcodeDir: str(process.env.QRCODE_DIR, 'qrcodes'),
  dataDir: str(process.env.DATA_DIR, 'data'),
};

const config = {
  nodeEnv: str(process.env.NODE_ENV, 'production'),
  port: num(process.env.PORT, 3000), // Render will pass PORT; we still default
  baseUrl: str(process.env.BASE_URL, ''),
  jwtSecret: str(process.env.JWT_SECRET, 'change-me-in-prod'),
  // If you use SQLite, pick a stable filename under DATA_DIR
  dbFile: str(process.env.DB_FILE, 'data.sqlite'),
  paths,
};

export default config;
