-- Supabase Database Setup for Lab Management System
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security (RLS)
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calibration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS locations ENABLE ROW LEVEL SECURITY;

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  theme TEXT DEFAULT 'default',
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  role TEXT NOT NULL,
  companyId TEXT REFERENCES companies(id),
  regionId TEXT,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  textColor TEXT DEFAULT '#ffffff',
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL REFERENCES companies(id),
  itemType TEXT NOT NULL,
  nickname TEXT,
  labId TEXT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  serialNumber TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'Good',
  dateReceived TEXT NOT NULL,
  datePlacedInService TEXT NOT NULL,
  location TEXT NOT NULL,
  calibrationDate TEXT,
  nextCalibrationDue TEXT NOT NULL,
  calibrationInterval INTEGER NOT NULL DEFAULT 12,
  calibrationIntervalType TEXT NOT NULL DEFAULT 'months',
  calibrationMethod TEXT NOT NULL DEFAULT 'In-House',
  maintenanceDate TEXT,
  maintenanceDue TEXT,
  maintenanceInterval INTEGER,
  maintenanceIntervalType TEXT,
  isOutsourced BOOLEAN NOT NULL DEFAULT false,
  isOutOfService BOOLEAN DEFAULT false,
  outOfServiceDate TEXT,
  outOfServiceReason TEXT,
  notes TEXT,
  image TEXT,
  listId TEXT REFERENCES lists(id),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calibration records table
CREATE TABLE IF NOT EXISTS calibration_records (
  id TEXT PRIMARY KEY,
  itemId TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES users(id),
  calibrationDate TEXT,
  nextCalibrationDue TEXT,
  method TEXT,
  notes TEXT,
  filePath TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maintenance records table
CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  itemId TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES users(id),
  maintenanceDate TEXT,
  nextMaintenanceDue TEXT,
  type TEXT,
  notes TEXT,
  filePath TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Changelog table
CREATE TABLE IF NOT EXISTS changelog (
  id TEXT PRIMARY KEY,
  itemId TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  fieldName TEXT,
  oldValue TEXT,
  newValue TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  isRead BOOLEAN DEFAULT false,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  role TEXT NOT NULL,
  locationId TEXT,
  regionId TEXT,
  expiresAt TIMESTAMP WITH TIME ZONE NOT NULL,
  isUsed BOOLEAN DEFAULT false,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL REFERENCES companies(id),
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  startDate TIMESTAMP WITH TIME ZONE NOT NULL,
  endDate TIMESTAMP WITH TIME ZONE NOT NULL,
  itemCount INTEGER DEFAULT 0,
  monthlyFee REAL NOT NULL,
  perItemFee REAL NOT NULL
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  companyId TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zipCode TEXT,
  country TEXT,
  parentLocationId TEXT REFERENCES locations(id),
  level TEXT NOT NULL,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(companyId);
CREATE INDEX IF NOT EXISTS idx_inventory_company ON inventory_items(companyId);
CREATE INDEX IF NOT EXISTS idx_inventory_calibration ON inventory_items(nextCalibrationDue);
CREATE INDEX IF NOT EXISTS idx_inventory_maintenance ON inventory_items(maintenanceDue);
CREATE INDEX IF NOT EXISTS idx_calibration_item ON calibration_records(itemId);
CREATE INDEX IF NOT EXISTS idx_maintenance_item ON maintenance_records(itemId);
CREATE INDEX IF NOT EXISTS idx_changelog_item ON changelog(itemId);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_lists_company ON lists(companyId);

-- Insert demo company
INSERT INTO companies (id, name, theme) 
VALUES ('demo-company-456', 'Demo Company', 'default')
ON CONFLICT (id) DO NOTHING;

-- Insert demo user
INSERT INTO users (id, email, password, firstName, lastName, role, companyId, isActive)
VALUES (
  'demo-user-123', 
  'mistapitts@gmail.com', 
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeK', -- demo123
  'Mista', 
  'Pitts', 
  'admin', 
  'demo-company-456', 
  true
)
ON CONFLICT (id) DO NOTHING;

-- Insert default lists
INSERT INTO lists (id, companyId, name, color, textColor) VALUES
  ('list-1', 'demo-company-456', 'Active Equipment', '#10b981', '#ffffff'),
  ('list-2', 'demo-company-456', 'Calibration Due', '#f59e0b', '#ffffff'),
  ('list-3', 'demo-company-456', 'Maintenance Required', '#ef4444', '#ffffff')
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies (basic - allow all for demo)
CREATE POLICY "Allow all for demo" ON companies FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON lists FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON inventory_items FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON calibration_records FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON maintenance_records FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON changelog FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON notifications FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON invite_codes FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON subscriptions FOR ALL USING (true);
CREATE POLICY "Allow all for demo" ON locations FOR ALL USING (true);
