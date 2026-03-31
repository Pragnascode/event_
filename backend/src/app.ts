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
      
      // If no origins configured, allow all (permissive default)
      if (allowed.length === 0) return callback(null, true);
      
      // Allow if origin matches one of the allowed origins
      if (allowed.includes(origin)) return callback(null, true);
      
      // Also allow if origin is a sub-domain of netlify.app (common for these projects)
      if (origin.endsWith(".netlify.app")) return callback(null, true);

      return callback(null, false);
    },
    credentials: true,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Mount router at both /api and root to handle different deployment environments (server vs serverless)
const router = createRouter();
app.use("/api", router);
app.use("/", router);

export { app };
