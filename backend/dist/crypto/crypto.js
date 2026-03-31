"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = sha256Hex;
exports.aesGcmEncryptBase64 = aesGcmEncryptBase64;
exports.aesGcmDecryptBase64 = aesGcmDecryptBase64;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../utils/env");
function sha256Hex(input) {
    return crypto_1.default.createHash("sha256").update(input, "utf8").digest("hex");
}
function getMasterKey() {
    const key = Buffer.from(env_1.env.AES_MASTER_KEY_B64, "base64");
    if (key.length !== 32)
        throw new Error("AES_MASTER_KEY_B64 must decode to 32 bytes");
    return key;
}
// Derive a unique per-room AES-256 key from the master key and roomId.
function deriveRoomKey(roomId) {
    const master = getMasterKey();
    return crypto_1.default.createHash("sha256").update(master).update(roomId).digest(); // 32 bytes
}
function aesGcmEncryptBase64(plaintext, roomId) {
    const key = deriveRoomKey(roomId);
    const iv = crypto_1.default.randomBytes(12); // 96-bit nonce recommended for GCM
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Store cipher + tag together (simplifies schema).
    return {
        ivB64: iv.toString("base64"),
        cipherB64: Buffer.concat([ciphertext, authTag]).toString("base64"),
    };
}
function aesGcmDecryptBase64(cipherB64, ivB64, roomId) {
    const key = deriveRoomKey(roomId);
    const iv = Buffer.from(ivB64, "base64");
    const payload = Buffer.from(cipherB64, "base64");
    // Last 16 bytes are the auth tag (default for GCM).
    const authTag = payload.subarray(payload.length - 16);
    const ciphertext = payload.subarray(0, payload.length - 16);
    const decipher = crypto_1.default.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return plaintext;
}
