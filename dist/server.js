"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const config_1 = __importDefault(require("./config"));
const database_1 = require("./models/database");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const company_1 = __importDefault(require("./routes/company"));
const inventory_1 = __importDefault(require("./routes/inventory"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT ?? config_1.default.port);
/** Behind Render's proxy, trust X-Forwarded-* so req.protocol is correct */
app.set('trust proxy', true);
// CORS: permissive for now (can be restricted later with ALLOWED_ORIGINS)
app.use((0, cors_1.default)());
// Ensure required directories exist
const PUBLIC_DIR = path_1.default.join(process.cwd(), config_1.default.paths.publicDir);
const UPLOAD_DIR = path_1.default.join(process.cwd(), config_1.default.paths.uploadDir);
const QRCODE_DIR = path_1.default.join(process.cwd(), config_1.default.paths.qrcodeDir);
const DATA_DIR = path_1.default.join(process.cwd(), config_1.default.paths.dataDir);
for (const dir of [UPLOAD_DIR, QRCODE_DIR, DATA_DIR]) {
    fs_1.default.mkdirSync(dir, { recursive: true });
}
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
                environment: config_1.default.nodeEnv,
            });
        }
        return res.json({
            status: 'OK',
            db: !!row?.ok,
            timestamp: new Date().toISOString(),
            message: 'Inventory Manager API is running',
            environment: config_1.default.nodeEnv,
        });
    });
});
// SPA fallback for non-API routes (supports deep links like /item/:id)
app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(path_1.default.join(PUBLIC_DIR, 'index.html'));
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
        console.log(`🚀 Inventory Manager API running on port ${PORT} (env=${config_1.default.nodeEnv})`);
        console.log(`📁 Public dir: ${PUBLIC_DIR}`);
        console.log(`📁 Upload dir: ${UPLOAD_DIR}`);
        console.log(`📁 Data dir: ${DATA_DIR}`);
    });
}
