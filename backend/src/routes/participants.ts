import { Router } from "express";
import { z } from "zod";

import { prisma } from "../utils/prisma";
import { requireAuth, type AuthedRequest } from "../auth/requireAuth";
import { aesGcmEncryptBase64, aesGcmDecryptBase64 } from "../crypto/crypto";

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isManual: z.boolean().optional(),
});

export const participantsRouter = Router();

participantsRouter.put(
  "/:roomId/location",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const { roomId } = req.params;
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId) return res.status(403).json({ error: "Forbidden" });

    const body = updateLocationSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });

    if (!req.auth.deviceId) return res.status(400).json({ error: "Missing deviceId claim" });

    const { latitude, longitude, isManual = false } = body.data;
    const payload = JSON.stringify({ latitude, longitude, isManual, timestamp: new Date().toISOString() });
    const enc = aesGcmEncryptBase64(payload, roomId);

    await prisma.participant.update({
      where: {
        roomId_roleType_deviceId: {
          roomId,
          roleType: req.auth.roleType,
          deviceId: req.auth.deviceId,
        },
      },
      data: {
        locationIv: enc.ivB64,
        locationCipher: enc.cipherB64,
        lastLocationAt: new Date(),
      },
    });

    return res.json({ ok: true });
  },
);

participantsRouter.get(
  "/:roomId/my-location",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const { roomId } = req.params;
    if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId) return res.status(403).json({ error: "Forbidden" });

    if (!req.auth.deviceId) return res.status(400).json({ error: "Missing deviceId claim" });

    const p = await prisma.participant.findUnique({
      where: {
        roomId_roleType_deviceId: {
          roomId,
          roleType: req.auth.roleType,
          deviceId: req.auth.deviceId,
        },
      },
    });

    if (!p || !p.locationCipher || !p.locationIv) {
      return res.json({ location: null });
    }

    const payload = aesGcmDecryptBase64(p.locationCipher, p.locationIv, roomId);
    const loc = JSON.parse(payload) as { latitude: number; longitude: number; isManual?: boolean; timestamp?: string };

    return res.json({
      location: {
        lat: loc.latitude,
        lng: loc.longitude,
        isManual: loc.isManual ?? false,
        updatedAt: loc.timestamp ?? p.lastLocationAt?.toISOString() ?? null,
      },
    });
  },
);

