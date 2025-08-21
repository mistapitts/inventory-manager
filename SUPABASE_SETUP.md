# Supabase Setup Guide for Lab Management System

This guide will walk you through setting up Supabase as your persistent database for the lab management system.

## Why Supabase?

- **FREE tier** with 500MB database + 2GB bandwidth/month
- **No credit card required** to start
- **Persistent data** - your items will stay saved forever
- **Access from any device** - perfect for your use case
- **Easy setup** - just a few clicks

## Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign Up"
3. Sign up with GitHub, Google, or email
4. **No credit card required** for the free tier

## Step 2: Create New Project

1. Click "New Project"
2. Choose your organization (or create one)
3. Enter project details:
   - **Name**: `lab-management` (or whatever you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait 2-3 minutes for setup to complete

## Step 3: Get Your API Keys

1. In your project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://abcdefghijklmnop.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 4: Set Up Database Tables

1. In your project dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the entire contents of `supabase-setup.sql`
4. Click "Run" to execute the SQL
5. You should see success messages for all table creations

## Step 5: Update Vercel Environment Variables

1. Go to your Vercel dashboard
2. Select your lab management project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:
   - **Name**: `SUPABASE_URL`
   - **Value**: Your project URL from Step 3
   - **Environment**: Production (and Preview if you want)
5. Add another variable:
   - **Name**: `SUPABASE_ANON_KEY`
   - **Value**: Your anon key from Step 3
   - **Environment**: Production (and Preview if you want)
6. Click "Save"

## Step 6: Deploy with Supabase API

1. **Option A**: Replace your current API
   - Rename `api/index.js` to `api/index.js.backup`
   - Rename `api/supabase.js` to `api/index.js`

2. **Option B**: Keep both and test
   - Deploy as-is and test the new Supabase API
   - Switch when you're ready

## Step 7: Test Your Setup

1. Deploy to Vercel
2. Go to your app and log in with:
   - **Email**: `mistapitts@gmail.com`
   - **Password**: `demo123`
3. Create a new inventory item
4. Refresh the page - the item should still be there!
5. Open the app on another device - same data!

## Troubleshooting

### "Database connection failed"

- Check your environment variables in Vercel
- Verify your Supabase URL and key are correct
- Make sure you copied the "anon public" key, not the service role key

### "Table doesn't exist"

- Go back to Step 4 and run the SQL setup again
- Check the SQL Editor for any error messages

### "Authentication failed"

- Verify your demo user was created in the database
- Check the SQL setup completed successfully

## What This Gives You

✅ **Persistent data** - Items stay saved forever  
✅ **Access from any device** - Your boss can see items from anywhere  
✅ **QR codes work perfectly** - No more lost data between sessions  
✅ **Professional demo** - Show off the full system capabilities  
✅ **Scalable foundation** - Easy to add more features later

## Next Steps After Setup

1. **Test thoroughly** - Create items, edit them, delete them
2. **Show your boss** - The QR code functionality will work perfectly now!
3. **Customize** - Add your company branding, colors, etc.
4. **Scale up** - Add more users, locations, or features as needed

## Support

If you run into any issues:

- Check the Supabase logs in your project dashboard
- Verify all environment variables are set correctly
- Make sure the SQL setup completed without errors

---

**You're all set!** Once this is configured, your lab management system will have persistent data that works from any device, and your boss will be able to see the full QR code functionality in action.
