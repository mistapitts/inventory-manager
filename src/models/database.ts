import fs from 'fs';
import path from 'path';

import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';

import config from '../config';
import { UserRole } from '../types';

const dbPath = config.paths.dbFile;
// Directory creation is now handled by config.ensureBootPaths()

export class Database {
  public db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(dbPath);
    this.init();
  }

  private async init(): Promise<void> {
    await this.createTables();
    await this.addMissingColumns();
    await this.createAdminUser();
  }

  private async createTables(): Promise<void> {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        role TEXT NOT NULL,
        companyId TEXT,
        regionId TEXT,
        isActive BOOLEAN DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Companies table
      `CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        logo TEXT,
        theme TEXT,
        isActive BOOLEAN DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Lists table (per company)
      `CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6b7280',
        textColor TEXT DEFAULT '#ffffff',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (companyId) REFERENCES companies (id)
      )`,

      // Subscriptions table
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        startDate DATETIME NOT NULL,
        endDate DATETIME NOT NULL,
        itemCount INTEGER DEFAULT 0,
        monthlyFee REAL NOT NULL,
        perItemFee REAL NOT NULL,
        FOREIGN KEY (companyId) REFERENCES companies (id)
      )`,

      // Locations table
      `CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        state TEXT,
        zipCode TEXT,
        country TEXT,
        parentLocationId TEXT,
        level TEXT NOT NULL,
        isActive BOOLEAN DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (companyId) REFERENCES companies (id),
        FOREIGN KEY (parentLocationId) REFERENCES locations (id)
      )`,

      // Inventory items table
      `CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        itemType TEXT NOT NULL,
        nickname TEXT,
        labId TEXT,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        serialNumber TEXT NOT NULL,
        condition TEXT NOT NULL,
        dateReceived DATETIME NOT NULL,
        datePlacedInService DATETIME NOT NULL,
        location TEXT NOT NULL,
        calibrationDate DATETIME,
        nextCalibrationDue DATETIME NOT NULL,
        calibrationInterval INTEGER NOT NULL,
        calibrationIntervalType TEXT NOT NULL,
        calibrationMethod TEXT NOT NULL,
        maintenanceDate DATETIME,
        maintenanceDue DATETIME,
        maintenanceInterval INTEGER,
        maintenanceIntervalType TEXT,
        isOutsourced BOOLEAN NOT NULL,
        isOutOfService BOOLEAN DEFAULT 0,
        outOfServiceDate DATETIME,
        outOfServiceReason TEXT,
        notes TEXT,
        image TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (companyId) REFERENCES companies (id)
      )`,

      // Calibration records table
      `CREATE TABLE IF NOT EXISTS calibration_records (
        id TEXT PRIMARY KEY,
        itemId TEXT NOT NULL,
        userId TEXT NOT NULL,
        calibrationDate DATETIME,
        nextCalibrationDue DATETIME,
        method TEXT,
        notes TEXT,
        filePath TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (itemId) REFERENCES inventory_items (id),
        FOREIGN KEY (userId) REFERENCES users (id)
      )`,

      // Maintenance records table
      `CREATE TABLE IF NOT EXISTS maintenance_records (
        id TEXT PRIMARY KEY,
        itemId TEXT NOT NULL,
        userId TEXT NOT NULL,
        maintenanceDate DATETIME,
        nextMaintenanceDue DATETIME,
        type TEXT,
        notes TEXT,
        filePath TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (itemId) REFERENCES inventory_items (id),
        FOREIGN KEY (userId) REFERENCES users (id)
      )`,

      // Changelog table
      `CREATE TABLE IF NOT EXISTS changelog (
        id TEXT PRIMARY KEY,
        itemId TEXT NOT NULL,
        userId TEXT NOT NULL,
        action TEXT NOT NULL,
        fieldName TEXT,
        oldValue TEXT,
        newValue TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (itemId) REFERENCES inventory_items (id),
        FOREIGN KEY (userId) REFERENCES users (id)
      )`,

      // Notifications table
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        isRead BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users (id)
      )`,

      // Invite codes table
      `CREATE TABLE IF NOT EXISTS invite_codes (
        id TEXT PRIMARY KEY,
        companyId TEXT NOT NULL,
        code TEXT NOT NULL,
        role TEXT NOT NULL,
        locationId TEXT,
        regionId TEXT,
        expiresAt DATETIME NOT NULL,
        isUsed BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (companyId) REFERENCES companies (id),
        FOREIGN KEY (locationId) REFERENCES locations (id),
        FOREIGN KEY (regionId) REFERENCES locations (id)
      )`,
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_company ON users(companyId)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_company ON inventory_items(companyId)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_calibration ON inventory_items(nextCalibrationDue)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_maintenance ON inventory_items(maintenanceDue)',
      'CREATE INDEX IF NOT EXISTS idx_calibration_item ON calibration_records(itemId)',
      'CREATE INDEX IF NOT EXISTS idx_maintenance_item ON maintenance_records(itemId)',
      'CREATE INDEX IF NOT EXISTS idx_changelog_item ON changelog(itemId)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId)',
      'CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code)',
      'CREATE INDEX IF NOT EXISTS idx_lists_company ON lists(companyId)',
    ];

    for (const index of indexes) {
      await this.run(index);
    }
  }

  private async addMissingColumns(): Promise<void> {
    try {
      // Check if inventory_items table exists
      const tableExists = await this.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_items'",
      );
      if (!tableExists) {
        console.log('Table inventory_items does not exist yet, will be created with full schema');
        return;
      }

      // Get all existing columns
      const columns = await this.all('PRAGMA table_info(inventory_items)');
      const columnNames = columns.map((col: any) => col.name);

      console.log('Existing columns in inventory_items:', columnNames);

      // Define all required columns with their types and defaults
      const requiredColumns = [
        { name: 'condition', type: 'TEXT NOT NULL DEFAULT "new"' },
        { name: 'calibrationIntervalType', type: 'TEXT NOT NULL DEFAULT "months"' },
        { name: 'maintenanceIntervalType', type: 'TEXT' },
        { name: 'calibrationTemplate', type: 'TEXT' },
        { name: 'calibrationInstructions', type: 'TEXT' },
        { name: 'maintenanceTemplate', type: 'TEXT' },
        { name: 'maintenanceInstructions', type: 'TEXT' },
        { name: 'isOutsourced', type: 'BOOLEAN NOT NULL DEFAULT 0' },
        { name: 'isOutOfService', type: 'BOOLEAN DEFAULT 0' },
        { name: 'outOfServiceDate', type: 'DATETIME' },
        { name: 'outOfServiceReason', type: 'TEXT' },
        { name: 'outOfServiceReportedBy', type: 'TEXT' },
        { name: 'outOfServiceNotes', type: 'TEXT' },
        { name: 'returnToServiceDate', type: 'DATETIME' },
        { name: 'returnToServiceResolvedBy', type: 'TEXT' },
        { name: 'returnToServiceVerified', type: 'BOOLEAN' },
        { name: 'returnToServiceVerifiedAt', type: 'DATETIME' },
        { name: 'returnToServiceVerifiedBy', type: 'TEXT' },
        { name: 'returnToServiceNotes', type: 'TEXT' },
        { name: 'image', type: 'TEXT' },
        { name: 'createdAt', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updatedAt', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'listId', type: 'TEXT' },
      ];

      // Add missing columns
      for (const column of requiredColumns) {
        if (!columnNames.includes(column.name)) {
          try {
            await this.run(`ALTER TABLE inventory_items ADD COLUMN ${column.name} ${column.type}`);
            console.log(`✅ Added missing column: ${column.name}`);
          } catch (error) {
            console.log(`❌ Failed to add column ${column.name}:`, error);
          }
        } else {
          console.log(`✅ Column ${column.name} already exists`);
        }
      }

      // Final column check
      const finalColumns = await this.all('PRAGMA table_info(inventory_items)');
      const finalColumnNames = finalColumns.map((col: any) => col.name);
      console.log('Final columns in inventory_items:', finalColumnNames);

      // Also ensure record tables are compatible with uploads
      await this.migrateRecordTablesIfNeeded();

      // Add missing columns to lists table
      await this.addMissingListColumns();
    } catch (error) {
      console.error('❌ Error in addMissingColumns:', error);
    }
  }

  private async addMissingListColumns(): Promise<void> {
    try {
      // Check if lists table exists
      const tableExists = await this.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='lists'",
      );
      if (!tableExists) {
        console.log('Table lists does not exist yet, will be created with full schema');
        return;
      }

      // Get all existing columns
      const columns = await this.all('PRAGMA table_info(lists)');
      const columnNames = columns.map((col: any) => col.name);

      console.log('Existing columns in lists:', columnNames);

      // Define required columns for lists
      const requiredListColumns = [
        { name: 'color', type: 'TEXT DEFAULT "#6b7280"' },
        { name: 'textColor', type: 'TEXT DEFAULT "#ffffff"' },
      ];

      // Add missing columns
      for (const column of requiredListColumns) {
        if (!columnNames.includes(column.name)) {
          try {
            await this.run(`ALTER TABLE lists ADD COLUMN ${column.name} ${column.type}`);
            console.log(`✅ Added missing column to lists: ${column.name}`);
          } catch (error) {
            console.log(`❌ Failed to add column ${column.name} to lists:`, error);
          }
        } else {
          console.log(`✅ Column ${column.name} already exists in lists`);
        }
      }
    } catch (error) {
      console.error('❌ Error in addMissingListColumns:', error);
    }
  }

  private async migrateRecordTablesIfNeeded(): Promise<void> {
    // Calibration records: add filePath column and relax NOT NULL on dates/method
    try {
      const calCols: any[] = await this.all('PRAGMA table_info(calibration_records)');
      if (calCols && calCols.length > 0) {
        const hasFilePath = calCols.some((c: any) => c.name === 'filePath');
        const calDate = calCols.find((c: any) => c.name === 'calibrationDate');
        const nextDue = calCols.find((c: any) => c.name === 'nextCalibrationDue');
        const methodCol = calCols.find((c: any) => c.name === 'method');
        const needsRelax =
          (calDate && calDate.notnull === 1) ||
          (nextDue && nextDue.notnull === 1) ||
          (methodCol && methodCol.notnull === 1);

        if (!hasFilePath || needsRelax) {
          console.log('🔧 Migrating calibration_records schema...');
          await this.run('BEGIN TRANSACTION');
          await this.run(`
            CREATE TABLE IF NOT EXISTS calibration_records_new (
              id TEXT PRIMARY KEY,
              itemId TEXT NOT NULL,
              userId TEXT NOT NULL,
              calibrationDate DATETIME,
              nextCalibrationDue DATETIME,
              method TEXT,
              notes TEXT,
              filePath TEXT,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (itemId) REFERENCES inventory_items (id),
              FOREIGN KEY (userId) REFERENCES users (id)
            )
          `);
          await this.run(`
            INSERT INTO calibration_records_new (id, itemId, userId, calibrationDate, nextCalibrationDue, method, notes, createdAt)
            SELECT id, itemId, userId, calibrationDate, nextCalibrationDue, method, notes, createdAt FROM calibration_records
          `);
          await this.run('DROP TABLE calibration_records');
          await this.run('ALTER TABLE calibration_records_new RENAME TO calibration_records');
          await this.run(
            'CREATE INDEX IF NOT EXISTS idx_calibration_item ON calibration_records(itemId)',
          );
          await this.run('COMMIT');
          console.log('✅ calibration_records migrated');
        }
      }
    } catch (e) {
      console.warn('Calibration records migration skipped or failed:', e);
      try {
        await this.run('ROLLBACK');
      } catch {}
    }

    // Maintenance records: add filePath column and relax NOT NULL on dates/type
    try {
      const mCols: any[] = await this.all('PRAGMA table_info(maintenance_records)');
      if (mCols && mCols.length > 0) {
        const hasFilePath = mCols.some((c: any) => c.name === 'filePath');
        const hasNotes = mCols.some((c: any) => c.name === 'notes');
        const mDate = mCols.find((c: any) => c.name === 'maintenanceDate');
        const mNext = mCols.find((c: any) => c.name === 'nextMaintenanceDue');
        const typeCol = mCols.find((c: any) => c.name === 'type');
        const needsRelax =
          (mDate && mDate.notnull === 1) ||
          (mNext && mNext.notnull === 1) ||
          (typeCol && typeCol.notnull === 1) ||
          !hasNotes;

        if (!hasFilePath || needsRelax) {
          console.log('🔧 Migrating maintenance_records schema...');
          await this.run('BEGIN TRANSACTION');
          await this.run(`
            CREATE TABLE IF NOT EXISTS maintenance_records_new (
              id TEXT PRIMARY KEY,
              itemId TEXT NOT NULL,
              userId TEXT NOT NULL,
              maintenanceDate DATETIME,
              nextMaintenanceDue DATETIME,
              type TEXT,
              notes TEXT,
              filePath TEXT,
              createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (itemId) REFERENCES inventory_items (id),
              FOREIGN KEY (userId) REFERENCES users (id)
            )
          `);
          await this.run(`
            INSERT INTO maintenance_records_new (id, itemId, userId, maintenanceDate, nextMaintenanceDue, type, notes, createdAt)
            SELECT id, itemId, userId, maintenanceDate, nextMaintenanceDue, type, notes, createdAt FROM maintenance_records
          `);
          await this.run('DROP TABLE maintenance_records');
          await this.run('ALTER TABLE maintenance_records_new RENAME TO maintenance_records');
          await this.run(
            'CREATE INDEX IF NOT EXISTS idx_maintenance_item ON maintenance_records(itemId)',
          );
          await this.run('COMMIT');
          console.log('✅ maintenance_records migrated');
        }
      }
    } catch (e) {
      console.warn('Maintenance records migration skipped or failed:', e);
      try {
        await this.run('ROLLBACK');
      } catch {}
    }
  }

  private async createAdminUser(): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123!';

    // Check if admin user already exists
    const existingAdmin = await this.get('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const adminId = this.generateId();

      await this.run(
        'INSERT INTO users (id, email, password, firstName, lastName, role, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [adminId, adminEmail, hashedPassword, 'Mista', 'Pitts', UserRole.ADMIN, true],
      );

      console.log('Admin user created successfully');
      console.log('Email:', adminEmail);
      console.log('Password:', adminPassword);
    }
  }

  public async run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  public async all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  public close(): void {
    this.db.close();
  }
}

export const database = new Database();
