// DO NOT import this file anywhere.
// It's picked up via tsconfig `typeRoots` and augments the real express types.
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

export {}; // keeps the file a module but doesn't create a module named "express"
