"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signJwt = signJwt;
exports.verifyJwt = verifyJwt;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../utils/env");
function signJwt(claims) {
    // 7 days is enough for demo; adjust later.
    return jsonwebtoken_1.default.sign(claims, env_1.env.JWT_SECRET, { expiresIn: "7d" });
}
function verifyJwt(token) {
    const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    if (typeof decoded === "string" || decoded === null)
        throw new Error("Invalid JWT");
    const claims = decoded;
    if (!claims.roomId || !claims.roleType)
        throw new Error("Invalid JWT claims");
    return claims;
}
