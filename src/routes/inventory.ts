import { Router, Request, Response } from 'express';
import multer from 'multer';
import { database } from '../models/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../types/express';
import { UserRole } from '../types';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { config, ensureDirSync } from '../config';

const router = Router();

// Ensure upload directories exist
const uploadRoot = config.uploadPath;
ensureDirSync(uploadRoot);
ensureDirSync(path.join(uploadRoot, 'docs'));
ensureDirSync(path.join(uploadRoot, 'qr-codes'));
ensureDirSync(path.join(uploadRoot, 'images'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadRoot, 'docs'));
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniquePrefix}-${safeName}`);
  }
});

const upload = multer({ storage });

// Lists: get all lists for current user's company
router.get('/lists', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) return res.status(400).json({ error: 'User not associated with a company' });
        let lists = await database.all('SELECT id, name, color, textColor, createdAt, updatedAt FROM lists WHERE companyId = ? ORDER BY name', [user.companyId]);
        res.json({ lists });
    } catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ error: 'Failed to fetch lists' });
    }
});

// Lists: create a new list for company
router.post('/lists', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { name, color, textColor } = req.body as { name?: string, color?: string, textColor?: string };
        if (!name || !name.trim()) return res.status(400).json({ error: 'List name is required' });
        const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) return res.status(400).json({ error: 'User not associated with a company' });
        const id = generateId();
        const listColor = color || '#6b7280';
        const listTextColor = textColor || '#ffffff';
        await database.run('INSERT INTO lists (id, companyId, name, color, textColor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))', [id, user.companyId, name.trim(), listColor, listTextColor]);
        const created = await database.get('SELECT id, name, color, textColor, createdAt, updatedAt FROM lists WHERE id = ?', [id]);
        res.status(201).json(created);
    } catch (error) {
        console.error('Error creating list:', error);
        res.status(500).json({ error: 'Failed to create list' });
    }
});

// Lists: update a list's colors
router.put('/lists/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const listId = req.params.id;
        const { name, color, textColor } = req.body as { name?: string, color?: string, textColor?: string };
        
        const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) return res.status(400).json({ error: 'User not associated with a company' });
        
        const list = await database.get('SELECT id FROM lists WHERE id = ? AND companyId = ?', [listId, user.companyId]);
        if (!list) return res.status(404).json({ error: 'List not found' });
        
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
        
        updates.push('updatedAt = datetime(\'now\')');
        params.push(listId);
        
        await database.run(`UPDATE lists SET ${updates.join(', ')} WHERE id = ?`, params);
        const updated = await database.get('SELECT id, name, color, textColor, createdAt, updatedAt FROM lists WHERE id = ?', [listId]);
        res.json(updated);
    } catch (error) {
        console.error('Error updating list:', error);
        res.status(500).json({ error: 'Failed to update list' });
    }
});

// Lists: delete a list (and optionally reassign items to null)
router.delete('/lists/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const listId = req.params.id;
        const { deleteItems } = req.query as { deleteItems?: string };
        
        const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) return res.status(400).json({ error: 'User not associated with a company' });
        
        const list = await database.get('SELECT id FROM lists WHERE id = ? AND companyId = ?', [listId, user.companyId]);
        if (!list) return res.status(404).json({ error: 'List not found' });
        
        // Optionally delete all items in the list (with their records/files)
        if (deleteItems === 'true') {
            try {
                const items: any[] = await database.all('SELECT id FROM inventory_items WHERE companyId = ? AND listId = ?', [user.companyId, listId]);
                console.log(`Deleting ${items.length} items from list ${listId}`);
                
                for (const it of items) {
                    try {
                        // Delete related records using the column that actually exists in each table
                        const tablesToClean = ['calibration_records', 'maintenance_records', 'changelog'];
                        for (const table of tablesToClean) {
                            try {
                                const col = await resolveItemIdColumn(table);
                                if (col) {
                                    await database.run(`DELETE FROM ${table} WHERE ${col} = ?`, [it.id]);
                                }
                            } catch (tableError) {
                                console.warn(`Failed to clean table ${table} for item ${it.id}:`, tableError);
                            }
                        }
                        
                        // Delete QR code file if exists
                        try {
                            const qrPath = path.join(uploadRoot, 'qr-codes', `${it.id}.png`);
                            if (fs.existsSync(qrPath)) {
                                fs.unlinkSync(qrPath);
                            }
                        } catch (fileError) {
                            console.warn(`Failed to remove QR code file for item ${it.id}:`, fileError);
                        }
                        
                        // Delete the item itself
                        await database.run('DELETE FROM inventory_items WHERE id = ?', [it.id]);
                    } catch (itemError) {
                        console.error(`Failed to delete item ${it.id}:`, itemError);
                        // Continue with other items even if one fails
                    }
                }
            } catch (itemsError) {
                console.error('Error fetching items for deletion:', itemsError);
                // Continue to delete the list even if item deletion fails
            }
        } else {
            // Unassign items from this list
            try {
                await database.run('UPDATE inventory_items SET listId = NULL, updatedAt = datetime(\'now\') WHERE companyId = ? AND listId = ?', [user.companyId, listId]);
            } catch (updateError) {
                console.warn('Failed to unassign items from list:', updateError);
                // Continue to delete the list even if unassignment fails
            }
        }
        
        // Delete the list itself
        await database.run('DELETE FROM lists WHERE id = ? AND companyId = ?', [listId, user.companyId]);
        
        res.json({ 
            message: 'List deleted successfully', 
            deletedItems: deleteItems === 'true',
            listId: listId
        });
    } catch (error) {
        console.error('Error deleting list:', error);
        res.status(500).json({ error: 'Failed to delete list' });
    }
});

// Lists: migrate items to field list (for removing default list)
router.post('/lists/migrate-to-field', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) return res.status(400).json({ error: 'User not associated with a company' });
        
        // Check if field list exists, create if not
        let fieldList = await database.get('SELECT id FROM lists WHERE companyId = ? AND name = ?', [user.companyId, 'Field']);
        if (!fieldList) {
            const fieldId = generateId();
            await database.run('INSERT INTO lists (id, companyId, name, color, textColor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))', [fieldId, user.companyId, 'Field', '#10b981', '#ffffff']);
            fieldList = { id: fieldId };
        }
        
        // Move all items without a list to the field list
        await database.run('UPDATE inventory_items SET listId = ?, updatedAt = datetime(\'now\') WHERE companyId = ? AND (listId IS NULL OR listId = "")', [fieldList.id, user.companyId]);
        
        res.json({ 
            message: 'Items migrated to Field list successfully',
            fieldListId: fieldList.id
        });
    } catch (error) {
        console.error('Error migrating items to field list:', error);
        res.status(500).json({ error: 'Failed to migrate items' });
    }
});

// Get all inventory items for the user's company
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { listId } = req.query as { listId?: string };
        
        // Get user's company info
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        // Get all inventory items for the company, optionally filtered by list
        const params: any[] = [user.companyId];
        let where = 'companyId = ? AND isOutOfService != 1';
        if (listId && listId !== 'all') {
            where += ' AND listId = ?';
            params.push(listId);
        }
        const items = await database.all(`
            SELECT *
            FROM inventory_items
            WHERE ${where}
            ORDER BY itemType, nickname, labId
        `, params);
        
        res.json({ items });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

// Get out-of-service items
router.get('/out-of-service', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        const items = await database.all(`
            SELECT *
            FROM inventory_items
            WHERE companyId = ? AND isOutOfService = 1
            ORDER BY outOfServiceDate DESC
        `, [user.companyId]);
        
        res.json({ items });
    } catch (error) {
        console.error('Error fetching out-of-service items:', error);
        res.status(500).json({ error: 'Failed to fetch out-of-service items' });
    }
});

// Get single inventory item
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const itemId = req.params.id;
        const userId = req.user!.id;
        
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        const item = await database.get(`
            SELECT *
            FROM inventory_items
            WHERE id = ? AND companyId = ?
        `, [itemId, user.companyId]);
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        // Get calibration records
        const calibrationRecords = await database.all(`
            SELECT * FROM calibration_records 
            WHERE itemId = ? 
            ORDER BY calibrationDate DESC
        `, [itemId]);
        
        console.log('📊 Retrieved calibration records:', calibrationRecords.map(r => ({
            id: r.id,
            calibrationDate: r.calibrationDate,
            method: r.method,
            createdAt: r.createdAt
        })));
        
        // Get maintenance records
        const maintenanceRecords = await database.all(`
            SELECT * FROM maintenance_records 
            WHERE itemId = ? 
            ORDER BY maintenanceDate DESC
        `, [itemId]);
        
        // Get changelog
        const changelog = await database.all(`
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
            changelog
        });
    } catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({ error: 'Failed to fetch item' });
    }
});

