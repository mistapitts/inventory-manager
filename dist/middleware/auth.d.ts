import { Response, NextFunction } from 'express';
import { UserRole } from '../types';
import type { AuthRequest } from '../types/express';
export declare const authenticateToken: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (roles: UserRole[]) => ((req: AuthRequest, res: Response, next: NextFunction) => void);
export declare const requireCompanyAccess: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireLocationAccess: (locationId: string) => ((req: AuthRequest, res: Response, next: NextFunction) => void);
export declare const generateToken: (userId: string) => string;
//# sourceMappingURL=auth.d.ts.map