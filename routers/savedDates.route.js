const express = require("express")
const router  = express.Router()
const {
    saveDate,
    getSavedDates,
    deleteDate,
    updateNote,
    getTotalSavedDatesCount
} = require("../controllers/savedDates.controller")
const { protect, adminOnly } = require("../middleware/auth.middleware")

// farmer routes
router.post("/",                protect, saveDate)
router.get("/",                 protect, getSavedDates)
router.delete("/:id",          protect, deleteDate)
router.patch("/:id/note",      protect, updateNote)

// admin route — total count + per-farmer breakdown
router.get("/admin/count",     protect, adminOnly, getTotalSavedDatesCount)

module.exports = router