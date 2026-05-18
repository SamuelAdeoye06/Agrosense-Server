const jwt = require("jsonwebtoken")
const User = require("../models/user.model")

const protect = async (req, res, next) => {
    try {
        // get token from header
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "No token provided, access denied" })
        }

        const token = authHeader.split(" ")[1]

        // verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // attach user to request (without password)
        req.user = await User.findById(decoded.id).select("-password")
        if (!req.user) {
            return res.status(401).json({ message: "User no longer exists" })
        }

        next()

    } catch (error) {
        console.error("Auth middleware error:", error.message)
        res.status(401).json({ message: "Token invalid or expired" })
    }
}

// for admin-only routes
const adminOnly = (req, res, next) => {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Admins only." })
    }
    next()
}

// for super admin only routes
const superAdminOnly = (req, res, next) => {
    if (req.user.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super Admin only." })
    }
    next()
}

module.exports = { protect, adminOnly, superAdminOnly }