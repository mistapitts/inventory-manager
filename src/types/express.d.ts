// Ambient augmentation for Express Request. Do NOT import this file anywhere.
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email?: string;
      companyId?: string;
      role?: string;
    };
  }
}
