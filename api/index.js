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

    // Ensure storage bucket exists for file uploads
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets.some(bucket => bucket.name === 'inventory-docs');
      
      if (!bucketExists) {
        const { error: bucketError } = await supabase.storage.createBucket('inventory-docs', {
          public: true,
          allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
          fileSizeLimit: 52428800 // 50MB
        });
        
        if (bucketError) {
          console.error('Error creating storage bucket:', bucketError);
        } else {
          console.log('Storage bucket created successfully');
        }
      }
    } catch (storageError) {
      console.error('Error checking/creating storage bucket:', storageError);
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
    
    // Process uploaded files using Supabase Storage (Vercel compatible)
    for (const file of uploadedFiles) {
      if (file.fieldname === 'calibrationTemplate' || 
          file.fieldname === 'calibrationInstructions' || 
          file.fieldname === 'maintenanceTemplate' || 
          file.fieldname === 'maintenanceInstructions') {
        
        try {
          // Generate unique filename
          const fileExtension = file.originalname.split('.').pop();
          const fileName = `${file.fieldname}_${itemId}.${fileExtension}`;
          
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
      }
    }

    
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
    const { data, error } = await supabase
      .from('inventory_items')
      .update({ ...req.body, updatedAt: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('companyid', demoCompany.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
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
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Send the file
    res.send(data);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// SPA fallback
app.get(/^\/(?!api).*/, (req, res) => { 
  res.sendFile(path.join(__dirname, '../public/index.html')); 
});

module.exports = app;