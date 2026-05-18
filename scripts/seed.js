// scripts/seed.js
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") })
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const User = require("../models/user.model")

const seedSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("MongoDB connected")

        const existing = await User.findOne({ role: "super_admin" })
        if (existing) {
            console.log("Super admin already exists — skipping")
            process.exit(0)
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash("SuperAdmin@2026", salt)

        await User.create({
            fullName: "Super Admin",
            email: "superadmin.agrosense@gmail.com",
            password: hashedPassword,
            farmLocation: "AgroSense HQ",
            role: "super_admin",
            status: "active"
        })

        console.log("✅ Super admin created successfully")
        console.log("Email: superadmin.agrosense@gmail.com")
        console.log("Password: SuperAdmin@2026")
        process.exit(0)

    } catch (error) {
        console.error("Seed failed:", error.message)
        process.exit(1)
    }
}

seedSuperAdmin()