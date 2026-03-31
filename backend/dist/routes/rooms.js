"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../utils/prisma");
const crypto_2 = require("../crypto/crypto");
const jwt_1 = require("../auth/jwt");
const createRoomSchema = zod_1.z.object({
    eventName: zod_1.z.string().min(1).max(120),
    durationHours: zod_1.z.number().int().min(1).max(8760), // Up to 1 year in hours
});
const joinRoomSchema = zod_1.z.object({
    code: zod_1.z.string().min(6).max(64),
    deviceId: zod_1.z.string().min(6).max(128).optional(),
});
function randomCode(len = 10) {
    // Base32-ish (URL friendly).
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude ambiguous chars
    const bytes = crypto_1.default.randomBytes(len);
    let out = "";
    for (const b of bytes)
        out += alphabet[b % alphabet.length];
    return out;
}
exports.roomsRouter = (0, express_1.Router)();
exports.roomsRouter.post("/create", async (req, res) => {
    const body = createRoomSchema.safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: body.error.flatten() });
    const { eventName, durationHours } = body.data;
    const room = await prisma_1.prisma.room.create({
        data: { eventName, durationHours },
    });
    const volunteerCode = randomCode(10);
    const delegateCode = randomCode(10);
    const organizerCode = randomCode(10);
    const everyoneCode = randomCode(10);
    const volunteerEnc = (0, crypto_2.aesGcmEncryptBase64)(volunteerCode, room.id);
    const delegateEnc = (0, crypto_2.aesGcmEncryptBase64)(delegateCode, room.id);
    const organizerEnc = (0, crypto_2.aesGcmEncryptBase64)(organizerCode, room.id);
    const everyoneEnc = (0, crypto_2.aesGcmEncryptBase64)(everyoneCode, room.id);
    await prisma_1.prisma.roleCode.createMany({
        data: [
            {
                roomId: room.id,
                roleType: "VOLUNTEER",
                codeHash: (0, crypto_2.sha256Hex)(volunteerCode),
                codeIv: volunteerEnc.ivB64,
                codeCipher: volunteerEnc.cipherB64,
            },
            {
                roomId: room.id,
                roleType: "DELEGATE",
                codeHash: (0, crypto_2.sha256Hex)(delegateCode),
                codeIv: delegateEnc.ivB64,
                codeCipher: delegateEnc.cipherB64,
            },
            {
                roomId: room.id,
                roleType: "ORGANIZER",
                codeHash: (0, crypto_2.sha256Hex)(organizerCode),
                codeIv: organizerEnc.ivB64,
                codeCipher: organizerEnc.cipherB64,
            },
            {
                roomId: room.id,
                roleType: "EVERYONE",
                codeHash: (0, crypto_2.sha256Hex)(everyoneCode),
                codeIv: everyoneEnc.ivB64,
                codeCipher: everyoneEnc.cipherB64,
            },
        ],
    });
    const adminJwt = (0, jwt_1.signJwt)({ roomId: room.id, roleType: "ADMIN" });
    return res.json({
        roomId: room.id,
        adminJwt,
        volunteerCode,
        delegateCode,
        organizerCode,
        everyoneCode,
        event: { eventName: room.eventName, durationHours: room.durationHours },
    });
});
exports.roomsRouter.post("/join", async (req, res) => {
    const body = joinRoomSchema.safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: body.error.flatten() });
    const { code, deviceId: maybeDeviceId } = body.data;
    const codeHash = (0, crypto_2.sha256Hex)(code);
    const roleCode = await prisma_1.prisma.roleCode.findUnique({
        where: { codeHash },
    });
    if (!roleCode)
        return res.status(401).json({ error: "Invalid room code" });
    if (roleCode.roleType === "ADMIN") {
        // In this MVP, admin uses the create-room JWT directly.
        return res.status(401).json({ error: "Invalid room code" });
    }
    const deviceId = maybeDeviceId ?? crypto_1.default.randomBytes(16).toString("hex");
    const participant = await prisma_1.prisma.participant.upsert({
        where: {
            roomId_roleType_deviceId: {
                roomId: roleCode.roomId,
                roleType: roleCode.roleType,
                deviceId,
            },
        },
        create: {
            roomId: roleCode.roomId,
            roleType: roleCode.roleType,
            deviceId,
        },
        update: {},
    });
    const jwt = (0, jwt_1.signJwt)({
        roomId: participant.roomId,
        roleType: participant.roleType,
        deviceId: participant.deviceId,
    });
    return res.json({
        roomId: participant.roomId,
        roleType: participant.roleType,
        deviceId: participant.deviceId,
        jwt,
    });
});
