import fs from 'fs';
import path from 'path';

import { Router } from 'express';
import mime from 'mime';

import config from '../config';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/storage/download?file=<relative-path-or-name>
 * Example: /api/storage/download?file=calibration/templates/misty%20Proctor.pdf
 *
 * Safely downloads files from the uploads directory with proper path resolution
 * and security measures to prevent path traversal attacks.
 */
router.get('/download', authenticateToken, (req, res) => {
  try {
    const fileQuery = (req.query.file as string) || '';
    if (!fileQuery) {
      return res.status(400).json({ error: 'Missing file query parameter' });
    }

    // Normalize and resolve the file path within the uploads directory
    // Files are stored directly in the uploadDocsDir, so we can resolve directly
    const uploadsRoot = config.paths.uploadDocsDir;
    const normalizedPath = path.normalize(fileQuery);
    const absPath = path.resolve(uploadsRoot, normalizedPath);

    // Prevent path traversal attacks - ensure the resolved path stays within uploads
    if (!absPath.startsWith(uploadsRoot)) {
      console.warn('Path traversal attempt blocked:', { fileQuery, absPath, uploadsRoot });
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Check if file exists
    if (!fs.existsSync(absPath)) {
      console.warn('File not found:', { fileQuery, absPath });
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if it's actually a file (not a directory)
    const stats = fs.statSync(absPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    // Get the filename for the download (just the basename, not the full path)
    const downloadFilename = path.basename(absPath);

    // Set appropriate headers for file download (UX + security) - RFC 6266 compliant
    const contentType = mime.getType(absPath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // RFC 6266 compliant filename headers with fallback for international characters
    const asciiFilename = downloadFilename.replace(/[^\x00-\x7F]/g, '_'); // ASCII fallback
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
    );
    res.setHeader('Cache-Control', 'no-store');

    // Stream the file for efficient memory usage
    const fileStream = fs.createReadStream(absPath);
    fileStream.pipe(res);

    console.log('File download successful:', { fileQuery, downloadFilename, fileSize: stats.size });
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * OPTIONAL: Alternative path-param version for backward compatibility
 * GET /api/storage/download/* (everything after /download/)
 *
 * This is kept as an optional alternative but the query param version above
 * is preferred for handling special characters and spaces.
 */
router.get('/download/*', authenticateToken, (req, res) => {
  try {
    const filePath = (req.params[0] || '').trim();
    if (!filePath) {
      return res.status(400).json({ error: 'Missing filename' });
    }

    // Reuse the same logic as the query param version
    const uploadsRoot = config.paths.uploadDocsDir;
    const normalizedPath = path.normalize(filePath);
    const absPath = path.resolve(uploadsRoot, normalizedPath);

    // Prevent path traversal
    if (!absPath.startsWith(uploadsRoot)) {
      console.warn('Path traversal attempt blocked (path-param):', {
        filePath,
        absPath,
        uploadsRoot,
      });
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(absPath)) {
      console.warn('File not found (path-param):', { filePath, absPath });
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(absPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    const downloadFilename = path.basename(absPath);
    const contentType = mime.getType(absPath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // RFC 6266 compliant filename headers with fallback for international characters
    const asciiFilename = downloadFilename.replace(/[^\x00-\x7F]/g, '_'); // ASCII fallback
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
    );
    res.setHeader('Cache-Control', 'no-store');

    const fileStream = fs.createReadStream(absPath);
    fileStream.pipe(res);

    console.log('File download successful (path-param):', {
      filePath,
      downloadFilename,
      fileSize: stats.size,
    });
  } catch (error) {
    console.error('Download error (path-param):', error);
    return res.status(500).json({ error: 'Failed to download file' });
  }
});

export default router;
