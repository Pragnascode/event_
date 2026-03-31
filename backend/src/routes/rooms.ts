import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";

import { prisma } from "../utils/prisma";
import { sha256Hex, aesGcmEncryptBase64 } from "../crypto/crypto";
import { signJwt } from "../auth/jwt";
import { RoleType } from "../generated/prisma";

const createRoomSchema = z.object({
  eventName: z.string().min(1).max(120),
  durationHours: z.number().int().min(1).max(8760), // Up to 1 year in hours
});

const joinRoomSchema = z.object({
  code: z.string().min(6).max(64),
  deviceId: z.string().min(6).max(128).optional(),
});

function randomCode(len = 10): string {
  // Base32-ish (URL friendly).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude ambiguous chars
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export const roomsRouter = Router();

roomsRouter.post("/create", async (req, res) => {
  const body = createRoomSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { eventName, durationHours } = body.data;

  const room = await prisma.room.create({
    data: { eventName, durationHours },
  });

  const volunteerCode = randomCode(10);
  const delegateCode = randomCode(10);
  const organizerCode = randomCode(10);
  const everyoneCode = randomCode(10);

  const volunteerEnc = aesGcmEncryptBase64(volunteerCode, room.id);
  const delegateEnc = aesGcmEncryptBase64(delegateCode, room.id);
  const organizerEnc = aesGcmEncryptBase64(organizerCode, room.id);
  const everyoneEnc = aesGcmEncryptBase64(everyoneCode, room.id);

  await prisma.roleCode.createMany({
    data: [
      {
        roomId: room.id,
        roleType: "VOLUNTEER" as RoleType,
        codeHash: sha256Hex(volunteerCode),
        codeIv: volunteerEnc.ivB64,
        codeCipher: volunteerEnc.cipherB64,
      },
      {
        roomId: room.id,
        roleType: "DELEGATE" as RoleType,
        codeHash: sha256Hex(delegateCode),
        codeIv: delegateEnc.ivB64,
        codeCipher: delegateEnc.cipherB64,
      },
      {
        roomId: room.id,
        roleType: "ORGANIZER" as RoleType,
        codeHash: sha256Hex(organizerCode),
        codeIv: organizerEnc.ivB64,
        codeCipher: organizerEnc.cipherB64,
      },
      {
        roomId: room.id,
        roleType: "EVERYONE" as RoleType,
        codeHash: sha256Hex(everyoneCode),
        codeIv: everyoneEnc.ivB64,
        codeCipher: everyoneEnc.cipherB64,
      },
    ],
  });

  const adminJwt = signJwt({ roomId: room.id, roleType: "ADMIN" });

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

roomsRouter.post("/join", async (req, res) => {
  const body = joinRoomSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { code, deviceId: maybeDeviceId } = body.data;

  const codeHash = sha256Hex(code);

  const roleCode = await prisma.roleCode.findUnique({
    where: { codeHash },
  });

  if (!roleCode) return res.status(401).json({ error: "Invalid room code" });
  if (roleCode.roleType === "ADMIN") {
    // In this MVP, admin uses the create-room JWT directly.
    return res.status(401).json({ error: "Invalid room code" });
  }

  const deviceId = maybeDeviceId ?? crypto.randomBytes(16).toString("hex");

  const participant = await prisma.participant.upsert({
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

  const jwt = signJwt({
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