// Create new inventory item
router.post('/', upload.fields([
    { name: 'calibrationTemplate', maxCount: 1 },
    { name: 'calibrationInstructions', maxCount: 1 },
    { name: 'maintenanceTemplate', maxCount: 1 },
    { name: 'maintenanceInstructions', maxCount: 1 }
]), authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        console.log('🔍 Creating item for user:', userId);
        
        const {
            itemType,
            nickname,
            labId,
            make,
            model,
            serialNumber,
            condition,
            dateReceived,
            datePlacedInService,
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
            calibrationType, // 'in_house' or 'outsourced'
            listId
        } = req.body as any;

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
            listId: listId || null
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
            calibrationType
        });
        
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            console.log('❌ User not associated with company:', userId);
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        console.log('🏢 User company ID:', user.companyId);
        
        // Generate unique ID
        const itemId = generateId();
        console.log('🆔 Generated item ID:', itemId);
        
        // Handle file uploads
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
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
            'id', 'companyId', 'itemType', 'nickname', 'labId', 'make', 'model', 
            'serialNumber', 'condition', 'dateReceived', 'datePlacedInService', 'location',
            'calibrationDate', 'nextCalibrationDue', 'calibrationInterval',
            'calibrationIntervalType', 'calibrationMethod', 'maintenanceDate', 'maintenanceDue', 
            'maintenanceInterval', 'maintenanceIntervalType', 'notes', 'calibrationTemplate', 'calibrationInstructions', 'maintenanceTemplate', 'maintenanceInstructions', 'isOutsourced', 'listId', 'createdAt', 'updatedAt'
        ];
        
        const placeholders = columns.map(() => '?').join(', ');
        const query = `INSERT INTO inventory_items (${columns.join(', ')}) VALUES (${placeholders})`;
        
        console.log('🔧 SQL Query:', query);
        
        const values = [
            itemId, user.companyId, normalized.itemType, normalized.nickname, normalized.labId, make, model,
            serialNumber, normalized.condition, dateReceived, datePlacedInService, normalized.location,
            calibrationDate, nextCalibrationDue, normalized.calibrationInterval,
            normalized.calibrationIntervalType, calibrationMethod, maintenanceDate, maintenanceDue,
            normalized.maintenanceInterval, normalized.maintenanceIntervalType, normalized.notes, calibrationTemplate, calibrationInstructions, maintenanceTemplate, maintenanceInstructions, normalized.isOutsourced, normalized.listId,
            new Date().toISOString(), new Date().toISOString()
        ];
        
        console.log('📊 Values to insert:', values);
        
        // Insert item
        await database.run(query, values);
        console.log('✅ Item inserted successfully');
        
        // Create changelog entry
        await database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'created', 'details', NULL, 'Item created', datetime('now'))
        `, [generateId(), itemId, userId]);
        
        console.log('📝 Changelog entry created');
        
                // Generate QR code
        const qrCodeData = `${req.protocol}://${req.get('host')}/item/${itemId}`;
        const qrCodePath = path.join(uploadRoot, 'qr-codes', `${itemId}.png`);
        
        // Ensure directory exists
        const qrDir = path.dirname(qrCodePath);
        if (!fs.existsSync(qrDir)) {
          fs.mkdirSync(qrDir, { recursive: true });
        }
        
        await QRCode.toFile(qrCodePath, qrCodeData, {
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 300
        });
        
        console.log('📱 QR code generated:', qrCodePath);
        
        res.status(201).json({ 
            message: 'Item created successfully',
            itemId,
            qrCodePath: `/uploads/qr-codes/${itemId}.png`
        });
        
        console.log('🎉 Item creation completed successfully!');
        
    } catch (error: any) {
        console.error('❌ Error creating item:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            errno: error.errno
        });
        res.status(500).json({ 
            error: 'Failed to create item',
            details: error.message,
            code: error.code
        });
    }
});

