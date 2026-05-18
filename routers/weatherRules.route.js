const express = require("express")
const router  = express.Router()
const {
    getRules,
    saveRules,
    resetRules
} = require("../controllers/weatherRules.controller")
const { protect, adminOnly, superAdminOnly } = require("../middleware/auth.middleware")

// any logged-in user can read the rules
// (farmer dashboard needs them via the decision engine)
router.get("/",        protect, getRules)

// only admins can save rules
router.put("/",        protect, adminOnly, saveRules)

// only super admin can reset to defaults
router.post("/reset",  protect, superAdminOnly, resetRules)

module.exports = router