import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { createRouter } from "./routes";
import { env } from "./utils/env";

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = (env.CLIENT_ORIGIN ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowed.length === 0) return callback(null, true);
      return allowed.includes(origin) ? callback(null, true) : callback(null, false);
    },
    credentials: true,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", createRouter());

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

setInterval(() => {
  // console.log("Still alive");
}, 10000);

process.on("exit", (code) => {
  console.log(`Process exit with code: ${code}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

