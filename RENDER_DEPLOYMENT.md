# 🚀 Render Deployment Guide

## Overview
This guide will help you deploy your Inventory Manager application on Render as a Web Service with persistent storage and automated backups.

## Prerequisites
- Render account (free tier works)
- GitHub repository with your code
- Basic understanding of environment variables

## Step 1: Create a New Web Service

1. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Sign in or create an account

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `labmanagement` repository

## Step 2: Configure the Web Service

### Basic Settings
- **Name**: `inventory-manager` (or your preferred name)
- **Root Directory**: *(leave blank)*
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `node dist/server.js`

### Instance Type
- **Instance Type**: Starter ($7/month) - **Required for Disks**
- **Plan**: Free tier won't work (no persistent disks)

## Step 3: Add a Persistent Disk

1. **Create Disk**
   - In your service settings, go to "Disks"
   - Click "Add Disk"
   - **Name**: `data-disk`
   - **Size**: 1 GB (minimum)
   - **Mount Path**: `/opt/data`

2. **Why This Matters**
   - SQLite database will be stored here
   - File uploads will persist across restarts
   - Backups will be stored here

## Step 4: Set Environment Variables

Add these environment variables in your service settings:

```bash
NODE_ENV=production
JWT_SECRET=your-super-long-random-secret-key-here
DB_PATH=/opt/data/inventory.db
UPLOAD_PATH=/opt/data/uploads
BACKUP_PATH=/opt/data/backups
ALLOWED_ORIGINS=https://your-app-name.onrender.com
```

### JWT_SECRET Generation
Generate a secure JWT secret:
```bash
# Option 1: Use openssl
openssl rand -base64 64

# Option 2: Use node
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## Step 5: Deploy and Test

1. **Deploy**
   - Click "Deploy" or push to your main branch
   - Wait for build to complete (usually 2-5 minutes)

2. **Test Health Endpoint**
   - Visit: `https://your-app-name.onrender.com/api/health`
   - Should return: `{"status":"OK","db":true,...}`

3. **Test Database**
   - The app will automatically create the SQLite database
   - Admin user will be created automatically

## Step 6: Set Up Automated Backups

### Create Cron Job
1. **New → Cron Job**
2. **Environment**: Same repo/branch as your web service
3. **Schedule**: `0 9 * * *` (daily at 9:00 UTC)
4. **Command**: `npm run backup:db`

### Cron Job Environment Variables
```bash
DB_PATH=/opt/data/inventory.db
BACKUP_PATH=/opt/data/backups
```

## Step 7: Verify Everything Works

### Test File Uploads
1. Add an inventory item with file uploads
2. Verify files are stored in `/opt/data/uploads`
3. Check that files persist after service restart

### Test Database Persistence
1. Add some test data
2. Restart the service
3. Verify data is still there

### Test Backups
1. Run backup manually: `npm run backup:db`
2. Check `/opt/data/backups` for timestamped files

## Troubleshooting

### Common Issues

**Build Fails**
- Check that `package.json` has correct scripts
- Verify TypeScript compilation works locally

**Service Won't Start**
- Check environment variables are set correctly
- Verify JWT_SECRET is provided in production
- Check logs for specific error messages

**Database Not Persisting**
- Verify disk is mounted at `/opt/data`
- Check `DB_PATH` environment variable
- Ensure disk size is sufficient

**File Uploads Not Working**
- Check `UPLOAD_PATH` environment variable
- Verify disk permissions
- Check service logs for errors

### Useful Commands

**Check Disk Usage**
```bash
df -h /opt/data
```

**List Backup Files**
```bash
ls -la /opt/data/backups/
```

**Check Service Logs**
- Use Render dashboard logs
- Or SSH into the service if available

## Cost Estimation

- **Starter Plan**: $7/month
- **Disk Storage**: $0.25/GB/month
- **Total**: ~$7.25/month for 1GB disk

## Security Notes

- JWT_SECRET should be long and random
- Consider setting ALLOWED_ORIGINS for production
- Database is stored on persistent disk (not in ephemeral storage)
- Backups are stored on the same disk (consider off-site backups for critical data)

## Next Steps

After successful deployment:
1. Set up custom domain (optional)
2. Configure monitoring and alerts
3. Set up CI/CD pipeline
4. Consider setting up off-site backups

---

**Need Help?** Check Render's documentation or community forums for additional support.
