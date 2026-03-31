"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.participantsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma");
const requireAuth_1 = require("../auth/requireAuth");
const crypto_1 = require("../crypto/crypto");
const updateLocationSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    isManual: zod_1.z.boolean().optional(),
});
exports.participantsRouter = (0, express_1.Router)();
exports.participantsRouter.put("/:roomId/location", requireAuth_1.requireAuth, async (req, res) => {
    const { roomId } = req.params;
    if (!req.auth)
        return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId)
        return res.status(403).json({ error: "Forbidden" });
    const body = updateLocationSchema.safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: body.error.flatten() });
    if (!req.auth.deviceId)
        return res.status(400).json({ error: "Missing deviceId claim" });
    const { latitude, longitude, isManual = false } = body.data;
    const payload = JSON.stringify({ latitude, longitude, isManual, timestamp: new Date().toISOString() });
    const enc = (0, crypto_1.aesGcmEncryptBase64)(payload, roomId);
    await prisma_1.prisma.participant.update({
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
});
exports.participantsRouter.get("/:roomId/my-location", requireAuth_1.requireAuth, async (req, res) => {
    const { roomId } = req.params;
    if (!req.auth)
        return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId)
        return res.status(403).json({ error: "Forbidden" });
    if (!req.auth.deviceId)
        return res.status(400).json({ error: "Missing deviceId claim" });
    const p = await prisma_1.prisma.participant.findUnique({
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
    const payload = (0, crypto_1.aesGcmDecryptBase64)(p.locationCipher, p.locationIv, roomId);
    const loc = JSON.parse(payload);
    return res.json({
        location: {
            lat: loc.latitude,
            lng: loc.longitude,
            isManual: loc.isManual ?? false,
            updatedAt: loc.timestamp ?? p.lastLocationAt?.toISOString() ?? null,
        },
    });
});
