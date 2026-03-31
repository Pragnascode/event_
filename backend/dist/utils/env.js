"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
function required(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env var: ${name}`);
    return v;
}
exports.env = {
    PORT: Number(process.env.PORT ?? 8080),
    DATABASE_URL: required("DATABASE_URL"),
    JWT_SECRET: required("JWT_SECRET"),
    AES_MASTER_KEY_B64: required("AES_MASTER_KEY_B64"),
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
};
