// Vercel serverless function with Supabase database
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer (parse multipart/form-data, keep files in memory for demo)
const upload = multer({ storage: multer.memoryStorage() });

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Demo user data
const demoUser = {
  id: 'demo-user-123',
  email: 'mistapitts@gmail.com',
  firstName: 'Mista',
  lastName: 'Pitts',
  role: 'admin',
  companyId: 'demo-company-456',
  regionId: 'demo-region-789'
};

const demoCompany = {
  id: 'demo-company-456',
  name: 'Demo Company',
  logo: null,
  theme: 'default'
};

// Helper functions
function generateToken(userId) { 
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'demo-secret-key', { expiresIn: '24h' }); 
}

function generateId() { 
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36); 
}

function generateQRCodeUrl(itemId) { 
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`item-${itemId}`)}`; 
}

function formatDate(date) { 
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }); 
}

// Ensure storage bucket exists for file uploads
async function ensureStorageBucket() {
  try {
    // First, try to list buckets to see if inventory-docs already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing storage buckets:', listError);
      // If we can't list buckets, assume the bucket might exist and continue
      return;
    }
    
    const bucketExists = buckets && buckets.some(bucket => bucket.name === 'inventory-docs');
    
    if (bucketExists) {
      console.log('Storage bucket already exists');
      return;
    }
    
    // Try to create the bucket with minimal configuration
    console.log('Attempting to create inventory-docs storage bucket...');
    
    const { error: createError } = await supabase.storage.createBucket('inventory-docs', {
      public: true,
      allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'],
      fileSizeLimit: 52428800 // 50MB
    });
    
    if (createError) {
      console.error('Failed to create storage bucket:', createError);
      
      // If bucket creation fails due to RLS policies, we'll need to handle file uploads differently
      // For now, log the error and continue - the bucket might be created manually in Supabase dashboard
      if (createError.message && createError.message.includes('row-level security policy')) {
        console.log('Storage bucket creation blocked by RLS policies. Please create the bucket manually in Supabase dashboard.');
        console.log('Bucket name: inventory-docs');
        console.log('Required settings: public: true');
        console.log('Required MIME types: image/png, image/jpeg, application/pdf, etc.');
      }
    } else {
      console.log('Storage bucket created successfully');
    }
  } catch (storageError) {
    console.error('Error in ensureStorageBucket:', storageError);
    // Continue anyway - bucket might exist or be created manually
  }
}

// Initialize storage bucket on app startup
ensureStorageBucket();

// Health check endpoint
app.get('/api/health', (req, res) => { 
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(), 
    message: 'Inventory Manager API is running', 
    environment: process.env.NODE_ENV || 'production',
    database: 'Supabase'
  }); 
});

// Temporary endpoint to check and fix database schema
app.get('/api/fix-schema', async (req, res) => {
  try {
    // Check if file columns exist
    const { data: columns, error: columnsError } = await supabase
      .from('inventory_items')
      .select('*')
      .limit(1);
    
    if (columnsError) throw columnsError;
    
    // Check if we need to add file columns
    const sampleItem = columns[0];
    const missingColumns = [];
    
    if (!sampleItem.hasOwnProperty('calibrationtemplate')) {
      missingColumns.push('calibrationtemplate');
    }
    if (!sampleItem.hasOwnProperty('calibrationinstructions')) {
      missingColumns.push('calibrationinstructions');
    }
    if (!sampleItem.hasOwnProperty('maintenancetemplate')) {
      missingColumns.push('maintenancetemplate');
    }
    if (!sampleItem.hasOwnProperty('maintenanceinstructions')) {
      missingColumns.push('maintenanceinstructions');
    }
    
    if (missingColumns.length > 0) {
      // Provide SQL commands for manual execution
      const sqlCommands = `
-- Run these SQL commands in your Supabase SQL Editor to add the missing columns:

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS calibrationtemplate TEXT;

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS calibrationinstructions TEXT;

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS maintenancetemplate TEXT;

ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS maintenanceinstructions TEXT;

