// Permission and location access control middleware
import { Request, Response, NextFunction } from 'express';
import { database } from '../models/database';

export interface UserPermissions {
  canViewInventory: boolean;
  canEditInventory: boolean;
  canDeleteInventory: boolean;
  canManageUsers: boolean;
  canManageCompany: boolean;
  canManageLocations: boolean;
  accessibleLocationIds: string[];
  accessibleListIds: string[];
  currentLocationId?: string;
}

// Role hierarchy for permission checks
const ROLE_HIERARCHY = {
  'company_owner': 100,
  'company_admin': 90,
  'manager': 70,
  'user': 50,
  'viewer': 10
};

// Permission definitions by role
const ROLE_PERMISSIONS = {
  'company_owner': {
    canViewInventory: true,
    canEditInventory: true,
    canDeleteInventory: true,
    canManageUsers: true,
    canManageCompany: true,
    canManageLocations: true
  },
  'company_admin': {
    canViewInventory: true,
    canEditInventory: true,
    canDeleteInventory: true,
    canManageUsers: true,
    canManageCompany: true,
    canManageLocations: true
  },
  'manager': {
    canViewInventory: true,
    canEditInventory: true,
    canDeleteInventory: true,
    canManageUsers: false,
    canManageCompany: false,
    canManageLocations: false
  },
  'user': {
    canViewInventory: true,
    canEditInventory: true,
    canDeleteInventory: false,
    canManageUsers: false,
    canManageCompany: false,
    canManageLocations: false
  },
  'viewer': {
    canViewInventory: true,
    canEditInventory: false,
    canDeleteInventory: false,
    canManageUsers: false,
    canManageCompany: false,
    canManageLocations: false
  }
};

/**
 * Get user's permissions and accessible locations/lists
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  try {
    // Get user basic info
    const user = await database.get(
      'SELECT id, role, companyId FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    // Get base permissions from role
    const basePermissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || ROLE_PERMISSIONS.viewer;

    // Company owners and admins have access to all locations
    if (['company_owner', 'company_admin'].includes(user.role)) {
      const allLocations = await database.all(
        'SELECT id FROM locations WHERE companyId = ?',
        [user.companyId]
      );

      const allLists = await database.all(
        'SELECT id FROM lists WHERE companyId = ?',
        [user.companyId]
      );

      return {
        ...basePermissions,
        accessibleLocationIds: allLocations.map(loc => loc.id),
        accessibleListIds: allLists.map(list => list.id)
      };
    }

    // For other roles, get assigned locations and their accessible lists
    const userLocations = await database.all(
      `SELECT ul.locationId, ul.listPermissions, l.id as locationId
       FROM user_locations ul
       JOIN locations l ON ul.locationId = l.id
       WHERE ul.userId = ?`,
      [userId]
    );

    const accessibleLocationIds = userLocations.map(ul => ul.locationId);
    
    // Collect all accessible list IDs
    let accessibleListIds: string[] = [];
    for (const userLocation of userLocations) {
      if (userLocation.listPermissions) {
        const listIds = JSON.parse(userLocation.listPermissions);
        accessibleListIds = [...accessibleListIds, ...listIds];
      }
    }

    return {
      ...basePermissions,
      accessibleLocationIds,
      accessibleListIds
    };

  } catch (error) {
    console.error('Error getting user permissions:', error);
    return {
      canViewInventory: false,
      canEditInventory: false,
      canDeleteInventory: false,
      canManageUsers: false,
      canManageCompany: false,
      canManageLocations: false,
      accessibleLocationIds: [],
      accessibleListIds: []
    };
  }
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(permission: keyof Omit<UserPermissions, 'accessibleLocationIds' | 'accessibleListIds' | 'currentLocationId'>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissions = await getUserPermissions(userId);
      
      if (!permissions[permission]) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Attach permissions to request for later use
      req.userPermissions = permissions;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Middleware to filter data based on location access
 */
export function enforceLocationAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissions = await getUserPermissions(userId);
      req.userPermissions = permissions;

      // Add location filter to query parameters for downstream use
      req.locationFilter = {
        accessibleLocationIds: permissions.accessibleLocationIds,
        accessibleListIds: permissions.accessibleListIds
      };

      next();
    } catch (error) {
      console.error('Location access enforcement error:', error);
      res.status(500).json({ error: 'Access control failed' });
    }
  };
}

/**
 * Helper function to check if user can access a specific location
 */
export async function canAccessLocation(userId: string, locationId: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.accessibleLocationIds.includes(locationId);
}

/**
 * Helper function to check if user can access a specific list
 */
export async function canAccessList(userId: string, listId: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.accessibleListIds.includes(listId);
}

/**
 * Helper function to get current user's active location
 * Falls back to first accessible location if none specified
 */
export async function getCurrentLocation(userId: string): Promise<string | null> {
  try {
    const permissions = await getUserPermissions(userId);
    
    if (permissions.accessibleLocationIds.length === 0) {
      return null;
    }

    // For now, return first accessible location
    // Later we can add user preference storage
    return permissions.accessibleLocationIds[0];
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

// Extend Express Request type to include permission data
declare global {
  namespace Express {
    interface Request {
      userPermissions?: UserPermissions;
      locationFilter?: {
        accessibleLocationIds: string[];
        accessibleListIds: string[];
      };
    }
  }
}
