"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const database_1 = require("../models/database");
const email_1 = require("../services/email");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// Create a simple company for demo purposes
router.post('/setup-demo', auth_1.authenticateToken, async (req, res) => {
    try {
        // Check if demo company already exists
        const existingCompany = await database_1.database.get('SELECT id FROM companies WHERE name = ?', [
            "Randy's Company",
        ]);
        if (existingCompany) {
            return res.status(400).json({ error: 'Demo company already exists' });
        }
        // Create demo company
        const companyId = generateId();
        await database_1.database.run(`
            INSERT INTO companies (
                id, name, isActive, createdAt, updatedAt
            ) VALUES (?, ?, 1, datetime('now'), datetime('now'))
        `, [companyId, "Randy's Company"]);
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
            locationId,
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
        const user = await database_1.database.get(`SELECT u.*, c.* FROM users u LEFT JOIN companies c ON u.companyId = c.id WHERE u.id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.companyId) {
            return res.json({ user, company: null, users: [] });
        }
        // Get company info
        const company = await database_1.database.get(`SELECT * FROM companies WHERE id = ?`, [user.companyId]);
        // Get company users with location assignments (for user management)
        const users = await database_1.database.all(`SELECT id, email, firstName, lastName, role, employeeId, isActive, createdAt FROM users WHERE companyId = ? ORDER BY role, firstName`, [user.companyId]);
        // Get location assignments for each user
        for (const userItem of users) {
            const locations = await database_1.database.all(`SELECT ul.locationId, ul.listPermissions, l.name, l.address
         FROM user_locations ul
         JOIN locations l ON ul.locationId = l.id
         WHERE ul.userId = ?`, [userItem.id]);
            userItem.locations = locations.map(loc => ({
                id: loc.locationId,
                name: loc.name,
                address: loc.address,
                listPermissions: loc.listPermissions ? JSON.parse(loc.listPermissions) : []
            }));
        }
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                companyId: user.companyId,
            },
            company,
            users,
        });
    }
    catch (error) {
        console.error('Error fetching company info:', error);
        res.status(500).json({ error: 'Failed to fetch company info' });
    }
});
// Update company information
router.patch('/update', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, phone, email, website, address, city, state, zipCode, country, description } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Company name is required' });
        }
        // Get user's company
        const user = await database_1.database.get('SELECT companyId, role FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Check permissions (only company_owner and admin can update)
        if (user.role !== 'company_owner' && user.role !== 'admin') {
            return res
                .status(403)
                .json({ error: 'Insufficient permissions to update company information' });
        }
        // Update company
        await database_1.database.run(`UPDATE companies SET 
         name = ?, phone = ?, email = ?, website = ?, address = ?, 
         city = ?, state = ?, zipCode = ?, country = ?, description = ?,
         updatedAt = datetime('now')
       WHERE id = ?`, [
            name.trim(),
            phone || null,
            email || null,
            website || null,
            address || null,
            city || null,
            state || null,
            zipCode || null,
            country || 'United States',
            description || null,
            user.companyId,
        ]);
        res.json({ message: 'Company information updated successfully' });
    }
    catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({ error: 'Failed to update company information' });
    }
});
// Invite user to company
router.post('/invite-user', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { email, firstName, lastName, employeeId, role } = req.body;
        if (!email || !firstName || !lastName || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        // Validate role
        const validRoles = ['company_owner', 'company_admin', 'manager', 'user', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }
        // Get user's company and inviter info
        const user = await database_1.database.get('SELECT u.companyId, u.role, u.firstName, u.lastName, c.name as companyName FROM users u LEFT JOIN companies c ON u.companyId = c.id WHERE u.id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Check permissions (only company_owner and admin can invite)
        if (user.role !== 'company_owner' && user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions to invite users' });
        }
        // Check if user already exists
        const existingUser = await database_1.database.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        // Generate invite code
        const inviteCode = generateId().substring(0, 8).toUpperCase();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
        // Create invite code record
        await database_1.database.run(`INSERT INTO invite_codes (id, companyId, code, role, email, firstName, lastName, employeeId, expiresAt, isUsed, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`, [
            generateId(),
            user.companyId,
            inviteCode,
            role,
            email,
            firstName,
            lastName,
            employeeId || null,
            expiresAt.toISOString(),
        ]);
        // Send invitation email
        const inviteLink = `${req.protocol}://${req.get('host')}/signup/${inviteCode}`;
        const inviterName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'Your administrator';
        const emailSent = await email_1.emailService.sendUserInvitation({
            to: email,
            firstName,
            lastName,
            companyName: user.companyName || 'Your Company',
            inviteCode,
            inviteLink,
            inviterName,
        });
        // Log invitation details for development
        console.log(`📧 Invitation created for ${email}: ${inviteLink}`);
        res.json({
            message: emailSent
                ? 'Invitation sent successfully'
                : 'Invitation created successfully (check server logs for email content in development mode)',
            inviteCode: emailSent ? undefined : inviteCode, // Only return code if email failed
            expiresAt: expiresAt.toISOString(),
            emailSent,
            inviteLink: emailSent ? undefined : inviteLink, // Only return link if email failed
        });
    }
    catch (error) {
        console.error('Error creating user invitation:', error);
        res.status(500).json({ error: 'Failed to create user invitation' });
    }
});
// Configure multer for logo uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const logoDir = path_1.default.join(config_1.config.paths.uploadDir, 'logos');
        cb(null, logoDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'logo-' + uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept common image formats
        const allowedMimes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Please use JPG, PNG, GIF, WEBP, or SVG.`));
        }
    },
});
// Upload company logo
router.post('/upload-logo', auth_1.authenticateToken, upload.single('logo'), async (req, res) => {
    try {
        const userId = req.user.id;
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Get user's company
        const user = await database_1.database.get('SELECT companyId, role FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Check permissions (only company_owner and admin can upload logo)
        if (user.role !== 'company_owner' && user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions to upload company logo' });
        }
        // Update company logo path
        const logoPath = `/uploads/logos/${req.file.filename}`;
        await database_1.database.run(`UPDATE companies SET logo = ?, updatedAt = datetime('now') WHERE id = ?`, [logoPath, user.companyId]);
        res.json({
            message: 'Logo uploaded successfully',
            logoPath,
        });
    }
    catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({ error: 'Failed to upload logo' });
    }
});
// Remove company logo
router.delete('/remove-logo', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        // Get user's company
        const user = await database_1.database.get('SELECT companyId, role FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Check permissions (only company_owner and admin can remove logo)
        if (user.role !== 'company_owner' && user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions to remove company logo' });
        }
        // Remove logo from company
        await database_1.database.run(`UPDATE companies SET logo = NULL, updatedAt = datetime('now') WHERE id = ?`, [user.companyId]);
        res.json({ message: 'Logo removed successfully' });
    }
    catch (error) {
        console.error('Error removing logo:', error);
        res.status(500).json({ error: 'Failed to remove logo' });
    }
});
// Get user details with location assignments
router.get('/users/:userId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = req.user;
        // Only company admins and owners can view user details
        if (!user.role || !['company_owner', 'company_admin'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to view user details' });
        }
        // Get user basic info
        const userDetails = await database_1.database.get(`SELECT id, email, firstName, lastName, role, employeeId, companyId, createdAt 
       FROM users WHERE id = ? AND companyId = ?`, [userId, user.companyId]);
        if (!userDetails) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Get user's location assignments
        const locationAssignments = await database_1.database.all(`SELECT ul.locationId, ul.listPermissions, l.name, l.address
       FROM user_locations ul
       JOIN locations l ON ul.locationId = l.id
       WHERE ul.userId = ?`, [userId]);
        // Parse list permissions
        const locations = locationAssignments.map(loc => ({
            id: loc.locationId,
            name: loc.name,
            address: loc.address,
            listPermissions: loc.listPermissions ? JSON.parse(loc.listPermissions) : []
        }));
        res.json({
            user: {
                ...userDetails,
                locations
            }
        });
    }
    catch (error) {
        console.error('Error getting user details:', error);
        res.status(500).json({ error: 'Failed to get user details' });
    }
});
// Update user details and location assignments
router.put('/users/:userId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { firstName, lastName, employeeId, role, locationAssignments } = req.body;
        const user = req.user;
        // Only company admins and owners can edit users
        if (!user.role || !['company_owner', 'company_admin'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to edit users' });
        }
        // Validate required fields
        if (!firstName || !lastName || !role) {
            return res.status(400).json({ error: 'First name, last name, and role are required' });
        }
        // Validate role
        const validRoles = ['company_owner', 'company_admin', 'manager', 'user', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        // Check if user exists and belongs to the same company
        const targetUser = await database_1.database.get(`SELECT id, role FROM users WHERE id = ? AND companyId = ?`, [userId, user.companyId]);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Prevent non-owners from editing owners
        if (targetUser.role === 'company_owner' && user.role !== 'company_owner') {
            return res.status(403).json({ error: 'Only company owners can edit other owners' });
        }
        // Update user basic info
        await database_1.database.run(`UPDATE users SET 
        firstName = ?, lastName = ?, employeeId = ?, role = ?, updatedAt = datetime('now')
       WHERE id = ?`, [firstName, lastName, employeeId || null, role, userId]);
        // Update location assignments
        if (locationAssignments && Array.isArray(locationAssignments)) {
            // Remove existing location assignments
            await database_1.database.run('DELETE FROM user_locations WHERE userId = ?', [userId]);
            // Add new location assignments
            for (const assignment of locationAssignments) {
                const { locationId, listPermissions } = assignment;
                // Verify location belongs to the company
                const location = await database_1.database.get('SELECT id FROM locations WHERE id = ? AND companyId = ?', [locationId, user.companyId]);
                if (location) {
                    await database_1.database.run(`INSERT INTO user_locations (id, userId, locationId, listPermissions, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`, [
                        generateId(),
                        userId,
                        locationId,
                        JSON.stringify(listPermissions || [])
                    ]);
                }
            }
        }
        res.json({ message: 'User updated successfully' });
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});
// Reset user password
router.post('/users/:userId/reset-password', auth_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = req.user;
        // Only company admins and owners can reset passwords
        if (!user.role || !['company_owner', 'company_admin'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to reset passwords' });
        }
        // Check if user exists and belongs to the same company
        const targetUser = await database_1.database.get(`SELECT id, email, firstName, lastName FROM users WHERE id = ? AND companyId = ?`, [userId, user.companyId]);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Generate password reset code
        const resetCode = generateId();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        // Store reset code (reusing invite_codes table structure)
        await database_1.database.run(`INSERT INTO invite_codes (id, companyId, code, role, email, firstName, lastName, expiresAt, isUsed, createdAt)
       VALUES (?, ?, ?, 'password_reset', ?, ?, ?, ?, 0, datetime('now'))`, [
            generateId(),
            user.companyId,
            resetCode,
            targetUser.email,
            targetUser.firstName,
            targetUser.lastName,
            expiresAt.toISOString()
        ]);
        // Send password reset email
        const resetLink = `${config_1.config.env.baseUrl}/signup/${resetCode}`;
        await email_1.emailService.sendPasswordResetEmail({
            to: targetUser.email,
            firstName: targetUser.firstName,
            resetLink
        });
        res.json({ message: 'Password reset email sent successfully' });
    }
    catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});
// Delete user completely (secure deletion)
router.delete('/users/:userId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = req.user;
        // Only company admins and owners can delete users
        if (!user.role || !['company_owner', 'company_admin'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to delete users' });
        }
        // Check if user exists and belongs to the same company
        const targetUser = await database_1.database.get(`SELECT id, email, role FROM users WHERE id = ? AND companyId = ?`, [userId, user.companyId]);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Prevent deletion of company owners by non-owners
        if (targetUser.role === 'company_owner' && user.role !== 'company_owner') {
            return res.status(403).json({ error: 'Only company owners can delete other owners' });
        }
        // Prevent self-deletion
        if (userId === user.id) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }
        console.log(`🗑️ Starting secure deletion of user ${targetUser.email} (${userId})`);
        // Delete user data in the correct order (foreign key constraints)
        // 1. Delete user-specific records
        await database_1.database.run('DELETE FROM notifications WHERE userId = ?', [userId]);
        console.log('✅ Deleted notifications');
        await database_1.database.run('DELETE FROM user_locations WHERE userId = ?', [userId]);
        console.log('✅ Deleted location assignments');
        // 2. Delete records created by the user (these contain historical data)
        await database_1.database.run('DELETE FROM calibration_records WHERE userId = ?', [userId]);
        console.log('✅ Deleted calibration records');
        await database_1.database.run('DELETE FROM maintenance_records WHERE userId = ?', [userId]);
        console.log('✅ Deleted maintenance records');
        await database_1.database.run('DELETE FROM changelog WHERE userId = ?', [userId]);
        console.log('✅ Deleted changelog entries');
        // 3. Clean up any unused invite codes for this user
        await database_1.database.run('DELETE FROM invite_codes WHERE email = ? AND companyId = ?', [targetUser.email, user.companyId]);
        console.log('✅ Cleaned up invite codes');
        // 4. Finally, delete the user account
        await database_1.database.run('DELETE FROM users WHERE id = ?', [userId]);
        console.log('✅ Deleted user account');
        console.log(`🎯 User ${targetUser.email} completely removed from system`);
        res.json({
            message: 'User and all associated data deleted successfully',
            deletedEmail: targetUser.email
        });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
// Helper function to generate unique IDs
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
exports.default = router;
