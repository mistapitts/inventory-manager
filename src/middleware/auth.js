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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.requireLocationAccess = exports.requireCompanyAccess = exports.requireRole = exports.authenticateToken = void 0;
const jwt = __importStar(require("jsonwebtoken"));
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
        const decoded = jwt.verify(token, secret);
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
            companyId: user.companyId,
            role: user.role,
        };
        next();
    }
    catch (error) {
        console.error('JWT verification failed:', {
            message: error?.message,
            name: error?.name,
            stack: error?.stack?.split('\n')[0],
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
    return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};
exports.generateToken = generateToken;
