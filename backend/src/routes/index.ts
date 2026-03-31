import { Router } from "express";
import { roomsRouter } from "./rooms";
import { alertsRouter } from "./alerts";
import { participantsRouter } from "./participants";
import { adminRouter } from "./admin";

export function createRouter() {
  const router = Router();
  router.use("/rooms", roomsRouter);
  router.use("/rooms", participantsRouter);
  router.use("/rooms", alertsRouter);
  router.use("/admin", adminRouter);
  return router;
}