-- After running these commands, refresh this page to verify the columns were added.
      `;
      
      res.json({ 
        status: 'manual_action_required', 
        message: 'Please run the SQL commands below in your Supabase SQL Editor',
        missingColumns,
        sqlCommands: sqlCommands.trim(),
        instructions: '1. Go to your Supabase dashboard > SQL Editor 2. Copy and paste the SQL commands above 3. Click "Run" 4. Refresh this page to verify'
      });
    } else {
      res.json({ 
        status: 'success', 
        message: 'All file columns already exist',
        existingColumns: ['calibrationtemplate', 'calibrationinstructions', 'maintenancetemplate', 'maintenanceinstructions']
      });
    }
  } catch (error) {
    console.error('Error checking schema:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to check schema',
      error: error.message 
    });
  }
});


// Clean up test/placeholder items
app.get('/api/cleanup-test-items', async (req, res) => {
  try {
    // Remove test items created during debugging
    const { data: testItems, error: selectError } = await supabase
      .from('inventory_items')
      .select('id')
      .or('id.like.test-%,id.like.schema-test-%');
    
    if (selectError) throw selectError;
    
    if (testItems && testItems.length > 0) {
      const testIds = testItems.map(item => item.id);
      
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .in('id', testIds);
      
      if (deleteError) throw deleteError;
      
      res.json({ 
        message: 'Test items cleaned up successfully',
        removed_count: testIds.length,
        removed_ids: testIds
      });
    } else {
      res.json({ 
        message: 'No test items found to clean up',
        removed_count: 0
      });
    }
  } catch (error) {
    console.error('Error cleaning up test items:', error);
    res.status(500).json({ error: error.message });
  }
});


// Demo login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (email === 'mistapitts@gmail.com' && password === 'demo123') {
      const token = generateToken(demoUser.id);
      res.json({ token, user: demoUser, company: demoCompany, location: null });
    } else { 
      res.status(401).json({ error: 'Invalid credentials. Use: mistapitts@gmail.com / demo123' }); 
    }
  } catch (error) { 
    res.status(500).json({ error: 'Internal server error' }); 
  }
});

// Company: setup demo company
app.post('/api/company/setup-demo', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    // Ensure demo company exists in database
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('id', demoCompany.id)
      .single();

    if (!existingCompany) {
      await supabase.from('companies').insert(demoCompany);
    }

    res.json({ company: demoCompany, message: 'Demo company setup successfully' });
  } catch (error) {
    console.error('Error setting up demo company:', error);
    res.json({ company: demoCompany, message: 'Demo company setup successfully' });
  }
});

// Lists
app.get('/api/inventory/lists', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const { data: lists, error } = await supabase
      .from('lists')
      .select('*')
      .eq('companyid', demoCompany.id);

    if (error) throw error;

    // Return empty array if no lists exist - no auto-creation
    res.json({ lists: lists || [] });
  } catch (error) {
    console.error('Error fetching lists:', error);
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

// Create new list
app.post('/api/inventory/lists', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const { name, color = '#6b7280', textColor = '#ffffff' } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    const newList = {
      id: generateId(),
      companyid: demoCompany.id,
      name,
      color,
      textcolor: textColor,
      createdat: new Date().toISOString(),
      updatedat: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('lists')
      .insert(newList)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating list:', error);
    res.status(500).json({ error: 'Failed to create list' });
  }
});

app.put('/api/inventory/lists/:id', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const listId = req.params.id;
    const { name, color, textColor } = req.body;
    
    const { data, error } = await supabase
      .from('lists')
      .update({ name, color, textColor, updatedAt: new Date().toISOString() })
      .eq('id', listId)
      .eq('companyid', demoCompany.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating list:', error);
    res.status(500).json({ error: 'Failed to update list' });
  }
});

// Delete list
app.delete('/api/inventory/lists/:id', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const listId = req.params.id;
    
    // Check if list has any items
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('listid', listId)
      .limit(1);

    if (itemsError) throw itemsError;

    if (items && items.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete list that contains items. Move or delete items first.' 
      });
    }

    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', listId)
      .eq('companyid', demoCompany.id);

    if (error) throw error;
    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error('Error deleting list:', error);
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

// Helper function to convert database fields to frontend format
function convertDbItemToFrontend(dbItem) {
  return {
    id: dbItem.id,
    companyId: dbItem.companyid,
    itemType: dbItem.itemtype,
    nickname: dbItem.nickname,
    labId: dbItem.labid,
    make: dbItem.make,
    model: dbItem.model,
    serialNumber: dbItem.serialnumber,
    condition: dbItem.condition,
    dateReceived: dbItem.datereceived,
    datePlacedInService: dbItem.dateplacedinservice,
    location: dbItem.location,
    calibrationDate: dbItem.calibrationdate,
    nextCalibrationDue: dbItem.nextcalibrationdue,
    calibrationInterval: dbItem.calibrationinterval,
    calibrationIntervalType: dbItem.calibrationintervaltype,
    calibrationMethod: dbItem.calibrationmethod,
    maintenanceDate: dbItem.maintenancedate,
    maintenanceDue: dbItem.maintenancedue,
    maintenanceInterval: dbItem.maintenanceinterval,
    maintenanceIntervalType: dbItem.maintenanceintervaltype,
    isOutsourced: dbItem.isoutsourced,
    isOutOfService: dbItem.isoutofservice,
    outOfServiceDate: dbItem.outofservicedate,
    outOfServiceReason: dbItem.outofservicereason,
    notes: dbItem.notes,
    image: dbItem.image,
    listId: dbItem.listid,
    // Add file fields
    calibrationTemplate: dbItem.calibrationtemplate,
    calibrationInstructions: dbItem.calibrationinstructions,
    maintenanceTemplate: dbItem.maintenancetemplate,
    maintenanceInstructions: dbItem.maintenanceinstructions,
    createdAt: dbItem.createdat,
    updatedAt: dbItem.updatedat
  };
}

// Inventory: list
app.get('/api/inventory', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const { data: items, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('companyid', demoCompany.id);

    if (error) throw error;
    
    // Convert database format to frontend format
    const convertedItems = (items || []).map(convertDbItemToFrontend);
    
    res.json({ items: convertedItems });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Inventory: details
app.get('/api/inventory/:id', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const { data: item, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', req.params.id)
      .eq('companyid', demoCompany.id)
      .single();

    if (error) throw error;
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Convert database item to frontend format (camelCase)
    const convertedItem = convertDbItemToFrontend(item);

    res.json({ 
      item: convertedItem, 
      calibrationRecords: [], 
      maintenanceRecords: [], 
      changelog: [{ id: generateId(), action: 'viewed', timestamp: new Date().toISOString() }] 
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Inventory: create
app.post('/api/inventory', upload.any(), async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const itemId = generateId();
    const now = new Date();
    const nextCal = new Date(now.getTime() + 365*24*60*60*1000);
    const nextMaint = new Date(now.getTime() + 180*24*60*60*1000);

    // Handle multipart form data and convert empty strings to null
    const fields = {};
    
    Object.keys(req.body || {}).forEach(key => {
      const value = req.body[key];
      // Convert empty strings to null for cleaner database storage
      fields[key] = value === '' ? null : value;
    });
    
    // Handle file uploads
    const uploadedFiles = req.files || [];
    const filePaths = {};
    
    console.log('Uploaded files count:', uploadedFiles.length);
    console.log('Uploaded files:', uploadedFiles.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, size: f.size })));
    
    // Process uploaded files using Supabase Storage (Vercel compatible)
    for (const file of uploadedFiles) {
      console.log('Processing file:', file.fieldname, file.originalname);
      
      if (file.fieldname === 'calibrationTemplate' || 
          file.fieldname === 'calibrationInstructions' || 
          file.fieldname === 'maintenanceTemplate' || 
          file.fieldname === 'maintenanceInstructions') {
        
        try {
          // Generate unique filename while preserving original name
          const fileExtension = file.originalname.split('.').pop();
          const fileName = `${file.fieldname}_${itemId}_${file.originalname}`;
          
          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('inventory-docs')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
              cacheControl: '3600'
            });
          
          if (uploadError) {
            console.error(`Error uploading ${file.fieldname}:`, uploadError);
            continue; // Skip this file but continue with others
          }
          
          // Get public URL for the file
          const { data: urlData } = supabase.storage
            .from('inventory-docs')
            .getPublicUrl(fileName);
          
          // Store file path for database
          filePaths[file.fieldname] = fileName;
          
          console.log(`Successfully uploaded ${file.fieldname}:`, fileName);
        } catch (fileError) {
          console.error(`Error processing ${file.fieldname}:`, fileError);
          // Continue with other files
        }
      } else {
        console.log('Skipping non-file field:', file.fieldname);
      }
    }
    
    console.log('Final filePaths object:', filePaths);

    
    const item = {
      id: itemId,
      companyid: demoCompany.id,
      itemtype: fields.itemType || 'Equipment',
      nickname: fields.nickname || '',
      labid: fields.labId || `LAB-${itemId.substring(0,4).toUpperCase()}`,
      make: fields.make || '',
      model: fields.model || '',
      serialnumber: fields.serialNumber || `SN-${itemId.substring(0,6).toUpperCase()}`,
      condition: fields.condition || 'Good',
      datereceived: fields.dateReceived || formatDate(now),
      dateplacedinservice: fields.datePlacedInService || fields.dateReceived || formatDate(now),
      location: fields.location || 'In-House',
      calibrationdate: fields.calibrationDate || formatDate(now),
      nextcalibrationdue: fields.nextCalibrationDue || formatDate(nextCal),
      calibrationinterval: fields.calibrationInterval ? Number(fields.calibrationInterval) : 12,
      calibrationintervaltype: fields.calibrationIntervalType || 'months',
      calibrationmethod: fields.calibrationMethod || 'In-House',
      maintenancedate: fields.maintenanceDate || null,
      maintenancedue: fields.maintenanceDue || null,
      maintenanceinterval: fields.maintenanceInterval ? Number(fields.maintenanceInterval) : null,
      maintenanceintervaltype: fields.maintenanceIntervalType || null,
      isoutsourced: (fields.calibrationType || 'in_house') === 'outsourced',
      isoutofservice: false,
      outofservicedate: null,
      outofservicereason: null,
      notes: fields.notes || '',
      image: null,
      listid: fields.listId || null,
      // Add file paths for uploaded files
      calibrationtemplate: filePaths.calibrationTemplate || null,
      calibrationinstructions: filePaths.calibrationInstructions || null,
      maintenancetemplate: filePaths.maintenanceTemplate || null,
      maintenanceinstructions: filePaths.maintenanceInstructions || null,
      createdat: now.toISOString(),
      updatedat: now.toISOString()
    };

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(item)
      .select()
      .single();

    if (error) throw error;

    const qrCodeUrl = generateQRCodeUrl(itemId);
    res.status(201).json({ 
      item: convertDbItemToFrontend(data), 
      qrCodeUrl, 
      qrCodePath: qrCodeUrl, 
      message: 'Item created successfully' 
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Inventory: update
app.put('/api/inventory/:id', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    console.log('Update item request body:', req.body);
    
    // Clean the request body - remove undefined values and convert empty strings to null
    const updateData = {};
    Object.keys(req.body).forEach(key => {
      const value = req.body[key];
      if (value !== undefined && value !== '') {
        // Convert frontend camelCase to database lowercase
        const dbKey = key.toLowerCase();
        updateData[dbKey] = value;
      } else if (value === '') {
        const dbKey = key.toLowerCase();
        updateData[dbKey] = null;
      }
    });
    
    // Handle special case for calibrationType
    if (updateData.calibrationtype) {
      updateData.isoutsourced = updateData.calibrationtype === 'outsourced';
      delete updateData.calibrationtype;
    }
    
    updateData.updatedat = new Date().toISOString();
    
    console.log('Cleaned update data (converted to DB format):', updateData);
    
    const { data, error } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('companyid', demoCompany.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error details:', error);
      throw error;
    }
    res.json(data);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item', details: error.message });
  }
});

// Inventory: delete
app.delete('/api/inventory/:id', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', req.params.id)
      .eq('companyid', demoCompany.id);

    if (error) throw error;
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Inventory stats
app.get('/api/inventory/stats/overview', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const { data: items, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('companyid', demoCompany.id);

    if (error) throw error;

    const totalItems = items.length;
    const now = new Date();
    const dueThisMonth = items.filter(i => { 
      const d = new Date(i.nextcalibrationdue); 
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); 
    }).length;
    const maintenanceDue = items.filter(i => i.maintenancedue && new Date(i.maintenancedue) <= now).length;
    
    res.json({ totalItems, dueThisMonth, maintenanceDue });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Dynamic QR code generation
app.get('/uploads/qr-codes/:itemId.png', async (req, res) => {
  try {
    const { itemId } = req.params;
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const host = req.headers.host;
    const itemUrl = `${proto}://${host}/item/${itemId}`;
    const png = await QRCode.toBuffer(itemUrl, { errorCorrectionLevel: 'M', type: 'png', margin: 1, scale: 6 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (e) {
    res.status(404).end();
  }
});

