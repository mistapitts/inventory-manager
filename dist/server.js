"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./models/database");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const company_1 = __importDefault(require("./routes/company"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Serve static files
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Ensure upload directories exist (only in development)
if (process.env.NODE_ENV !== 'production') {
    const uploadBase = path_1.default.join(__dirname, '../uploads');
    const docsDir = path_1.default.join(uploadBase, 'docs');
    const qrDir = path_1.default.join(uploadBase, 'qr-codes');
    const imagesDir = path_1.default.join(uploadBase, 'images');
    [uploadBase, docsDir, qrDir, imagesDir].forEach((dir) => {
        try {
            if (!require('fs').existsSync(dir)) {
                require('fs').mkdirSync(dir, { recursive: true });
            }
        }
        catch (e) {
            console.error('Failed creating upload dir', dir, e);
        }
    });
}
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/inventory', inventory_1.default);
app.use('/api/company', company_1.default);
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
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// For Vercel serverless deployment, export the app
exports.default = app;
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
        database_1.database.close();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down server...');
        database_1.database.close();
        process.exit(0);
    });
}
//# sourceMappingURL=server.js.map