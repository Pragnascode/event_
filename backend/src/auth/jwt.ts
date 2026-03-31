import jwt from "jsonwebtoken";
import { env } from "../utils/env";
import { RoleType } from "../generated/prisma";

export type JwtClaims = {
  roomId: string;
  roleType: RoleType;
  deviceId?: string;
};

export function signJwt(claims: JwtClaims): string {
  // 7 days is enough for demo; adjust later.
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): JwtClaims {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string" || decoded === null) throw new Error("Invalid JWT");
  const claims = decoded as JwtClaims;
  if (!claims.roomId || !claims.roleType) throw new Error("Invalid JWT claims");
  return claims;
}

