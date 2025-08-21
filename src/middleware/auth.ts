import { type Response   } from 'express';
import jwt from 'jsonwebtoken';

import { database } from '../models/database';
import { UserRole } from '../types';
import type { NextFunction } from 'express';

import type express from 'express';


export const authenticateToken = async (
  req: express.Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    const decoded = jwt.verify(token, secret) as any;
    // Debug: successful decode
    // console.log('Auth OK for userId:', decoded?.userId);

    // Get user from database to ensure they still exist and are active
    const user = await database.get(
      'SELECT id, email, role, companyId, regionId FROM users WHERE id = ? AND isActive = 1',
      [decoded.userId],
    );

    if (!user) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = {
      id: user.id,
      companyId: user.companyId,
      role: user.role as UserRole,
    };

    next();
  } catch (error: any) {
    console.error('JWT verification failed:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.split('\n')[0],
    });
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (
  roles: UserRole[],
): ((req: express.Request, res: Response, next: NextFunction) => void) => {
  return (req: express.Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!req.user.role || !roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireCompanyAccess = (req: express.Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role === UserRole.ADMIN) {
    next();
    return;
  }

  // For now, allow access - company access logic can be implemented later
  next();
};

export const requireLocationAccess = (
  locationId: string,
): ((req: express.Request, res: Response, next: NextFunction) => void) => {
  return (req: express.Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!req.user.role) {
      res.status(401).json({ error: 'User role not found' });
      return;
    }

    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // For now, allow access - location access logic can be implemented later
    next();
  };
};

export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};
