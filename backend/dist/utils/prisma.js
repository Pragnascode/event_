"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const prisma_1 = require("../generated/prisma");
// Avoid creating multiple Prisma clients in dev (hot reload).
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ??
    new prisma_1.PrismaClient();
if (!globalForPrisma.prisma)
    globalForPrisma.prisma = exports.prisma;
