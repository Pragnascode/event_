import crypto from "crypto";
import { env } from "../utils/env";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function getMasterKey(): Buffer {
  const key = Buffer.from(env.AES_MASTER_KEY_B64, "base64");
  if (key.length !== 32) throw new Error("AES_MASTER_KEY_B64 must decode to 32 bytes");
  return key;
}

// Derive a unique per-room AES-256 key from the master key and roomId.
function deriveRoomKey(roomId: string): Buffer {
  const master = getMasterKey();
  return crypto.createHash("sha256").update(master).update(roomId).digest(); // 32 bytes
}

export function aesGcmEncryptBase64(plaintext: string, roomId: string) {
  const key = deriveRoomKey(roomId);
  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Store cipher + tag together (simplifies schema).
  return {
    ivB64: iv.toString("base64"),
    cipherB64: Buffer.concat([ciphertext, authTag]).toString("base64"),
  };
}

export function aesGcmDecryptBase64(cipherB64: string, ivB64: string, roomId: string) {
  const key = deriveRoomKey(roomId);
  const iv = Buffer.from(ivB64, "base64");
  const payload = Buffer.from(cipherB64, "base64");

  // Last 16 bytes are the auth tag (default for GCM).
  const authTag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(0, payload.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return plaintext;
}