// Upload calibration or maintenance record
router.post('/upload-record', authenticateToken, upload.single('recordFile'), async (req: AuthRequest, res: Response) => {
    console.log('🚀 POST /upload-record endpoint called');
    console.log('📝 Request body:', req.body);
    console.log('📁 File:', req.file);
    console.log('🔍 File field name should be "recordFile"');
    
    try {
        const userId = req.user!.id;
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
            hasFile: !!file
        });
        
        if (!type || !itemId || !recordType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Verify user owns the item
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        const item = await database.get(
            'SELECT id FROM inventory_items WHERE id = ? AND companyId = ?',
            [itemId, user.companyId]
        );
        
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        if (recordType === 'existing') {
            console.log('📄 Processing existing document upload');
            console.log('📅 Existing document date values:', { 
                existingRecordDate, 
                recordDate: existingRecordDate && existingRecordDate.trim() !== '' ? existingRecordDate : null,
                fallbackDate: new Date().toISOString().split('T')[0]
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
                await database.run(`
                    INSERT INTO calibration_records (
                        id, itemId, userId, calibrationDate, nextCalibrationDue, method, notes, filePath, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [recordId, itemId, userId, formattedRecordDate, null, 'Existing Document Upload', notes || null, req.file.filename]);
                
                console.log('✅ Existing calibration document uploaded and record created');
                console.log('📊 Calibration record details:', {
                    recordId,
                    calibrationDate: formattedRecordDate,
                    method: 'Existing Document Upload',
                    notes: notes || null,
                    filePath: req.file.filename
                });
                
            } else if (type === 'maintenance') {
                // Insert maintenance record for existing document
                await database.run(`
                    INSERT INTO maintenance_records (
                        id, itemId, userId, maintenanceDate, nextMaintenanceDue, type, notes, filePath, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [recordId, itemId, userId, formattedRecordDate, null, 'Existing Document Upload', notes || null, req.file.filename]);
                
                console.log('✅ Existing maintenance document uploaded and record created');
            }
            
            // Create changelog entry for document upload
            await database.run(`
                INSERT INTO changelog (
                    id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
                ) VALUES (?, ?, ?, 'document_uploaded', ?, NULL, ?, datetime('now'))
            `, [generateId(), itemId, userId, `${type}_document`, req.file.filename]);
            
            res.status(201).json({ 
                message: `${type} document uploaded successfully`,
                filename: req.file.filename,
                recordId: recordId
            });
            
        } else if (recordType === 'new') {
            console.log('🆕 Processing new record creation');
            // For new records, require all fields and update item dates
            if (!recordDate || !nextDue || !method) {
                console.log('❌ Missing required fields for new record:', { recordDate, nextDue, method });
                return res.status(400).json({ error: 'Missing required fields for new record' });
            }
            
            if (!req.file) {
                return res.status(400).json({ error: 'File is required for new record' });
            }
            
            // Generate record ID
            const recordId = generateId();
            
            if (type === 'calibration') {
                console.log('🔧 Creating new calibration record and updating item dates');
                console.log('📅 Date values:', { recordDate, nextDue, formattedRecordDate: recordDate + ' 00:00:00', formattedNextDue: nextDue + ' 00:00:00' });
                
                // First, let's check the current state of the inventory item
                const currentItem = await database.get('SELECT id, calibrationDate, nextCalibrationDue FROM inventory_items WHERE id = ?', [itemId]);
                console.log('🔍 Current inventory item state:', currentItem);
                
                // Let's also check the table schema to see what constraints exist
                try {
                    const tableInfo = await database.all("PRAGMA table_info(inventory_items)");
                    console.log('📋 Table schema for inventory_items:', tableInfo);
                } catch (schemaError) {
                    console.log('⚠️ Could not get table schema:', schemaError);
                }
                
                // Insert calibration record
                await database.run(`
                    INSERT INTO calibration_records (
                        id, itemId, userId, calibrationDate, nextCalibrationDue, method, notes, filePath, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [recordId, itemId, userId, recordDate + ' 00:00:00', nextDue + ' 00:00:00', method, notes || null, req.file.filename]);
                
                console.log('✅ Calibration record inserted successfully');
                
                // Update item's calibration date and next calibration due date
                console.log('🔧 Updating inventory item dates:', {
                    itemId,
                    calibrationDate: recordDate + ' 00:00:00',
                    nextCalibrationDue: nextDue + ' 00:00:00'
                });
                
                try {
                    const updateResult = await database.run(`
                        UPDATE inventory_items 
                        SET calibrationDate = ?, nextCalibrationDue = ?, updatedAt = datetime('now')
                        WHERE id = ?
                    `, [recordDate + ' 00:00:00', nextDue + ' 00:00:00', itemId]);
                    
                    console.log('📊 Update result:', updateResult);
                    
                    // Verify the update worked by checking the item again
                    const updatedItem = await database.get('SELECT id, calibrationDate, nextCalibrationDue FROM inventory_items WHERE id = ?', [itemId]);
                    console.log('🔍 Updated inventory item state:', updatedItem);
                    
                    console.log('✅ Calibration record created and item dates updated');
                } catch (updateError) {
                    console.error('❌ Error updating inventory item:', updateError);
                    throw updateError;
                }
                
            } else if (type === 'maintenance') {
                console.log('🔧 Creating new maintenance record and updating item dates');
                // Insert maintenance record
                await database.run(`
                    INSERT INTO maintenance_records (
                        id, itemId, userId, maintenanceDate, nextMaintenanceDue, type, notes, filePath, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [recordId, itemId, userId, recordDate + ' 00:00:00', nextDue + ' 00:00:00', method, notes || null, req.file.filename]);
                
                console.log('✅ Maintenance record inserted successfully');
                
                // Update item's maintenance date and next maintenance due date
                console.log('🔧 Updating inventory item maintenance dates:', {
                    itemId,
                    maintenanceDate: recordDate + ' 00:00:00',
                    nextMaintenanceDue: nextDue + ' 00:00:00'
                });
                
                try {
                    const updateResult = await database.run(`
                        UPDATE inventory_items 
                        SET maintenanceDate = ?, maintenanceDue = ?, updatedAt = datetime('now')
                        WHERE id = ?
                    `, [recordDate + ' 00:00:00', nextDue + ' 00:00:00', itemId]);
                    
                    console.log('📊 Maintenance update result:', updateResult);
                    
                    // Verify the update worked by checking the item again
                    const updatedItem = await database.get('SELECT id, maintenanceDate, maintenanceDue FROM inventory_items WHERE id = ?', [itemId]);
                    console.log('🔍 Updated inventory item maintenance state:', updatedItem);
                    
                    console.log('✅ Maintenance record created and item dates updated');
                } catch (updateError) {
                    console.error('❌ Error updating inventory item maintenance dates:', updateError);
                    throw updateError;
                }
                
            } else {
                return res.status(400).json({ error: 'Invalid record type' });
            }
            
            // Create changelog entry for new record
            await database.run(`
                INSERT INTO changelog (
                    id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
                ) VALUES (?, ?, ?, 'record_added', ?, NULL, ?, datetime('now'))
            `, [generateId(), itemId, userId, `${type}_record`, `${type} record added with due date ${nextDue}`]);
            
            res.status(201).json({ 
                message: `${type} record added successfully`,
                recordId
            });
            
        } else {
            return res.status(400).json({ error: 'Invalid record type' });
        }
        
    } catch (error) {
        console.error('Error uploading record:', error);
        res.status(500).json({ error: 'Failed to upload record' });
    }
});

// Update inventory item
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const itemId = req.params.id;
        const userId = req.user!.id;
        const updateData = req.body as Record<string, any>;
        
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        // Verify item belongs to user's company
        const existingItem = await database.get(
            'SELECT id FROM inventory_items WHERE id = ? AND companyId = ?',
            [itemId, user.companyId]
        );
        
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        // Normalize inputs
        if (updateData.calibrationType !== undefined) {
            // Map UI field to schema boolean
            const val = String(updateData.calibrationType).toLowerCase();
            updateData.isOutsourced = (val === 'outsourced' || val === 'out');
            delete updateData.calibrationType;
        }

        // Whitelist of updatable columns
        const allowedColumns = new Set([
            'itemType','nickname','labId','make','model','serialNumber','condition',
            'dateReceived','datePlacedInService','location',
            'calibrationDate','nextCalibrationDue','calibrationInterval','calibrationIntervalType','calibrationMethod',
            'maintenanceDate','maintenanceDue','maintenanceInterval','maintenanceIntervalType',
            'notes','isOutsourced','image'
        ]);

        // Coerce numeric fields
        if (updateData.calibrationInterval !== undefined) {
            updateData.calibrationInterval = Number(updateData.calibrationInterval) || 0;
        }
        if (updateData.maintenanceInterval !== undefined) {
            updateData.maintenanceInterval = Number(updateData.maintenanceInterval) || 0;
        }

        // Build update query dynamically from whitelist
        const fields = Object.keys(updateData).filter(key => allowedColumns.has(key));
        
        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = [...fields.map(field => updateData[field]), itemId];
        
        await database.run(`
            UPDATE inventory_items 
            SET ${setClause}, updatedAt = datetime('now')
            WHERE id = ?
        `, values);
        
        // Create changelog entry
        const changes = fields.join(', ');
        await database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'updated', 'details', NULL, 'Updated: ${changes}', datetime('now'))
        `, [generateId(), itemId, userId]);
        
        res.json({ message: 'Item updated successfully' });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Mark item as out of service
router.patch('/:id/out-of-service', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const itemId = req.params.id;
        const userId = req.user!.id;
        const { outOfServiceDate, reason } = req.body;
        
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        // Verify item belongs to user's company
        const existingItem = await database.get(
            'SELECT id FROM inventory_items WHERE id = ? AND companyId = ?',
            [itemId, user.companyId]
        );
        
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        await database.run(`
            UPDATE inventory_items 
            SET isOutOfService = 1, 
                outOfServiceDate = ?, 
                outOfServiceReason = ?,
                updatedAt = datetime('now')
            WHERE id = ?
        `, [outOfServiceDate, reason, itemId]);
        
        // Create changelog entry
        await database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'status_changed', 'details', NULL, 'Marked as out of service: ${reason}', datetime('now'))
        `, [generateId(), itemId, userId]);
        
        res.json({ message: 'Item marked as out of service' });
    } catch (error) {
        console.error('Error marking item out of service:', error);
        res.status(500).json({ error: 'Failed to update item status' });
    }
});

