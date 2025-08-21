"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.ensureDirSync = ensureDirSync;
exports.validateRequiredEnv = validateRequiredEnv;
// src/config.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const isProd = process.env.NODE_ENV === 'production';
exports.config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || '',
    dbPath: process.env.DB_PATH || path_1.default.resolve('./data/inventory.db'),
    uploadPath: process.env.UPLOAD_PATH || path_1.default.resolve('./uploads'),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    isProd,
};
function ensureDirSync(dir) {
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
}
function validateRequiredEnv() {
    if (exports.config.isProd && !exports.config.jwtSecret) {
        throw new Error('JWT_SECRET is required in production');
    }
}
