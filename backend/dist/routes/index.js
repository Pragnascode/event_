"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
const express_1 = require("express");
const rooms_1 = require("./rooms");
const alerts_1 = require("./alerts");
const participants_1 = require("./participants");
const admin_1 = require("./admin");
function createRouter() {
    const router = (0, express_1.Router)();
    router.use("/rooms", rooms_1.roomsRouter);
    router.use("/rooms", participants_1.participantsRouter);
    router.use("/rooms", alerts_1.alertsRouter);
    router.use("/admin", admin_1.adminRouter);
    return router;
}
