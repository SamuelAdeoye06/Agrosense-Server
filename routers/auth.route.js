const express = require("express")
const router = express.Router()
const { register, login, createAdmin, getAllFarmers, getAllAdmins, deleteFarmer, deleteAdmin, deleteSelf,  toggleFarmerStatus, toggleAdminStatus, uploadAvatar, changePassword} = require("../controllers/auth.controller")
const { protect, superAdminOnly, adminOnly } = require("../middleware/auth.middleware")

router.post("/register", register)
router.post("/login", login)
router.post("/admin/register", protect, superAdminOnly, createAdmin)
router.get("/admin/farmers", protect, adminOnly, getAllFarmers) 
router.get("/admin/admins", protect, superAdminOnly, getAllAdmins)
router.delete("/me", protect, deleteSelf)
router.delete("/farmers/:id", protect, deleteFarmer)
router.delete("/admin/:id", protect, superAdminOnly, deleteAdmin)
router.patch("/admin/farmers/:id/status", protect, adminOnly, toggleFarmerStatus)
router.patch("/admin/admins/:id/status", protect, superAdminOnly, toggleAdminStatus)
router.post("/upload-avatar",   protect, uploadAvatar)
router.patch("/change-password", protect, changePassword)


module.exports = router