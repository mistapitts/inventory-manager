# Randy's Inventory Manager - Launch Script
# This script launches the inventory manager application

Write-Host "🚀 Launching Randy's Inventory Manager..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is running
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "✅ Node.js server is already running" -ForegroundColor Green
} else {
    Write-Host "⚠️  Node.js server is not running. Starting server..." -ForegroundColor Yellow
    
    # Start the server in the background
    Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    
    # Wait a moment for the server to start
    Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

# Check if server is responding
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Server is responding successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Server is not responding. Please check if the server started correctly." -ForegroundColor Red
    Write-Host "You may need to run 'npm start' manually in another terminal." -ForegroundColor Yellow
    exit 1
}

# Launch the application in the default browser
Write-Host "🌐 Opening Randy's Inventory Manager in your browser..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "🎯 Demo Instructions:" -ForegroundColor Cyan
Write-Host "1. Login with: mistapitts@gmail.com / Admin123!" -ForegroundColor White
Write-Host "2. First, setup the demo company by visiting: http://localhost:3000/api/company/setup-demo" -ForegroundColor White
Write-Host "3. Then return to the main app and start adding inventory items!" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Keep this PowerShell window open to keep the server running" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server when you're done" -ForegroundColor Yellow

# Keep the script running to maintain the server process
try {
    while ($true) {
        Start-Sleep -Seconds 10
        # Check if server is still running
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if (-not $response -or $response.StatusCode -ne 200) {
            Write-Host "⚠️  Server appears to have stopped. You may need to restart it." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "✅ Demo session ended. Server is still running in the background." -ForegroundColor Green
    Write-Host "To stop the server completely, close any npm processes." -ForegroundColor Yellow
}