// Add calibration record
router.post('/:id/calibration', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const itemId = req.params.id;
        const userId = req.user!.id;
        const { calibrationDate, nextCalibrationDue, method, notes } = req.body;
        
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        // Verify item belongs to user's company
        const existingItem = await database.get(
            'SELECT id FROM inventory_items WHERE id = ? AND companyId = ?',
            [itemId, user.companyId]
        );
        
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        // Insert calibration record
        const recordId = generateId();
        await database.run(`
            INSERT INTO calibration_records (
                id, itemId, userId, calibrationDate, nextCalibrationDue,
                method, notes, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [recordId, itemId, userId, calibrationDate + ' 00:00:00', nextCalibrationDue + ' 00:00:00', method, notes]);
        
        // Update item's calibration dates
        await database.run(`
            UPDATE inventory_items 
            SET calibrationDate = ?, 
                nextCalibrationDue = ?,
                updatedAt = datetime('now')
            WHERE id = ?
        `, [calibrationDate + ' 00:00:00', nextCalibrationDue + ' 00:00:00', itemId]);
        
        // Create changelog entry
        await database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'calibration_added', 'details', NULL, 'Calibration record added for ${calibrationDate}', datetime('now'))
        `, [generateId(), itemId, userId]);
        
        res.status(201).json({ message: 'Calibration record added successfully' });
    } catch (error) {
        console.error('Error adding calibration record:', error);
        res.status(500).json({ error: 'Failed to add calibration record' });
    }
});
// Upload templates/instructions (single or multiple fields)
router.post('/:id/files', authenticateToken, upload.fields([
    { name: 'calibrationTemplate', maxCount: 1 },
    { name: 'calibrationInstructions', maxCount: 1 },
    { name: 'maintenanceTemplate', maxCount: 1 },
    { name: 'maintenanceInstructions', maxCount: 1 },
]), async (req: AuthRequest, res: Response) => {
    try {
        const itemId = req.params.id;
        const files = req.files as Record<string, Express.Multer.File[]>;

        const updates: string[] = [];
        const params: any[] = [];
        const map: Record<string,string> = {
            calibrationTemplate: 'calibrationTemplate',
            calibrationInstructions: 'calibrationInstructions',
            maintenanceTemplate: 'maintenanceTemplate',
            maintenanceInstructions: 'maintenanceInstructions'
        };

        Object.keys(map).forEach(key => {
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
        await database.run(`UPDATE inventory_items SET ${updates.join(', ')}, updatedAt = datetime('now') WHERE id = ?`, params);

        res.json({ message: 'Files uploaded successfully' });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// Add maintenance record
router.post('/:id/maintenance', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const itemId = req.params.id;
        const userId = req.user!.id;
        const { maintenanceDate, nextMaintenanceDue, type, notes } = req.body;
        
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        // Verify item belongs to user's company
        const existingItem = await database.get(
            'SELECT id FROM inventory_items WHERE id = ? AND companyId = ?',
            [itemId, user.companyId]
        );
        
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        // Insert maintenance record
        const recordId = generateId();
        await database.run(`
            INSERT INTO maintenance_records (
                id, itemId, userId, maintenanceDate, nextMaintenanceDue,
                type, notes, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [recordId, itemId, userId, maintenanceDate + ' 00:00:00', nextMaintenanceDue + ' 00:00:00', type, notes]);
        
        console.log('✅ Maintenance record inserted successfully');
        
        // Update item's maintenance dates
        console.log('🔧 Updating inventory item maintenance dates:', {
            itemId,
            maintenanceDate: maintenanceDate + ' 00:00:00',
            nextMaintenanceDue: nextMaintenanceDue + ' 00:00:00'
        });
        
        try {
            const updateResult = await database.run(`
                UPDATE inventory_items 
                SET maintenanceDate = ?, 
                    maintenanceDue = ?,
                    updatedAt = datetime('now')
                WHERE id = ?
            `, [maintenanceDate + ' 00:00:00', nextMaintenanceDue + ' 00:00:00', itemId]);
            
            console.log('📊 Maintenance update result:', updateResult);
            
            // Verify the update worked by checking the item again
            const updatedItem = await database.get('SELECT id, maintenanceDate, maintenanceDue FROM inventory_items WHERE id = ?', [itemId]);
            console.log('🔍 Updated inventory item maintenance state:', updatedItem);
            
            console.log('✅ Maintenance record created and item dates updated');
        } catch (updateError) {
            console.error('❌ Error updating inventory item maintenance dates:', updateError);
            throw updateError;
        }
        
        // Create changelog entry
        await database.run(`
            INSERT INTO changelog (
                id, itemId, userId, action, fieldName, oldValue, newValue, timestamp
            ) VALUES (?, ?, ?, 'maintenance_added', 'details', NULL, 'Maintenance record added for ${maintenanceDate}', datetime('now'))
        `, [generateId(), itemId, userId]);
        
        res.status(201).json({ message: 'Maintenance record added successfully' });
    } catch (error) {
        console.error('Error adding maintenance record:', error);
        res.status(500).json({ error: 'Failed to add maintenance record' });
    }
});

// Helper to resolve whether a table uses camelCase or snake_case item id column
async function resolveItemIdColumn(tableName: string): Promise<string | null> {
    try {
        const cols: any[] = await database.all(`PRAGMA table_info(${tableName})`);
        if (cols?.some((c: any) => c.name === 'itemId')) return 'itemId';
        if (cols?.some((c: any) => c.name === 'item_id')) return 'item_id';
        return null;
    } catch {
        return null;
    }
}

// Delete inventory item (and associated records/files)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const itemId = req.params.id;
        const userId = req.user!.id;

        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );

        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }

        // Verify item belongs to user's company
        const existingItem = await database.get(
            'SELECT id FROM inventory_items WHERE id = ? AND companyId = ?',
            [itemId, user.companyId]
        );

        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Delete related records using the column that actually exists in each table
        const tablesToClean = ['calibration_records', 'maintenance_records', 'changelog'];
        for (const table of tablesToClean) {
            const col = await resolveItemIdColumn(table);
            if (col) {
                await database.run(`DELETE FROM ${table} WHERE ${col} = ?`, [itemId]);
            }
        }

        // Delete QR code file if exists
        try {
            const qrPath = path.join(uploadRoot, 'qr-codes', `${itemId}.png`);
            if (fs.existsSync(qrPath)) {
                fs.unlinkSync(qrPath);
            }
        } catch (err) {
            console.warn('Failed to remove QR code file for item', itemId, err);
        }

        // Delete the item itself
        await database.run('DELETE FROM inventory_items WHERE id = ?', [itemId]);

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// Delete a single calibration/maintenance record
router.delete('/:itemId/records/:recordId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { itemId, recordId } = req.params;
        const { type } = req.query; // 'calibration' | 'maintenance'
        const userId = req.user!.id;

        if (type !== 'calibration' && type !== 'maintenance') {
            return res.status(400).json({ error: 'Invalid record type' });
        }

        const user = await database.get('SELECT companyId FROM users WHERE id = ?', [userId]);
        if (!user || !user.companyId) return res.status(400).json({ error: 'User not associated with a company' });

        const item = await database.get('SELECT id FROM inventory_items WHERE id = ? AND companyId = ?', [itemId, user.companyId]);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        const table = type === 'calibration' ? 'calibration_records' : 'maintenance_records';
        await database.run(`DELETE FROM ${table} WHERE id = ? AND itemId = ?`, [recordId, itemId]);
        res.json({ message: 'Record deleted' });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({ error: 'Failed to delete record' });
    }
});

// Get inventory statistics
router.get('/stats/overview', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        
        const user = await database.get(
            'SELECT companyId FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user || !user.companyId) {
            return res.status(400).json({ error: 'User not associated with a company' });
        }
        
        // Get total items
        const totalItems = await database.get(
            'SELECT COUNT(*) as count FROM inventory_items WHERE companyId = ? AND isOutOfService != 1',
            [user.companyId]
        );
        
        // Get items due for calibration this month
        const dueThisMonth = await database.get(`
            SELECT COUNT(*) as count FROM inventory_items 
            WHERE companyId = ? AND isOutOfService != 1 
            AND nextCalibrationDue <= date('now', '+1 month')
            AND nextCalibrationDue >= date('now')
        `, [user.companyId]);
        
        // Get items due for maintenance this month
        const maintenanceDue = await database.get(`
            SELECT COUNT(*) as count FROM inventory_items 
            WHERE companyId = ? AND isOutOfService != 1 
            AND maintenanceDue <= date('now', '+1 month')
            AND maintenanceDue >= date('now')
        `, [user.companyId]);
        
        // Get out of service count
        const outOfService = await database.get(
            'SELECT COUNT(*) as count FROM inventory_items WHERE companyId = ? AND isOutOfService = 1',
            [user.companyId]
        );
        
        res.json({
            totalItems: totalItems.count,
            dueThisMonth: dueThisMonth.count,
            maintenanceDue: maintenanceDue.count,
            outOfService: outOfService.count
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Helper function to generate unique IDs
function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default router;
