const express = require("express")
const router  = express.Router()

const {register, login, createAdmin,getAllFarmers, getAllAdmins,deleteFarmer, deleteAdmin, deleteSelf,toggleFarmerStatus, toggleAdminStatus,uploadAvatar, changePassword, updateProfile,sendOTP, verifyOTPAndDelete,forgotPassword, verifyForgotPasswordOTP, resetPassword
} = require("../controllers/auth.controller")

const { protect, superAdminOnly, adminOnly } = require("../middleware/auth.middleware")

// ── Public ──
router.post("/register",                register)
router.post("/login",                   login)
router.post('/forgot-password',         forgotPassword)
router.post('/verify-forgot-password',  verifyForgotPasswordOTP)
router.post('/reset-password',          resetPassword)

// ── Farmer ──
router.delete("/me",                    protect, deleteSelf)
router.post("/upload-avatar",           protect, uploadAvatar)
router.patch("/change-password",        protect, changePassword)
router.patch("/update-profile",         protect, updateProfile)
router.post('/send-otp',                protect, sendOTP)
router.post('/verify-otp',             protect, verifyOTPAndDelete)

// ── Admin ──
router.post("/admin/register",          protect, superAdminOnly, createAdmin)
router.get("/admin/farmers",            protect, adminOnly, getAllFarmers)
router.get("/admin/admins",             protect, superAdminOnly, getAllAdmins)
router.delete("/farmers/:id",           protect, deleteFarmer)
router.delete("/admin/:id",             protect, superAdminOnly, deleteAdmin)
router.patch("/admin/farmers/:id/status", protect, adminOnly, toggleFarmerStatus)
router.patch("/admin/admins/:id/status",  protect, superAdminOnly, toggleAdminStatus)

module.exports = router