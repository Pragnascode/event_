"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../utils/prisma");
const requireAuth_1 = require("../auth/requireAuth");
const requireRole_1 = require("../auth/requireRole");
const crypto_1 = require("../crypto/crypto");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.get("/rooms/:roomId/details", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)(["ADMIN", "ORGANIZER"]), async (req, res) => {
    const { roomId } = req.params;
    if (!req.auth)
        return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId)
        return res.status(403).json({ error: "Forbidden" });
    const room = await prisma_1.prisma.room.findUnique({ where: { id: roomId } });
    if (!room)
        return res.status(404).json({ error: "Not found" });
    return res.json({
        eventName: room.eventName,
        durationHours: room.durationHours,
    });
});
exports.adminRouter.get("/rooms/:roomId/codes", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)(["ADMIN", "ORGANIZER"]), async (req, res) => {
    const { roomId } = req.params;
    if (!req.auth)
        return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId)
        return res.status(403).json({ error: "Forbidden" });
    const roleCodes = await prisma_1.prisma.roleCode.findMany({
        where: { roomId },
    });
    const codesByRole = {};
    for (const rc of roleCodes) {
        const plaintext = (0, crypto_1.aesGcmDecryptBase64)(rc.codeCipher, rc.codeIv, roomId);
        codesByRole[rc.roleType] = plaintext;
    }
    return res.json({
        volunteerCode: codesByRole["VOLUNTEER"] ?? null,
        delegateCode: codesByRole["DELEGATE"] ?? null,
        organizerCode: codesByRole["ORGANIZER"] ?? null,
        everyoneCode: codesByRole["EVERYONE"] ?? null,
    });
});
exports.adminRouter.get("/rooms/:roomId/locations", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)(["ADMIN", "ORGANIZER"]), async (req, res) => {
    const { roomId } = req.params;
    if (!req.auth)
        return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId)
        return res.status(403).json({ error: "Forbidden" });
    const participants = await prisma_1.prisma.participant.findMany({
        where: { roomId, locationCipher: { not: null } },
        orderBy: { lastLocationAt: "desc" },
    });
    const points = participants
        .filter((p) => p.locationCipher && p.locationIv)
        .map((p) => {
        const payload = (0, crypto_1.aesGcmDecryptBase64)(p.locationCipher, p.locationIv, roomId);
        const loc = JSON.parse(payload);
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
});
