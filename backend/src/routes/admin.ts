import { Router } from "express";

import { prisma } from "../utils/prisma";
import { requireAuth, type AuthedRequest } from "../auth/requireAuth";
import { requireRole } from "../auth/requireRole";
import { aesGcmDecryptBase64 } from "../crypto/crypto";

export const adminRouter = Router();

adminRouter.get(
  "/rooms/:roomId/details",
  requireAuth,
  requireRole(["ADMIN", "ORGANIZER"]),
  async (req: AuthedRequest, res) => {
    const { roomId } = req.params;
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId) return res.status(403).json({ error: "Forbidden" });

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: "Not found" });

    return res.json({
      eventName: room.eventName,
      durationHours: room.durationHours,
    });
  },
);

adminRouter.get(
  "/rooms/:roomId/codes",
  requireAuth,
  requireRole(["ADMIN", "ORGANIZER"]),
  async (req: AuthedRequest, res) => {
    const { roomId } = req.params;
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId) return res.status(403).json({ error: "Forbidden" });

    const roleCodes = await prisma.roleCode.findMany({
      where: { roomId },
    });

    const codesByRole: Record<string, string> = {};
    for (const rc of roleCodes) {
      const plaintext = aesGcmDecryptBase64(rc.codeCipher, rc.codeIv, roomId);
      codesByRole[rc.roleType] = plaintext;
    }

    return res.json({
      volunteerCode: codesByRole["VOLUNTEER"] ?? null,
      delegateCode: codesByRole["DELEGATE"] ?? null,
      organizerCode: codesByRole["ORGANIZER"] ?? null,
      everyoneCode: codesByRole["EVERYONE"] ?? null,
    });
  },
);

adminRouter.get(
  "/rooms/:roomId/locations",
  requireAuth,
  requireRole(["ADMIN", "ORGANIZER"]),
  async (req: AuthedRequest, res) => {
    const { roomId } = req.params;
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId) return res.status(403).json({ error: "Forbidden" });

    const participants = await prisma.participant.findMany({
      where: { roomId, locationCipher: { not: null } },
      orderBy: { lastLocationAt: "desc" },
    });

    const points = participants
      .filter((p) => p.locationCipher && p.locationIv)
      .map((p) => {
        const payload = aesGcmDecryptBase64(p.locationCipher!, p.locationIv!, roomId);
        const loc = JSON.parse(payload) as { latitude: number; longitude: number; isManual?: boolean; timestamp?: string };
        return {
          deviceId: p.deviceId,
          roleType: p.roleType,
          latitude: loc.latitude,
          longitude: loc.longitude,
          isManual: loc.isManual ?? false,
          updatedAt: loc.timestamp ?? p.lastLocationAt?.toISOString() ?? null,
        };
      });

    return res.json({ points });
  },
);