// File download endpoint for Supabase Storage
app.get('/api/storage/download/:fileName', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const { fileName } = req.params;
    
    // Download file from Supabase Storage
    const { data, error } = await supabase.storage
      .from('inventory-docs')
      .download(fileName);
    
    if (error) throw error;
    
    // Get original filename from the generated filename
    // Format: calibrationTemplate_itemId.ext -> extract original name
    let displayName = fileName;
    if (fileName.includes('_')) {
      const parts = fileName.split('_');
      if (parts.length >= 3) {
        // Remove the fieldname and itemId parts, keep the rest as original name
        displayName = parts.slice(2).join('_');
      }
    }
    
    // Determine content type based on file extension
    const extension = fileName.split('.').pop().toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (extension) {
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'doc':
        contentType = 'application/msword';
        break;
      case 'docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'xls':
        contentType = 'application/vnd.ms-excel';
        break;
      case 'xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${displayName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Convert blob to buffer and send
    const buffer = Buffer.from(await data.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Upload calibration or maintenance record
app.post('/api/inventory/upload-record', upload.single('recordFile'), async (req, res) => {
  console.log('🚀 POST /upload-record endpoint called');
  console.log('📝 Request body:', req.body);
  console.log('📁 File:', req.file);
  
  try {
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
    
    // Check if we have a file to upload
    if (!req.file) {
      return res.status(400).json({ error: 'File is required for record upload' });
    }
    
    // Try to upload file to Supabase Storage first
    let filePath = null;
    try {
      console.log('📤 Attempting to upload file to Supabase Storage...');
      
      // Generate unique filename
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `${type}_${itemId}_${Date.now()}.${fileExtension}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('inventory-docs')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600'
        });
      
      if (uploadError) {
        console.error('❌ File upload to Supabase failed:', uploadError);
        
        // If storage bucket doesn't exist or RLS blocks it, we'll store just the filename
        // This allows the record to be created even if file storage fails
        if (uploadError.message && uploadError.message.includes('row-level security policy')) {
          console.log('⚠️ Storage bucket blocked by RLS. Storing filename only.');
          filePath = fileName; // Store the intended filename for future reference
        } else {
          throw uploadError;
        }
      } else {
        console.log('✅ File uploaded successfully to Supabase Storage');
        filePath = fileName;
      }
    } catch (storageError) {
      console.error('❌ Storage error:', storageError);
      // Continue with filename only - this allows the record to be created
      filePath = req.file.originalname;
    }
    
    if (recordType === 'existing') {
      console.log('📄 Processing existing document upload');
      
      // Generate record ID for the existing document
      const recordId = generateId();
      
      // Use the optional existingRecordDate if provided, otherwise leave blank
      // Handle empty string case - convert to null
      const recordDate = existingRecordDate && existingRecordDate.trim() !== '' ? existingRecordDate : null;
      const formattedRecordDate = recordDate ? recordDate + ' 00:00:00' : null;
      
      if (type === 'calibration') {
        // Insert calibration record for existing document
        const { error: calError } = await supabase
          .from('calibration_records')
          .insert({
            id: recordId,
            itemid: itemId,
            userid: req.user?.id || 'system',
            calibrationdate: formattedRecordDate,
            nextcalibrationdue: null,
            method: 'Existing Document Upload',
            notes: notes || null,
            filepath: filePath,
            createdat: new Date().toISOString()
          });
        
        if (calError) throw calError;
        
        console.log('✅ Existing calibration document uploaded and record created');
        
      } else if (type === 'maintenance') {
        // Insert maintenance record for existing document
        const { error: maintError } = await supabase
          .from('maintenance_records')
          .insert({
            id: recordId,
            itemid: itemId,
            userid: req.user?.id || 'system',
            maintenancedate: formattedRecordDate,
            nextmaintenancedue: null,
            type: 'Existing Document Upload',
            notes: notes || null,
            filepath: filePath,
            createdat: new Date().toISOString()
          });
        
        if (maintError) throw maintError;
        
        console.log('✅ Existing maintenance document uploaded and record created');
      }
      
      res.status(201).json({ 
        message: `${type} document uploaded successfully`,
        filename: filePath,
        recordId: recordId
      });
      
    } else if (recordType === 'new') {
      console.log('🆕 Processing new record creation');
      // For new records, require all fields and update item dates
      if (!recordDate || !nextDue || !method) {
        console.log('❌ Missing required fields for new record:', { recordDate, nextDue, method });
        return res.status(400).json({ error: 'Missing required fields for new record' });
      }
      
      // Generate record ID
      const recordId = generateId();
      
      if (type === 'calibration') {
        console.log('🔧 Creating new calibration record and updating item dates');
        
        // Insert calibration record
        const { error: calError } = await supabase
          .from('calibration_records')
          .insert({
            id: recordId,
            itemid: itemId,
            userid: req.user?.id || 'system',
            calibrationdate: recordDate + ' 00:00:00',
            nextcalibrationdue: nextDue + ' 00:00:00',
            method: method,
            notes: notes || null,
            filepath: filePath,
            createdat: new Date().toISOString()
          });
        
        if (calError) throw calError;
        
        console.log('✅ Calibration record inserted successfully');
        
        // Update item's calibration date and next calibration due date
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({
            calibrationdate: recordDate + ' 00:00:00',
            nextcalibrationdue: nextDue + ' 00:00:00',
            updatedat: new Date().toISOString()
          })
          .eq('id', itemId);
        
        if (updateError) throw updateError;
        
        console.log('✅ Calibration record created and item dates updated');
        
      } else if (type === 'maintenance') {
        console.log('🔧 Creating new maintenance record and updating item dates');
        
        // Insert maintenance record
        const { error: maintError } = await supabase
          .from('maintenance_records')
          .insert({
            id: recordId,
            itemid: itemId,
            userid: req.user?.id || 'system',
            maintenancedate: recordDate + ' 00:00:00',
            nextmaintenancedue: nextDue + ' 00:00:00',
            type: method,
            notes: notes || null,
            filepath: filePath,
            createdat: new Date().toISOString()
          });
        
        if (maintError) throw maintError;
        
        console.log('✅ Maintenance record inserted successfully');
        
        // Update item's maintenance date and next maintenance due date
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({
            maintenancedate: recordDate + ' 00:00:00',
            maintenancedue: nextDue + ' 00:00:00',
            updatedat: new Date().toISOString()
          })
          .eq('id', itemId);
        
        if (updateError) throw updateError;
        
        console.log('✅ Maintenance record created and item dates updated');
        
      } else {
        return res.status(400).json({ error: 'Invalid record type' });
      }
      
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

// SPA fallback
app.get(/^\/(?!api).*/, (req, res) => { 
  res.sendFile(path.join(__dirname, '../public/index.html')); 
});

module.exports = app;