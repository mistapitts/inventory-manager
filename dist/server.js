"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = __importStar(require("./config"));
const database_1 = require("./models/database");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const company_1 = __importDefault(require("./routes/company"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const storage_1 = __importDefault(require("./routes/storage"));
const app = (0, express_1.default)();
// Ensure we respect process.env.PORT for Render deployment
const PORT = Number(process.env.PORT) || config_1.default.env.port;
/** Behind Render's proxy, trust X-Forwarded-* so req.protocol is correct */
app.set('trust proxy', 1);
// Security headers
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allows file downloads
}));
// CORS: secure configuration with allow-list
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        if (!origin || config_1.corsAllowedOrigins.length === 0 || config_1.corsAllowedOrigins.includes(origin)) {
            return cb(null, true);
        }
        return cb(new Error("CORS: origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    maxAge: 600,
}));
app.options("*", (0, cors_1.default)()); // preflight
// Rate limiting for login endpoint
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: 50, // max 50 requests per window
    standardHeaders: true,
    legacyHeaders: false
});
app.use("/api/auth/login", loginLimiter);
// Directories are now handled by config.ensureBootPaths()
const PUBLIC_DIR = config_1.default.paths.publicDir;
const UPLOAD_DIR = config_1.default.paths.uploadDir;
const QRCODE_DIR = config_1.default.paths.qrcodeDir;
const DATA_DIR = config_1.default.paths.dataDir;
// Middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Serve static files
app.use('/uploads', express_1.default.static(UPLOAD_DIR));
app.use('/public', express_1.default.static(PUBLIC_DIR));
app.use(express_1.default.static(PUBLIC_DIR)); // also serve at root
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/inventory', inventory_1.default);
app.use('/api/company', company_1.default);
app.use('/api/storage', storage_1.default);
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
                environment: config_1.default.env.nodeEnv,
            });
        }
        return res.json({
            status: 'OK',
            db: !!row?.ok,
            timestamp: new Date().toISOString(),
            message: 'Inventory Manager API is running',
            environment: config_1.default.env.nodeEnv,
            dataDir: config_1.default.paths.dataDir,
            dbFile: config_1.default.paths.dbFile,
            uploadDir: config_1.default.paths.uploadDir,
            uploadDocsDir: config_1.default.paths.uploadDocsDir,
            qrcodeDir: config_1.default.paths.qrcodeDir,
        });
    });
});
// SPA fallback for non-API routes (supports deep links like /item/:id)
app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(path_1.default.join(PUBLIC_DIR, 'index.html'));
});
// Error handling middleware
app.use((err, req, res, next) => {
    // Map specific errors to clean HTTP status codes
    if (err && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "FILE_TOO_LARGE" });
    }
    if (err && /Unsupported file/.test(err.message)) {
        return res.status(415).json({ error: "UNSUPPORTED_MEDIA_TYPE" });
    }
    console.error('Error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
});
// 404 handler
app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// For Vercel serverless deployment, export the app
exports.default = app;
// Only start the server if this file is run directly (development)
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Inventory Manager API running on port ${PORT} (env=${config_1.default.env.nodeEnv})`);
        console.log(`📁 Public dir: ${PUBLIC_DIR}`);
        console.log(`📁 Upload dir: ${UPLOAD_DIR}`);
        console.log(`📁 Upload docs dir: ${config_1.default.paths.uploadDocsDir}`);
        console.log(`📁 Data dir: ${DATA_DIR}`);
        console.log(`🗄️ DB file:   ${config_1.default.paths.dbFile}`);
    });
}
