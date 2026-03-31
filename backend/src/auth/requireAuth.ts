import type { Request, Response, NextFunction } from "express";
import { verifyJwt } from "./jwt";
import type { JwtClaims } from "./jwt";

export type AuthedRequest = Request & { auth?: JwtClaims };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }
    const token = header.slice("Bearer ".length);
    req.auth = verifyJwt(token);
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

