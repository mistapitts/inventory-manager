// DO NOT import this file anywhere. It is picked up automatically by tsconfig `typeRoots`.
import 'express';

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      companyId: string;
      role?: string;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {}; // keep this so the file is treated as a module while we augment `global`
