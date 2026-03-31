"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma");
const requireAuth_1 = require("../auth/requireAuth");
const prisma_2 = require("../generated/prisma");
const createAlertSchema = zod_1.z.object({
    alertType: zod_1.z.enum(["EVERYONE", "ROLE"]),
    targetRole: zod_1.z.enum(["DELEGATE", "VOLUNTEER", "ORGANIZER", "EVERYONE"]).optional(),
    message: zod_1.z.string().min(1).max(500),
});
const panicSchema = zod_1.z.object({
    message: zod_1.z.string().min(1).max(500).optional(),
});
exports.alertsRouter = (0, express_1.Router)();
exports.alertsRouter.post("/:roomId/alerts", requireAuth_1.requireAuth, async (req, res) => {
    const { roomId } = req.params;
    if (!req.auth)
        return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId)
        return res.status(403).json({ error: "Forbidden" });
    const body = createAlertSchema.safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: body.error.flatten() });
    const { alertType, targetRole, message } = body.data;
    // Only Admin/Organizer can send targeted or non-everyone alerts? 
    // Or maybe everyone can send to EVERYONE.
    const isPowerUser = req.auth.roleType === "ADMIN" || req.auth.roleType === "ORGANIZER";
    if (!isPowerUser && alertType !== "EVERYONE") {
        return res.status(403).json({ error: "Only admins/organizers can send targeted alerts" });
    }
    if (alertType === "ROLE" && !targetRole) {
        return res.status(400).json({ error: "targetRole is required for ROLE alerts" });
    }
    const alert = await prisma_1.prisma.alert.create({
        data: {
            roomId,
            createdByRole: req.auth.roleType,
            targetType: alertType,
            targetRole: alertType === "ROLE" ? targetRole : null,
            message,
            isPanic: false,
        },
    });
    return res.json({ ok: true, alertId: alert.id });
});
exports.alertsRouter.post("/:roomId/panic", requireAuth_1.requireAuth, async (req, res) => {
    const { roomId } = req.params;
    if (!req.auth)
        return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId)
        return res.status(403).json({ error: "Forbidden" });
    const body = panicSchema.safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: body.error.flatten() });
    const message = body.data.message ?? "Emergency panic triggered.";
    if (req.auth.roleType !== "ADMIN" && req.auth.roleType !== "DELEGATE" && req.auth.roleType !== "VOLUNTEER" && req.auth.roleType !== "ORGANIZER" && req.auth.roleType !== "EVERYONE") {
        return res.status(403).json({ error: "Forbidden" });
    }
    const alert = await prisma_1.prisma.alert.create({
        data: {
            roomId,
            createdByRole: req.auth.roleType,
            targetType: prisma_2.AlertTargetType.EVERYONE,
            targetRole: null,
            message,
            isPanic: true,
        },
    });
    return res.json({ ok: true, alertId: alert.id });
});
exports.alertsRouter.get("/:roomId/alerts", requireAuth_1.requireAuth, async (req, res) => {
    const { roomId } = req.params;
    if (!req.auth)
        return res.status(401).json({ error: "Unauthorized" });
    if (req.auth.roomId !== roomId)
        return res.status(403).json({ error: "Forbidden" });
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    // For Power Users (ADMIN/ORGANIZER), show all alerts in the room.
    // For normal users, only show EVERYONE alerts, their role-specific alerts,
    // OR messages they sent themselves.
    const where = req.auth.roleType === "ADMIN" || req.auth.roleType === "ORGANIZER"
        ? { roomId }
        : {
            roomId,
            OR: [
                { isPanic: true },
                { targetType: prisma_2.AlertTargetType.EVERYONE },
                { AND: [{ targetType: prisma_2.AlertTargetType.ROLE }, { targetRole: req.auth.roleType }] },
                { createdByRole: req.auth.roleType }, // Users should see what they send
            ],
        };
    const alerts = await prisma_1.prisma.alert.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const nextCursor = alerts.length === limit ? alerts[alerts.length - 1]?.id : undefined;
    return res.json({
        alerts: alerts.map((a) => ({
            id: a.id,
            createdAt: a.createdAt,
            message: a.message,
            isPanic: a.isPanic,
            createdByRole: a.createdByRole,
            targetType: a.targetType,
            targetRole: a.targetRole,
        })),
        nextCursor,
    });
});
