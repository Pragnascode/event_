"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const routes_1 = require("./routes");
const env_1 = require("./utils/env");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json({ limit: "1mb" }));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        const allowed = (env_1.env.CLIENT_ORIGIN ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (allowed.length === 0)
            return callback(null, true);
        return allowed.includes(origin) ? callback(null, true) : callback(null, false);
    },
    credentials: true,
}));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", (0, routes_1.createRouter)());
app.listen(env_1.env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${env_1.env.PORT}`);
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
