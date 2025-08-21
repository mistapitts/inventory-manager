"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../models/database");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// Create a simple company for demo purposes
router.post('/setup-demo', auth_1.authenticateToken, async (req, res) => {
    try {
        // Check if demo company already exists
        const existingCompany = await database_1.database.get('SELECT id FROM companies WHERE name = ?', ['Randy\'s Company']);
        if (existingCompany) {
            return res.status(400).json({ error: 'Demo company already exists' });
        }
        // Create demo company
        const companyId = generateId();
        await database_1.database.run(`
            INSERT INTO companies (
                id, name, isActive, createdAt, updatedAt
            ) VALUES (?, ?, 1, datetime('now'), datetime('now'))
        `, [companyId, 'Randy\'s Company']);
        // Create demo location
        const locationId = generateId();
        await database_1.database.run(`
            INSERT INTO locations (
                id, companyId, name, level, isActive, createdAt, updatedAt
            ) VALUES (?, ?, 'Main Lab', 'lab', 1, datetime('now'), datetime('now'))
        `, [locationId, companyId]);
        // Update current user to be associated with this company
        await database_1.database.run(`
            UPDATE users 
            SET companyId = ?, role = ?
            WHERE id = ?
        `, [companyId, types_1.UserRole.COMPANY_OWNER, req.user.id]);
        res.json({
            message: 'Demo company setup successfully',
            companyId,
            locationId
        });
    }
    catch (error) {
        console.error('Error setting up demo company:', error);
        res.status(500).json({ error: 'Failed to setup demo company' });
    }
});
// Get company info for current user
router.get('/info', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await database_1.database.get(`
            SELECT u.*, c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.companyId = c.id
            WHERE u.id = ?
        `, [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.companyId) {
            return res.json({ user, company: null });
        }
        // Get company locations
        const locations = await database_1.database.all(`
            SELECT * FROM locations WHERE companyId = ? ORDER BY level, name
        `, [user.companyId]);
        res.json({
            user,
            company: {
                id: user.companyId,
                name: user.company_name
            },
            locations
        });
    }
    catch (error) {
        console.error('Error fetching company info:', error);
        res.status(500).json({ error: 'Failed to fetch company info' });
    }
});
// Helper function to generate unique IDs
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
exports.default = router;
