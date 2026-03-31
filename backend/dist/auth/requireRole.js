"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.auth)
            return res.status(401).json({ error: "Unauthorized" });
        if (!roles.includes(req.auth.roleType)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        return next();
    };
}
