# Inventory Manager

A professional inventory and calibration management system built with Node.js, Express, and SQLite.

## Features

- **Inventory Management**: Track equipment, tools, and assets
- **Calibration Records**: Manage calibration schedules and documentation
- **Maintenance Tracking**: Monitor maintenance schedules and history
- **File Uploads**: Store calibration certificates and maintenance documents
- **User Authentication**: Secure login system with JWT tokens
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **iPad Optimized**: Touch-friendly interface with proper viewport handling

## iPad Optimizations

This application has been specifically optimized for iPad use:

- **Touch-Friendly Interface**: 44px minimum touch targets
- **Safe Area Support**: Proper handling of iPad notches and home indicators
- **Orientation Support**: Optimized layouts for both portrait and landscape
- **Prevent Zoom**: 16px font size prevents unwanted zoom on input focus
- **Smooth Scrolling**: Native iOS scrolling behavior
- **High DPI Support**: Crisp text and graphics on Retina displays

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   - Open `http://localhost:3000` in your browser
   - For iPad testing, use your computer's IP address: `http://[YOUR_IP]:3000`

## Deployment to Vercel

### Prerequisites

1. **GitHub Account**: You need a GitHub account
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)

### Step-by-Step Deployment

1. **Initialize Git Repository** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub Repository**:
   - Go to [github.com](https://github.com)
   - Click "New repository"
   - Name it `inventory-manager` (or your preferred name)
   - Don't initialize with README (we already have one)
   - Click "Create repository"

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/inventory-manager.git
   git branch -M main
   git push -u origin main
   ```

4. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub account
   - Click "New Project"
   - Import your `inventory-manager` repository
   - Vercel will auto-detect it's a Node.js project
   - Click "Deploy"

5. **Configure Environment Variables** (if needed):
   - In your Vercel project dashboard
   - Go to Settings → Environment Variables
   - Add any required environment variables

### Vercel Configuration

The project includes a `vercel.json` file that:
- Routes all API requests to the Node.js server
- Serves static files from the `public` directory
- Handles both API and frontend routes properly

## Accessing on iPad

Once deployed to Vercel:

1. **Get your deployment URL**: Vercel will provide a URL like `https://your-app.vercel.app`
2. **Open on iPad**: Open Safari and navigate to your Vercel URL
3. **Add to Home Screen** (optional):
   - Tap the share button in Safari
   - Select "Add to Home Screen"
   - The app will now work like a native iPad app

## File Structure

```
├── src/                    # TypeScript source files
│   ├── routes/            # API routes
│   ├── models/            # Database models
│   └── server.ts          # Main server file
├── public/                # Static files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Styles with iPad optimizations
│   └── app.js             # Frontend JavaScript
├── dist/                  # Compiled JavaScript (generated)
├── uploads/               # File uploads directory
├── vercel.json           # Vercel configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Environment Variables

Create a `.env` file for local development:

```env
JWT_SECRET=your-secret-key-here
PORT=3000
```

## Support

For issues or questions:
- Check the terminal logs for error messages
- Ensure all dependencies are installed
- Verify your Vercel deployment settings

## License

ISC License
