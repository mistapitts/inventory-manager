"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.requireLocationAccess = exports.requireCompanyAccess = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../models/database");
const types_1 = require("../types");
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined;
    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }
    try {
        const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // Debug: successful decode
        // console.log('Auth OK for userId:', decoded?.userId);
        // Get user from database to ensure they still exist and are active
        const user = await database_1.database.get('SELECT id, email, role, companyId, regionId FROM users WHERE id = ? AND isActive = 1', [decoded.userId]);
        if (!user) {
            res.status(401).json({ error: 'User not found or inactive' });
            return;
        }
        req.user = {
            id: user.id,
            role: user.role
        };
        next();
    }
    catch (error) {
        console.error('JWT verification failed:', {
            message: error?.message,
            name: error?.name,
            stack: error?.stack?.split('\n')[0]
        });
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!req.user.role || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
const requireCompanyAccess = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    if (req.user.role === types_1.UserRole.ADMIN) {
        next();
        return;
    }
    // For now, allow access - company access logic can be implemented later
    next();
};
exports.requireCompanyAccess = requireCompanyAccess;
const requireLocationAccess = (locationId) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!req.user.role) {
            res.status(401).json({ error: 'User role not found' });
            return;
        }
        if (req.user.role === types_1.UserRole.ADMIN) {
            next();
            return;
        }
        // For now, allow access - location access logic can be implemented later
        next();
    };
};
exports.requireLocationAccess = requireLocationAccess;
const generateToken = (userId) => {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    return jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: '7d' });
};
exports.generateToken = generateToken;
