"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const qrcode_1 = __importDefault(require("qrcode"));
const config_1 = __importDefault(require("../config"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../models/database");
const router = (0, express_1.Router)();
// Upload directories are now handled by config.ensureBootPaths()
const uploadRoot = config_1.default.paths.uploadDir;
const storage = multer_1.default.diskStorage({
    destination(_req, _file, cb) {
        cb(null, config_1.default.paths.uploadDocsDir);
    },
    filename(_req, file, cb) {
        const safeBase = path_1.default.basename(file.originalname).replace(/[^\w.\-()+ ]/g, "_");
        const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBase}`;
        cb(null, storedName);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: (_req, file, cb) => {
        const ok = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "image/png",
            "image/jpeg"
        ].includes(file.mimetype);
        if (ok) {
            cb(null, true);
        }
        else {
            cb(new Error("Unsupported file type"));
        }
    }
});
// Lists: get all lists for current user's company
router.get('/lists', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId)
            return res.status(400).json({ error: 'User not associated with a company' });
        let lists = await database_1.database.all('SELECT id, name, color, textColor, createdAt, updatedAt FROM lists WHERE companyId = ? ORDER BY name', [user.companyId]);
        res.json({ lists });
    }
    catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ error: 'Failed to fetch lists' });
    }
});
// Lists: create a new list for company
router.post('/lists', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, color, textColor } = req.body;
        if (!name || !name.trim())
            return res.status(400).json({ error: 'List name is required' });
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId)
            return res.status(400).json({ error: 'User not associated with a company' });
        const id = generateId();
        const listColor = color || '#6b7280';
        const listTextColor = textColor || '#ffffff';
        await database_1.database.run("INSERT INTO lists (id, companyId, name, color, textColor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))", [id, user.companyId, name.trim(), listColor, listTextColor]);
        const created = await database_1.database.get('SELECT id, name, color, textColor, createdAt, updatedAt FROM lists WHERE id = ?', [id]);
        res.status(201).json(created);
    }
    catch (error) {
        console.error('Error creating list:', error);
        res.status(500).json({ error: 'Failed to create list' });
    }
});
// Lists: update a list's colors
router.put('/lists/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const listId = req.params.id;
        const { name, color, textColor } = req.body;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId)
            return res.status(400).json({ error: 'User not associated with a company' });
        const list = await database_1.database.get('SELECT id FROM lists WHERE id = ? AND companyId = ?', [
            listId,
            user.companyId,
        ]);
        if (!list)
            return res.status(404).json({ error: 'List not found' });
        const updates = [];
        const params = [];
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name.trim());
        }
        if (color !== undefined) {
            updates.push('color = ?');
            params.push(color);
        }
        if (textColor !== undefined) {
            updates.push('textColor = ?');
            params.push(textColor);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        updates.push("updatedAt = datetime('now')");
        params.push(listId);
        await database_1.database.run(`UPDATE lists SET ${updates.join(', ')} WHERE id = ?`, params);
        const updated = await database_1.database.get('SELECT id, name, color, textColor, createdAt, updatedAt FROM lists WHERE id = ?', [listId]);
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating list:', error);
        res.status(500).json({ error: 'Failed to update list' });
    }
});
// Lists: delete a list (and optionally reassign items to null)
router.delete('/lists/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const listId = req.params.id;
        const { deleteItems } = req.query;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId)
            return res.status(400).json({ error: 'User not associated with a company' });
        const list = await database_1.database.get('SELECT id FROM lists WHERE id = ? AND companyId = ?', [
            listId,
            user.companyId,
        ]);
        if (!list)
            return res.status(404).json({ error: 'List not found' });
        // Optionally delete all items in the list (with their records/files)
        if (deleteItems === 'true') {
            try {
                const items = await database_1.database.all('SELECT id FROM inventory_items WHERE companyId = ? AND listId = ?', [user.companyId, listId]);
                console.log(`Deleting ${items.length} items from list ${listId}`);
                for (const it of items) {
                    try {
                        // Delete related records using the column that actually exists in each table
                        const tablesToClean = ['calibration_records', 'maintenance_records', 'changelog'];
                        for (const table of tablesToClean) {
                            try {
                                const col = await resolveItemIdColumn(table);
                                if (col) {
                                    await database_1.database.run(`DELETE FROM ${table} WHERE ${col} = ?`, [it.id]);
                                }
                            }
                            catch (tableError) {
                                console.warn(`Failed to clean table ${table} for item ${it.id}:`, tableError);
                            }
                        }
                        // Delete QR code file if exists
                        try {
                            const qrPath = path_1.default.join(uploadRoot, 'qr-codes', `${it.id}.png`);
                            if (fs_1.default.existsSync(qrPath)) {
                                fs_1.default.unlinkSync(qrPath);
                            }
                        }
                        catch (fileError) {
                            console.warn(`Failed to remove QR code file for item ${it.id}:`, fileError);
                        }
                        // Delete the item itself
                        await database_1.database.run('DELETE FROM inventory_items WHERE id = ?', [it.id]);
                    }
                    catch (itemError) {
                        console.error(`Failed to delete item ${it.id}:`, itemError);
                        // Continue with other items even if one fails
                    }
                }
            }
            catch (itemsError) {
                console.error('Error fetching items for deletion:', itemsError);
                // Continue to delete the list even if item deletion fails
            }
        }
        else {
            // Unassign items from this list
            try {
                await database_1.database.run("UPDATE inventory_items SET listId = NULL, updatedAt = datetime('now') WHERE companyId = ? AND listId = ?", [user.companyId, listId]);
            }
            catch (updateError) {
                console.warn('Failed to unassign items from list:', updateError);
                // Continue to delete the list even if unassignment fails
            }
        }
        // Delete the list itself
        await database_1.database.run('DELETE FROM lists WHERE id = ? AND companyId = ?', [
            listId,
            user.companyId,
        ]);
        res.json({
            message: 'List deleted successfully',
            deletedItems: deleteItems === 'true',
            listId: listId,
        });
    }
    catch (error) {
        console.error('Error deleting list:', error);
        res.status(500).json({ error: 'Failed to delete list' });
    }
});
// Lists: migrate items to field list (for removing default list)
router.post('/lists/migrate-to-field', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId)
            return res.status(400).json({ error: 'User not associated with a company' });
        // Check if field list exists, create if not
        let fieldList = await database_1.database.get('SELECT id FROM lists WHERE companyId = ? AND name = ?', [
            user.companyId,
            'Field',
        ]);
        if (!fieldList) {
            const fieldId = generateId();
            await database_1.database.run("INSERT INTO lists (id, companyId, name, color, textColor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))", [fieldId, user.companyId, 'Field', '#10b981', '#ffffff']);
            fieldList = { id: fieldId };
        }
        // Move all items without a list to the field list
        await database_1.database.run('UPDATE inventory_items SET listId = ?, updatedAt = datetime(\'now\') WHERE companyId = ? AND (listId IS NULL OR listId = "")', [fieldList.id, user.companyId]);
        res.json({
            message: 'Items migrated to Field list successfully',
            fieldListId: fieldList.id,
        });
    }
    catch (error) {
        console.error('Error migrating items to field list:', error);
        res.status(500).json({ error: 'Failed to migrate items' });
    }
});
// Get all inventory items for the user's company
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { listId, includeOOS } = req.query;
        // Get user's company info
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Build WHERE clause based on parameters
        const params = [user.companyId];
        let where = 'companyId = ?';
        // Handle includeOOS parameter
        if (includeOOS === 'false') {
            where += ' AND isOutOfService = 0';
        }
        // If includeOOS is omitted or 'true', return all items (including OOS)
        // Handle listId filter
        if (listId && listId !== 'all') {
            where += ' AND listId = ?';
            params.push(listId);
        }
        const items = await database_1.database.all(`
            SELECT *
            FROM inventory_items
            WHERE ${where}
            ORDER BY itemType, nickname, labId
        `, params);
        res.json({ items });
    }
    catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});
// Get out-of-service items
router.get('/out-of-service', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        const items = await database_1.database.all(`
            SELECT *
            FROM inventory_items
            WHERE companyId = ? AND isOutOfService = 1
            ORDER BY outOfServiceDate DESC
        `, [user.companyId]);
        res.json({ items });
    }
    catch (error) {
        console.error('Error fetching out-of-service items:', error);
        res.status(500).json({ error: 'Failed to fetch out-of-service items' });
    }
});
// Get single inventory item
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        const item = await database_1.database.get(`
            SELECT *
            FROM inventory_items
            WHERE id = ? AND companyId = ?
        `, [itemId, user.companyId]);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // Get calibration records
        const calibrationRecords = await database_1.database.all(`
            SELECT * FROM calibration_records 
            WHERE itemId = ? 
            ORDER BY calibrationDate DESC
        `, [itemId]);
        console.log('📊 Retrieved calibration records:', calibrationRecords.map((r) => ({
            id: r.id,
            calibrationDate: r.calibrationDate,
            method: r.method,
            createdAt: r.createdAt,
        })));
        // Get maintenance records
        const maintenanceRecords = await database_1.database.all(`
            SELECT * FROM maintenance_records 
            WHERE itemId = ? 
            ORDER BY maintenanceDate DESC
        `, [itemId]);
        // Get changelog
        const changelog = await database_1.database.all(`
            SELECT 
                c.*,
                u.firstName as first_name,
                u.lastName as last_name
            FROM changelog c
            LEFT JOIN users u ON c.userId = u.id
            WHERE c.itemId = ?
            ORDER BY c.timestamp DESC
        `, [itemId]);
        res.json({
            item,
            calibrationRecords,
            maintenanceRecords,
            changelog,
        });
    }
    catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({ error: 'Failed to fetch item' });
    }
});
// Create new inventory item
router.post('/', upload.fields([
    { name: 'calibrationTemplate', maxCount: 1 },
    { name: 'calibrationInstructions', maxCount: 1 },
    { name: 'maintenanceTemplate', maxCount: 1 },
    { name: 'maintenanceInstructions', maxCount: 1 },
]), auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🔍 Creating item for user:', userId);
        const { itemType, nickname, labId, make, model, serialNumber, condition, dateReceived, datePlacedInService, location, calibrationDate, nextCalibrationDue, calibrationInterval, calibrationIntervalType, calibrationMethod, maintenanceDate, maintenanceDue, maintenanceInterval, maintenanceIntervalType, notes, calibrationType, // 'in_house' or 'outsourced'
        listId, } = req.body;
        if (!itemType) {
            console.error('❌ Missing itemType in request body');
        }
        // Coerce numbers and defaults from multipart/form-data
        const normalized = {
            itemType: itemType || '',
            nickname: nickname || null,
            labId: labId || null,
            make: make || '',
            model: model || '',
            serialNumber: serialNumber || '',
            condition: condition || 'new',
            dateReceived: dateReceived || null,
            datePlacedInService: datePlacedInService || null,
            location: location || '',
            calibrationDate: calibrationDate || null,
            nextCalibrationDue: nextCalibrationDue || null,
            calibrationInterval: calibrationInterval ? Number(calibrationInterval) : null,
            calibrationIntervalType: calibrationIntervalType || null,
            calibrationMethod: calibrationMethod || null,
            maintenanceDate: maintenanceDate || null,
            maintenanceDue: maintenanceDue || null,
            maintenanceInterval: maintenanceInterval ? Number(maintenanceInterval) : null,
            maintenanceIntervalType: maintenanceIntervalType || null,
            notes: notes || null,
            isOutsourced: calibrationType === 'outsourced' ? 1 : 0,
            listId: listId || null,
        };
        console.log('📝 Item data received:', {
            itemType,
            nickname,
            labId,
            make,
            model,
            serialNumber,
            condition,
            location,
            calibrationDate,
            nextCalibrationDue,
            calibrationInterval,
            calibrationIntervalType,
            calibrationMethod,
            maintenanceDate,
            maintenanceDue,
            maintenanceInterval,
            maintenanceIntervalType,
            notes,
            calibrationType,
        });
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            console.log('❌ User not associated with company:', userId);
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        console.log('🏢 User company ID:', user.companyId);
        // Generate unique ID
        const itemId = generateId();
        console.log('🆔 Generated item ID:', itemId);
        // Handle file uploads
        const files = req.files;
        let calibrationTemplate = null;
        let calibrationInstructions = null;
        let maintenanceTemplate = null;
        let maintenanceInstructions = null;
        if (files.calibrationTemplate && files.calibrationTemplate[0]) {
            calibrationTemplate = files.calibrationTemplate[0].filename;
        }
        if (files.calibrationInstructions && files.calibrationInstructions[0]) {
            calibrationInstructions = files.calibrationInstructions[0].filename;
        }
        if (files.maintenanceTemplate && files.maintenanceTemplate[0]) {
            maintenanceTemplate = files.maintenanceTemplate[0].filename;
        }
        if (files.maintenanceInstructions && files.maintenanceInstructions[0]) {
            maintenanceInstructions = files.maintenanceInstructions[0].filename;
        }
        // Build the INSERT query dynamically to handle missing columns
        const columns = [
            'id',
            'companyId',
            'itemType',
            'nickname',
            'labId',
            'make',
            'model',
            'serialNumber',
            'condition',
            'dateReceived',
            'datePlacedInService',
            'location',
            'calibrationDate',
            'nextCalibrationDue',
            'calibrationInterval',
            'calibrationIntervalType',
            'calibrationMethod',
            'maintenanceDate',
            'maintenanceDue',
            'maintenanceInterval',
            'maintenanceIntervalType',
            'notes',
            'calibrationTemplate',
            'calibrationInstructions',
            'maintenanceTemplate',
            'maintenanceInstructions',
            'isOutsourced',
            'listId',
            'createdAt',
            'updatedAt',
        ];
        const placeholders = columns.map(() => '?').join(', ');
        const query = `INSERT INTO inventory_items (${columns.join(', ')}) VALUES (${placeholders})`;
        console.log('🔧 SQL Query:', query);
        const values = [
            itemId,
            user.companyId,
            normalized.itemType,
            normalized.nickname,
            normalized.labId,
            make,
            model,
            serialNumber,
            normalized.condition,
            dateReceived,
            datePlacedInService,
            normalized.location,
            calibrationDate,
            nextCalibrationDue,
            normalized.calibrationInterval,
            normalized.calibrationIntervalType,
            calibrationMethod,
            maintenanceDate,
            maintenanceDue,
            normalized.maintenanceInterval,
            normalized.maintenanceIntervalType,
            normalized.notes,
            calibrationTemplate,
            calibrationInstructions,
            maintenanceTemplate,
            maintenanceInstructions,
            normalized.isOutsourced,
            normalized.listId,
            new Date().toISOString(),
            new Date().toISOString(),
        ];
        console.log('📊 Values to insert:', values);
        // Insert item
        await database_1.database.run(query, values);
        console.log('✅ Item inserted successfully');
        // Create changelog entry
        await database_1.database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'created', 'details', NULL, 'Item created', datetime('now'))
        `, [generateId(), itemId, userId]);
        console.log('📝 Changelog entry created');
        // Generate QR code
        const qrCodeData = `${req.protocol}://${req.get('host')}/item/${itemId}`;
        const qrCodePath = path_1.default.join(uploadRoot, 'qr-codes', `${itemId}.png`);
        // Ensure directory exists
        const qrDir = path_1.default.dirname(qrCodePath);
        if (!fs_1.default.existsSync(qrDir)) {
            fs_1.default.mkdirSync(qrDir, { recursive: true });
        }
        await qrcode_1.default.toFile(qrCodePath, qrCodeData, {
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
            width: 300,
        });
        console.log('📱 QR code generated:', qrCodePath);
        res.status(201).json({
            message: 'Item created successfully',
            itemId,
            qrCodePath: `/uploads/qr-codes/${itemId}.png`,
        });
        console.log('🎉 Item creation completed successfully!');
    }
    catch (error) {
        console.error('❌ Error creating item:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            errno: error.errno,
        });
        res.status(500).json({
            error: 'Failed to create item',
            details: error.message,
            code: error.code,
        });
    }
});
// Upload calibration or maintenance record
router.post('/upload-record', auth_1.authenticateToken, upload.single('recordFile'), async (req, res) => {
    console.log('🚀 POST /upload-record endpoint called');
    console.log('📝 Request body:', req.body);
    console.log('📁 File:', req.file);
    console.log('🔍 File field name should be "recordFile"');
    try {
        const userId = req.user.id;
        const { type, itemId, recordType } = req.body; // 'calibration' or 'maintenance'
        const { recordDate, nextDue, method, notes, existingRecordDate } = req.body;
        const file = req.file;
        console.log('📝 Upload record request received:', {
            type,
            itemId,
            recordType,
            recordDate,
            nextDue,
            method,
            notes,
            hasFile: !!file,
        });
        if (!type || !itemId || !recordType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Verify user owns the item
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        const item = await database_1.database.get('SELECT id FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (recordType === 'existing') {
            console.log('📄 Processing existing document upload');
            console.log('📅 Existing document date values:', {
                existingRecordDate,
                recordDate: existingRecordDate && existingRecordDate.trim() !== '' ? existingRecordDate : null,
                fallbackDate: new Date().toISOString().split('T')[0],
            });
            // For existing documents, store the file and create a record entry
            // but don't update item dates since this is an existing record
            if (!req.file) {
                return res.status(400).json({ error: 'File is required for existing document upload' });
            }
            // Generate record ID for the existing document
            const recordId = generateId();
            // Use the optional existingRecordDate if provided, otherwise leave blank
            // Handle empty string case - convert to null
            const recordDate = existingRecordDate && existingRecordDate.trim() !== '' ? existingRecordDate : null;
            const formattedRecordDate = recordDate ? recordDate + ' 00:00:00' : null;
            if (type === 'calibration') {
                // Insert calibration record for existing document
                await database_1.database.run(`
                    INSERT INTO calibration_records (
                        id, itemId, userId, calibrationDate, nextCalibrationDue, method, notes, filePath, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                    recordId,
                    itemId,
                    userId,
                    formattedRecordDate,
                    null,
                    'Existing Document Upload',
                    notes || null,
                    req.file.filename,
                ]);
                console.log('✅ Existing calibration document uploaded and record created');
                console.log('📊 Calibration record details:', {
                    recordId,
                    calibrationDate: formattedRecordDate,
                    method: 'Existing Document Upload',
                    notes: notes || null,
                    filePath: req.file.filename,
                });
            }
            else if (type === 'maintenance') {
                // Insert maintenance record for existing document
                await database_1.database.run(`
                    INSERT INTO maintenance_records (
                        id, itemId, userId, maintenanceDate, nextMaintenanceDue, type, notes, filePath, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                    recordId,
                    itemId,
                    userId,
                    formattedRecordDate,
                    null,
                    'Existing Document Upload',
                    notes || null,
                    req.file.filename,
                ]);
                console.log('✅ Existing maintenance document uploaded and record created');
            }
            // Create changelog entry for document upload
            await database_1.database.run(`
                INSERT INTO changelog (
                    id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
                ) VALUES (?, ?, ?, 'document_uploaded', ?, NULL, ?, datetime('now'))
            `, [generateId(), itemId, userId, `${type}_document`, req.file.filename]);
            res.status(201).json({
                message: `${type} document uploaded successfully`,
                filename: req.file.filename,
                recordId: recordId,
            });
        }
        else if (recordType === 'new') {
            console.log('🆕 Processing new record creation');
            // For new records, require all fields and update item dates
            if (!recordDate || !nextDue || !method) {
                console.log('❌ Missing required fields for new record:', {
                    recordDate,
                    nextDue,
                    method,
                });
                return res.status(400).json({ error: 'Missing required fields for new record' });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'File is required for new record' });
            }
            // Generate record ID
            const recordId = generateId();
            if (type === 'calibration') {
                console.log('🔧 Creating new calibration record and updating item dates');
                console.log('📅 Date values:', {
                    recordDate,
                    nextDue,
                    formattedRecordDate: recordDate + ' 00:00:00',
                    formattedNextDue: nextDue + ' 00:00:00',
                });
                // First, let's check the current state of the inventory item
                const currentItem = await database_1.database.get('SELECT id, calibrationDate, nextCalibrationDue FROM inventory_items WHERE id = ?', [itemId]);
                console.log('🔍 Current inventory item state:', currentItem);
                // Let's also check the table schema to see what constraints exist
                try {
                    const tableInfo = await database_1.database.all('PRAGMA table_info(inventory_items)');
                    console.log('📋 Table schema for inventory_items:', tableInfo);
                }
                catch (schemaError) {
                    console.log('⚠️ Could not get table schema:', schemaError);
                }
                // Insert calibration record
                await database_1.database.run(`
                    INSERT INTO calibration_records (
                        id, itemId, userId, calibrationDate, nextCalibrationDue, method, notes, filePath, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                    recordId,
                    itemId,
                    userId,
                    recordDate + ' 00:00:00',
                    nextDue + ' 00:00:00',
                    method,
                    notes || null,
                    req.file.filename,
                ]);
                console.log('✅ Calibration record inserted successfully');
                // Update item's calibration date and next calibration due date
                console.log('🔧 Updating inventory item dates:', {
                    itemId,
                    calibrationDate: recordDate + ' 00:00:00',
                    nextCalibrationDue: nextDue + ' 00:00:00',
                });
                try {
                    const updateResult = await database_1.database.run(`
                        UPDATE inventory_items 
                        SET calibrationDate = ?, nextCalibrationDue = ?, updatedAt = datetime('now')
                        WHERE id = ?
                    `, [recordDate + ' 00:00:00', nextDue + ' 00:00:00', itemId]);
                    console.log('📊 Update result:', updateResult);
                    // Verify the update worked by checking the item again
                    const updatedItem = await database_1.database.get('SELECT id, calibrationDate, nextCalibrationDue FROM inventory_items WHERE id = ?', [itemId]);
                    console.log('🔍 Updated inventory item state:', updatedItem);
                    console.log('✅ Calibration record created and item dates updated');
                }
                catch (updateError) {
                    console.error('❌ Error updating inventory item:', updateError);
                    throw updateError;
                }
            }
            else if (type === 'maintenance') {
                console.log('🔧 Creating new maintenance record and updating item dates');
                // Insert maintenance record
                await database_1.database.run(`
                    INSERT INTO maintenance_records (
                        id, itemId, userId, maintenanceDate, nextMaintenanceDue, type, notes, filePath, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                    recordId,
                    itemId,
                    userId,
                    recordDate + ' 00:00:00',
                    nextDue + ' 00:00:00',
                    method,
                    notes || null,
                    req.file.filename,
                ]);
                console.log('✅ Maintenance record inserted successfully');
                // Update item's maintenance date and next maintenance due date
                console.log('🔧 Updating inventory item maintenance dates:', {
                    itemId,
                    maintenanceDate: recordDate + ' 00:00:00',
                    nextMaintenanceDue: nextDue + ' 00:00:00',
                });
                try {
                    const updateResult = await database_1.database.run(`
                        UPDATE inventory_items 
                        SET maintenanceDate = ?, maintenanceDue = ?, updatedAt = datetime('now')
                        WHERE id = ?
                    `, [recordDate + ' 00:00:00', nextDue + ' 00:00:00', itemId]);
                    console.log('📊 Maintenance update result:', updateResult);
                    // Verify the update worked by checking the item again
                    const updatedItem = await database_1.database.get('SELECT id, maintenanceDate, maintenanceDue FROM inventory_items WHERE id = ?', [itemId]);
                    console.log('🔍 Updated inventory item maintenance state:', updatedItem);
                    console.log('✅ Maintenance record created and item dates updated');
                }
                catch (updateError) {
                    console.error('❌ Error updating inventory item maintenance dates:', updateError);
                    throw updateError;
                }
            }
            else {
                return res.status(400).json({ error: 'Invalid record type' });
            }
            // Create changelog entry for new record
            await database_1.database.run(`
                INSERT INTO changelog (
                    id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
                ) VALUES (?, ?, ?, 'record_added', ?, NULL, ?, datetime('now'))
            `, [
                generateId(),
                itemId,
                userId,
                `${type}_record`,
                `${type} record added with due date ${nextDue}`,
            ]);
            res.status(201).json({
                message: `${type} record added successfully`,
                recordId,
            });
        }
        else {
            return res.status(400).json({ error: 'Invalid record type' });
        }
    }
    catch (error) {
        console.error('Error uploading record:', error);
        res.status(500).json({ error: 'Failed to upload record' });
    }
});
// Update inventory item
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const updateData = req.body;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Verify item belongs to user's company
        const existingItem = await database_1.database.get('SELECT id FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // Normalize inputs
        if (updateData.calibrationType !== undefined) {
            // Map UI field to schema boolean
            const val = String(updateData.calibrationType).toLowerCase();
            updateData.isOutsourced = val === 'outsourced' || val === 'out';
            delete updateData.calibrationType;
        }
        // Whitelist of updatable columns
        const allowedColumns = new Set([
            'itemType',
            'nickname',
            'labId',
            'make',
            'model',
            'serialNumber',
            'condition',
            'dateReceived',
            'datePlacedInService',
            'location',
            'calibrationDate',
            'nextCalibrationDue',
            'calibrationInterval',
            'calibrationIntervalType',
            'calibrationMethod',
            'maintenanceDate',
            'maintenanceDue',
            'maintenanceInterval',
            'maintenanceIntervalType',
            'notes',
            'isOutsourced',
            'image',
        ]);
        // Coerce numeric fields
        if (updateData.calibrationInterval !== undefined) {
            updateData.calibrationInterval = Number(updateData.calibrationInterval) || 0;
        }
        if (updateData.maintenanceInterval !== undefined) {
            updateData.maintenanceInterval = Number(updateData.maintenanceInterval) || 0;
        }
        // Build update query dynamically from whitelist
        const fields = Object.keys(updateData).filter((key) => allowedColumns.has(key));
        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        const setClause = fields.map((field) => `${field} = ?`).join(', ');
        const values = [...fields.map((field) => updateData[field]), itemId];
        await database_1.database.run(`
            UPDATE inventory_items 
            SET ${setClause}, updatedAt = datetime('now')
            WHERE id = ?
        `, values);
        // Create changelog entry
        const changes = fields.join(', ');
        await database_1.database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'updated', 'details', NULL, 'Updated: ${changes}', datetime('now'))
        `, [generateId(), itemId, userId]);
        res.json({ message: 'Item updated successfully' });
    }
    catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
});
// Mark item as out of service
router.patch('/:id/out-of-service', auth_1.authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const { date, reason, reportedBy, notes } = req.body;
        // Validation: all required fields
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Reason is required' });
        }
        if (!reportedBy || !reportedBy.trim()) {
            return res.status(400).json({ error: 'Reported By is required' });
        }
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Verify item belongs to user's company and check current status
        const existingItem = await database_1.database.get('SELECT id, isOutOfService FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // Check if item is already OOS
        if (existingItem.isOutOfService) {
            return res.status(409).json({ error: 'Item is already out of service' });
        }
        // Update item status only
        await database_1.database.run(`
            UPDATE inventory_items 
            SET isOutOfService = 1, 
                outOfServiceDate = ?, 
                outOfServiceReason = ?,
                returnToServiceVerified = NULL,
                returnToServiceVerifiedAt = NULL,
                returnToServiceVerifiedBy = NULL,
                returnToServiceNotes = NULL,
                updatedAt = datetime('now')
            WHERE id = ?
        `, [date, reason.trim(), itemId]);
        // Store detailed service information in changelog
        const serviceData = {
            date,
            reason: reason.trim(),
            notes: notes || null
        };
        await database_1.database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'service_out', 'service_log', NULL, ?, datetime('now'))
        `, [generateId(), itemId, userId, JSON.stringify(serviceData)]);
        // Get updated item to return
        const updatedItem = await database_1.database.get('SELECT * FROM inventory_items WHERE id = ?', [itemId]);
        // Create changelog entry
        await database_1.database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'status_changed', 'details', NULL, ?, datetime('now'))
        `, [generateId(), itemId, userId, `Marked as out of service: ${reason.trim()}`]);
        res.json(updatedItem);
    }
    catch (error) {
        console.error('Error marking item out of service:', error);
        res.status(500).json({ error: 'Failed to update item status' });
    }
});
// Return item to service
router.patch('/:id/return-to-service', auth_1.authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const { date, resolvedBy, notes } = req.body;
        // Validation: all required fields
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        if (!resolvedBy || !resolvedBy.trim()) {
            return res.status(400).json({ error: 'Issue Resolved By is required' });
        }
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Verify item belongs to user's company and check current status
        const existingItem = await database_1.database.get('SELECT id, isOutOfService FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // Check if item is not OOS
        if (!existingItem.isOutOfService) {
            return res.status(409).json({ error: 'Item is not out of service' });
        }
        // Get user info for verification
        const currentUser = await database_1.database.get('SELECT firstName, lastName FROM users WHERE id = ?', [userId]);
        const verifiedByName = currentUser && currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : 'Unknown User';
        // Update item status only
        await database_1.database.run(`
            UPDATE inventory_items 
            SET isOutOfService = 0,
                returnToServiceVerified = 1,
                returnToServiceVerifiedAt = ?,
                returnToServiceVerifiedBy = ?,
                returnToServiceNotes = ?,
                updatedAt = datetime('now')
            WHERE id = ?
        `, [date, verifiedByName, notes || null, itemId]);
        // Store detailed service information in changelog
        const serviceData = {
            date,
            resolvedBy: resolvedBy.trim(),
            verifiedBy: verifiedByName,
            notes: notes || null
        };
        await database_1.database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'service_return', 'service_log', NULL, ?, datetime('now'))
        `, [generateId(), itemId, userId, JSON.stringify(serviceData)]);
        // Get updated item to return
        const updatedItem = await database_1.database.get('SELECT * FROM inventory_items WHERE id = ?', [itemId]);
        // Create changelog entry
        const logMessage = `Returned to service (resolved by ${resolvedBy.trim()}, verified by ${verifiedByName})`;
        await database_1.database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'status_changed', 'details', NULL, ?, datetime('now'))
        `, [generateId(), itemId, userId, logMessage]);
        res.json(updatedItem);
    }
    catch (error) {
        console.error('Error returning item to service:', error);
        res.status(500).json({ error: 'Failed to update item status' });
    }
});
// Add calibration record
router.post('/:id/calibration', auth_1.authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const { calibrationDate, nextCalibrationDue, method, notes } = req.body;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Verify item belongs to user's company
        const existingItem = await database_1.database.get('SELECT id FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // Insert calibration record
        const recordId = generateId();
        await database_1.database.run(`
            INSERT INTO calibration_records (
                id, itemId, userId, calibrationDate, nextCalibrationDue,
                method, notes, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
            recordId,
            itemId,
            userId,
            calibrationDate + ' 00:00:00',
            nextCalibrationDue + ' 00:00:00',
            method,
            notes,
        ]);
        // Update item's calibration dates
        await database_1.database.run(`
            UPDATE inventory_items 
            SET calibrationDate = ?, 
                nextCalibrationDue = ?,
                updatedAt = datetime('now')
            WHERE id = ?
        `, [calibrationDate + ' 00:00:00', nextCalibrationDue + ' 00:00:00', itemId]);
        // Create changelog entry
        await database_1.database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'calibration_added', 'details', NULL, 'Calibration record added for ${calibrationDate}', datetime('now'))
        `, [generateId(), itemId, userId]);
        res.status(201).json({ message: 'Calibration record added successfully' });
    }
    catch (error) {
        console.error('Error adding calibration record:', error);
        res.status(500).json({ error: 'Failed to add calibration record' });
    }
});
// Upload templates/instructions (single or multiple fields)
router.post('/:id/files', auth_1.authenticateToken, upload.fields([
    { name: 'calibrationTemplate', maxCount: 1 },
    { name: 'calibrationInstructions', maxCount: 1 },
    { name: 'maintenanceTemplate', maxCount: 1 },
    { name: 'maintenanceInstructions', maxCount: 1 },
]), async (req, res) => {
    try {
        const itemId = req.params.id;
        const files = req.files;
        const updates = [];
        const params = [];
        const map = {
            calibrationTemplate: 'calibrationTemplate',
            calibrationInstructions: 'calibrationInstructions',
            maintenanceTemplate: 'maintenanceTemplate',
            maintenanceInstructions: 'maintenanceInstructions',
        };
        Object.keys(map).forEach((key) => {
            if (files && files[key] && files[key][0]) {
                updates.push(`${map[key]} = ?`);
                // Store only filename; public URLs are built in the UI
                params.push(files[key][0].filename);
            }
        });
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        params.push(itemId);
        await database_1.database.run(`UPDATE inventory_items SET ${updates.join(', ')}, updatedAt = datetime('now') WHERE id = ?`, params);
        res.json({ message: 'Files uploaded successfully' });
    }
    catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});
// Add maintenance record
router.post('/:id/maintenance', auth_1.authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const { maintenanceDate, nextMaintenanceDue, type, notes } = req.body;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Verify item belongs to user's company
        const existingItem = await database_1.database.get('SELECT id FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // Insert maintenance record
        const recordId = generateId();
        await database_1.database.run(`
            INSERT INTO maintenance_records (
                id, itemId, userId, maintenanceDate, nextMaintenanceDue,
                type, notes, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
            recordId,
            itemId,
            userId,
            maintenanceDate + ' 00:00:00',
            nextMaintenanceDue + ' 00:00:00',
            type,
            notes,
        ]);
        console.log('✅ Maintenance record inserted successfully');
        // Update item's maintenance dates
        console.log('🔧 Updating inventory item maintenance dates:', {
            itemId,
            maintenanceDate: maintenanceDate + ' 00:00:00',
            nextMaintenanceDue: nextMaintenanceDue + ' 00:00:00',
        });
        try {
            const updateResult = await database_1.database.run(`
                UPDATE inventory_items 
                SET maintenanceDate = ?, 
                    maintenanceDue = ?,
                    updatedAt = datetime('now')
                WHERE id = ?
            `, [maintenanceDate + ' 00:00:00', nextMaintenanceDue + ' 00:00:00', itemId]);
            console.log('📊 Maintenance update result:', updateResult);
            // Verify the update worked by checking the item again
            const updatedItem = await database_1.database.get('SELECT id, maintenanceDate, maintenanceDue FROM inventory_items WHERE id = ?', [itemId]);
            console.log('🔍 Updated inventory item maintenance state:', updatedItem);
            console.log('✅ Maintenance record created and item dates updated');
        }
        catch (updateError) {
            console.error('❌ Error updating inventory item maintenance dates:', updateError);
            throw updateError;
        }
        // Create changelog entry
        await database_1.database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'maintenance_added', 'details', NULL, 'Maintenance record added for ${maintenanceDate}', datetime('now'))
        `, [generateId(), itemId, userId]);
        res.status(201).json({ message: 'Maintenance record added successfully' });
    }
    catch (error) {
        console.error('Error adding maintenance record:', error);
        res.status(500).json({ error: 'Failed to add maintenance record' });
    }
});
// Helper to resolve whether a table uses camelCase or snake_case item id column
async function resolveItemIdColumn(tableName) {
    try {
        const cols = await database_1.database.all(`PRAGMA table_info(${tableName})`);
        if (cols?.some((c) => c.name === 'itemId'))
            return 'itemId';
        if (cols?.some((c) => c.name === 'item_id'))
            return 'item_id';
        return null;
    }
    catch {
        return null;
    }
}
// Delete inventory item (and associated records/files)
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.user.id;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Verify item belongs to user's company
        const existingItem = await database_1.database.get('SELECT id FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // Delete related records using the column that actually exists in each table
        const tablesToClean = ['calibration_records', 'maintenance_records', 'changelog'];
        for (const table of tablesToClean) {
            const col = await resolveItemIdColumn(table);
            if (col) {
                await database_1.database.run(`DELETE FROM ${table} WHERE ${col} = ?`, [itemId]);
            }
        }
        // Delete QR code file if exists
        try {
            const qrPath = path_1.default.join(uploadRoot, 'qr-codes', `${itemId}.png`);
            if (fs_1.default.existsSync(qrPath)) {
                fs_1.default.unlinkSync(qrPath);
            }
        }
        catch (err) {
            console.warn('Failed to remove QR code file for item', itemId, err);
        }
        // Delete the item itself
        await database_1.database.run('DELETE FROM inventory_items WHERE id = ?', [itemId]);
        res.json({ message: 'Item deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});
// Delete a single calibration/maintenance record
router.delete('/:itemId/records/:recordId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { itemId, recordId } = req.params;
        const { type } = req.query; // 'calibration' | 'maintenance'
        const userId = req.user.id;
        if (type !== 'calibration' && type !== 'maintenance') {
            return res.status(400).json({ error: 'Invalid record type' });
        }
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId)
            return res.status(400).json({ error: 'User not associated with a company' });
        const item = await database_1.database.get('SELECT id FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!item)
            return res.status(404).json({ error: 'Item not found' });
        const table = type === 'calibration' ? 'calibration_records' : 'maintenance_records';
        await database_1.database.run(`DELETE FROM ${table} WHERE id = ? AND itemId = ?`, [recordId, itemId]);
        res.json({ message: 'Record deleted' });
    }
    catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({ error: 'Failed to delete record' });
    }
});
// Get inventory statistics
router.get('/stats/overview', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await database_1.database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        // Get total items (all items)
        const totalItems = await database_1.database.get('SELECT COUNT(*) as count FROM inventory_items WHERE companyId = ?', [user.companyId]);
        // Get active items (not out of service)
        const activeItems = await database_1.database.get('SELECT COUNT(*) as count FROM inventory_items WHERE companyId = ? AND isOutOfService = 0', [user.companyId]);
        // Get items due for calibration this month (only active items)
        const dueThisMonth = await database_1.database.get(`
            SELECT COUNT(*) as count FROM inventory_items 
            WHERE companyId = ? AND isOutOfService = 0 
            AND nextCalibrationDue <= date('now', '+1 month')
            AND nextCalibrationDue >= date('now')
        `, [user.companyId]);
        // Get items due for maintenance this month (only active items)
        const maintenanceDue = await database_1.database.get(`
            SELECT COUNT(*) as count FROM inventory_items 
            WHERE companyId = ? AND isOutOfService = 0 
            AND maintenanceDue <= date('now', '+1 month')
            AND maintenanceDue >= date('now')
        `, [user.companyId]);
        res.json({
            totalItems: totalItems.count,
            activeItems: activeItems.count,
            dueThisMonth: dueThisMonth.count,
            maintenanceDue: maintenanceDue.count,
        });
    }
    catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
// Helper function to generate unique IDs
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
exports.default = router;
