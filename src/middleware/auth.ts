import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { database } from '../models/database';
import { UserRole } from '../types';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    companyId?: string;
    locationId?: string;
    regionId?: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
      [decoded.userId]
    );

    if (!user) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      companyId: user.companyId,
      regionId: user.regionId
    };

    next();
  } catch (error: any) {
    console.error('JWT verification failed:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.split('\n')[0]
    });
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: UserRole[]): ((req: AuthRequest, res: Response, next: NextFunction) => void) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireCompanyAccess = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role === UserRole.ADMIN) {
    next();
    return;
  }

  if (!req.user.companyId) {
    res.status(403).json({ error: 'Company access required' });
    return;
  }

  next();
};

export const requireLocationAccess = (locationId: string): ((req: AuthRequest, res: Response, next: NextFunction) => void) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // Company owners and managers can access all locations in their company
    if (req.user.role === UserRole.COMPANY_OWNER || req.user.role === UserRole.COMPANY_MANAGER) {
      next();
      return;
    }

    // Region managers can access locations in their region
    if (req.user.role === UserRole.REGION_MANAGER && req.user.regionId) {
      // Check if the location is in the user's region
      // This would require a database query to verify the location hierarchy
      next();
      return;
    }

    // Lab managers and users can only access their specific location
    if (req.user.locationId === locationId) {
      next();
      return;
    }

    res.status(403).json({ error: 'Location access denied' });
  };
};

export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};
