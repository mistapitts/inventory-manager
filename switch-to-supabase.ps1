# PowerShell script to switch from in-memory API to Supabase API
# Run this script when you're ready to use persistent data storage

Write-Host "🔄 Switching to Supabase API for persistent data storage..." -ForegroundColor Yellow

# Backup the old in-memory API
if (Test-Path "api/index.js") {
    Write-Host "📦 Backing up old in-memory API..." -ForegroundColor Cyan
    Copy-Item "api/index.js" "api/index.js.backup"
    Write-Host "✅ Old API backed up as api/index.js.backup" -ForegroundColor Green
}

# Replace with Supabase API
if (Test-Path "api/supabase.js") {
    Write-Host "🚀 Activating Supabase API..." -ForegroundColor Cyan
    Copy-Item "api/supabase.js" "api/index.js"
    Write-Host "✅ Supabase API is now active!" -ForegroundColor Green
} else {
    Write-Host "❌ Error: api/supabase.js not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Successfully switched to Supabase API!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Make sure you've set up Supabase (see SUPABASE_SETUP.md)" -ForegroundColor White
Write-Host "2. Add SUPABASE_URL and SUPABASE_ANON_KEY to Vercel environment variables" -ForegroundColor White
Write-Host "3. Deploy to Vercel" -ForegroundColor White
Write-Host "4. Test that items persist between sessions" -ForegroundColor White
Write-Host ""
Write-Host "🔄 To switch back to in-memory API:" -ForegroundColor Cyan
Write-Host "   Copy api/index.js.backup to api/index.js" -ForegroundColor White
