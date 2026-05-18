const express = require("express")
const router  = express.Router()
const {
    getForecast,
    refreshForecast,
    getTodayAlert
} = require("../controllers/weather.controller")
const { protect } = require("../middleware/auth.middleware")

// all weather routes require a logged-in farmer
router.get("/forecast",     protect, getForecast)
router.post("/refresh",     protect, refreshForecast)
router.get("/today-alert",  protect, getTodayAlert)

module.exports = router