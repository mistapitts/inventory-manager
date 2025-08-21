// src/types/express.d.ts
import type { Request } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

// 1) Augment Express.Request to add our `user`
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; companyId: string; role?: string };
    }
  }
}

// 2) Provide a strongly-typed AuthRequest helper (generic-friendly)
export type AuthRequest<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ParsedQs = ParsedQs,
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  user?: { id: string; companyId: string; role?: string };
};

// Important: keep this so the file is a module (no globals leak)
export {};
