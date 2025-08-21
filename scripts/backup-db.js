/**
 * Simple SQLite backup script.
 * Copies the DB file to /opt/data/backups/<timestamp>.sqlite on Render,
 * or to ./backups locally.
 */
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve('./data/inventory.db');
const backupsRoot = 
  process.env.BACKUP_PATH || 
  (process.env.DB_PATH?.startsWith('/opt/data') ? '/opt/data/backups' : path.resolve('./backups'));

if (!fs.existsSync(backupsRoot)) fs.mkdirSync(backupsRoot, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(backupsRoot, `db-backup-${ts}.sqlite`);

fs.copyFile(dbPath, dest, (err) => {
  if (err) {
    console.error('Backup failed:', err);
    process.exit(1);
  } else {
    console.log('Backup created:', dest);
    process.exit(0);
  }
});
