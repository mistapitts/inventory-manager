# 🚀 Randy's Inventory Manager - Demo Setup Guide

## Quick Start Demo

This guide will help you get the inventory manager running for your company demo!

## Prerequisites

- ✅ Node.js installed
- ✅ All dependencies installed (`npm install`)
- ✅ Server built (`npm run build`)

## Step 1: Start the Server

```bash
npm start
```

You should see:

```
🚀 Inventory Manager API running on port 3000
📊 Database initialized successfully
🔐 Admin account ready
🌐 Server: http://localhost:3000
```

## Step 2: Setup Demo Company

**IMPORTANT:** Before you can use the app, you need to create a demo company.

1. Open your browser and go to: `http://localhost:3000/api/company/setup-demo`
2. You should see a success message with company and location IDs
3. This creates "Randy's Company" and associates your admin account with it

## Step 3: Test the Application

1. Go to `http://localhost:3000` in your browser
2. Login with:
   - **Email:** mistapitts@gmail.com
   - **Password:** Admin123!
3. You'll see the dashboard with stats (all showing 0 initially)

## Step 4: Add Your First Inventory Item

1. Click the **"Add Item"** button (currently shows "coming soon" message)
2. The system is ready to accept inventory items through the API

## Demo Features Available

✅ **Complete Login System** - Professional authentication
✅ **Dashboard with Stats** - Real-time inventory counts
✅ **Company Setup** - Multi-tenant ready
✅ **Database Schema** - All tables created
✅ **API Endpoints** - Full CRUD operations ready
✅ **QR Code Generation** - Automatic for each item
✅ **Changelog System** - Track all changes
✅ **Role-Based Access** - Company owner permissions

## Company Server Deployment

### For Your Company's Server:

1. **Copy the entire project folder** to your company server
2. **Install Node.js** on the server
3. **Run `npm install`** to install dependencies
4. **Run `npm run build`** to compile
5. **Run `npm start`** to start the server
6. **Access from any computer** on your network at `http://[SERVER-IP]:3000`

### Benefits of Company Server:

- 🏢 **No monthly cloud costs**
- 🔒 **Data stays on your network**
- ⚡ **Faster access for your team**
- 🛡️ **Full control over security**
- 📊 **Easy backup to existing systems**

## PowerShell Launcher

Use the included `launch-app.ps1` script to:

- Check if server is running
- Start server if needed
- Open app in browser automatically
- Provide demo instructions

## Next Steps for Full Functionality

1. **Add Item Form** - Modal for creating new inventory items
2. **Item Detail Pages** - Full item information with QR codes
3. **Calibration Records** - Add/update calibration dates
4. **Maintenance Records** - Track maintenance schedules
5. **Excel Export** - Download inventory lists
6. **Notifications** - Email alerts for due dates

## Demo for Company Owner

**Perfect for showing:**

- Professional, modern interface
- Complete database structure
- Multi-user ready
- Scalable architecture
- Industry-standard features
- Cost-effective deployment

## Support

If you encounter any issues:

1. Check the server console for error messages
2. Verify all dependencies are installed
3. Ensure the database file has write permissions
4. Check that port 3000 is available

---

**Ready to impress your company owner with a professional inventory management system! 🎯**
