import type { Response, NextFunction } from "express";
import { RoleType } from "../generated/prisma";
import type { AuthedRequest } from "./requireAuth";

export function requireRole(roles: RoleType[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.auth.roleType)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

