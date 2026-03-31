"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jwt_1 = require("./jwt");
function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing Bearer token" });
        }
        const token = header.slice("Bearer ".length);
        req.auth = (0, jwt_1.verifyJwt)(token);
        return next();
    }
    catch (_err) {
        return res.status(401).json({ error: "Invalid token" });
    }
}
