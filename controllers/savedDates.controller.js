const SavedDate  = require("../models/savedDate.model")
const User       = require("../models/user.model")

// ═══════════════════════════════════════════════
// POST /api/saved-dates
// Farmer saves a good farming day
// ═══════════════════════════════════════════════
const saveDate = async (req, res) => {
    try {
        const farmerId = req.user._id
        const {
            date,
            dayLabel,
            note,
            cropName,
            weatherSnapshot,
            recommendation,
            isGoodDay
        } = req.body

        // basic validation
        if (!date || !dayLabel) {
            return res.status(400).json({ message: "Date and day label are required" })
        }

        // check if this farmer already saved this exact date
        const existing = await SavedDate.findOne({ farmerId, date })
        if (existing) {
            return res.status(400).json({ message: "You have already saved this date" })
        }

        const saved = await SavedDate.create({
            farmerId,
            date,
            dayLabel,
            note:            note || "",
            cropName:        cropName || "",
            weatherSnapshot: weatherSnapshot || {},
            recommendation:  recommendation || "",
            isGoodDay:       isGoodDay || false
        })

        res.status(201).json({
            message:   "Date saved successfully",
            savedDate: saved
        })

    } catch (error) {
        // handle the duplicate key error from MongoDB index as well
        if (error.code === 11000) {
            return res.status(400).json({ message: "You have already saved this date" })
        }
        console.error("Save date error:", error.message)
        res.status(500).json({ message: "Server error saving date" })
    }
}


// ═══════════════════════════════════════════════
// GET /api/saved-dates
// Farmer fetches all their saved dates
// ═══════════════════════════════════════════════
const getSavedDates = async (req, res) => {
    try {
        const farmerId = req.user._id

        const dates = await SavedDate
            .find({ farmerId })
            .sort({ date: 1 })   // chronological order

        res.status(200).json({
            message: "Saved dates retrieved successfully",
            count:   dates.length,
            dates
        })

    } catch (error) {
        console.error("Get saved dates error:", error.message)
        res.status(500).json({ message: "Server error fetching saved dates" })
    }
}


// ═══════════════════════════════════════════════
// DELETE /api/saved-dates/:id
// Farmer deletes one of their saved dates
// ═══════════════════════════════════════════════
const deleteDate = async (req, res) => {
    try {
        const farmerId = req.user._id
        const { id }   = req.params

        const saved = await SavedDate.findById(id)

        if (!saved) {
            return res.status(404).json({ message: "Saved date not found" })
        }

        // make sure the farmer can only delete their own dates
        if (saved.farmerId.toString() !== farmerId.toString()) {
            return res.status(403).json({ message: "Not authorised to delete this date" })
        }

        await SavedDate.findByIdAndDelete(id)

        res.status(200).json({ message: "Date deleted successfully" })

    } catch (error) {
        console.error("Delete date error:", error.message)
        res.status(500).json({ message: "Server error deleting date" })
    }
}


// ═══════════════════════════════════════════════
// PATCH /api/saved-dates/:id/note
// Farmer updates the note on a saved date
// ═══════════════════════════════════════════════
const updateNote = async (req, res) => {
    try {
        const farmerId  = req.user._id
        const { id }    = req.params
        const { note }  = req.body

        if (note === undefined) {
            return res.status(400).json({ message: "Note field is required" })
        }

        const saved = await SavedDate.findById(id)

        if (!saved) {
            return res.status(404).json({ message: "Saved date not found" })
        }

        if (saved.farmerId.toString() !== farmerId.toString()) {
            return res.status(403).json({ message: "Not authorised to update this date" })
        }

        saved.note = note
        await saved.save()

        res.status(200).json({
            message:   "Note updated successfully",
            savedDate: saved
        })

    } catch (error) {
        console.error("Update note error:", error.message)
        res.status(500).json({ message: "Server error updating note" })
    }
}


// ═══════════════════════════════════════════════
// GET /api/saved-dates/admin/count
// Admin fetches total saved dates count across
// all farmers — for the admin dashboard stat card
// ═══════════════════════════════════════════════
const getTotalSavedDatesCount = async (req, res) => {
    try {
        const total = await SavedDate.countDocuments()

        // also get per-farmer counts so the admin farmer
        // table can show each farmer's saved date count
        const perFarmer = await SavedDate.aggregate([
            {
                $group: {
                    _id:   "$farmerId",
                    count: { $sum: 1 }
                }
            }
        ])

        // convert to a simple { farmerId: count } map
        const farmerCountMap = {}
        perFarmer.forEach((entry) => {
            farmerCountMap[entry._id.toString()] = entry.count
        })

        res.status(200).json({
            message:        "Saved dates count retrieved",
            total,
            farmerCountMap
        })

    } catch (error) {
        console.error("Get total saved dates error:", error.message)
        res.status(500).json({ message: "Server error fetching saved dates count" })
    }
}


module.exports = {
    saveDate,
    getSavedDates,
    deleteDate,
    updateNote,
    getTotalSavedDatesCount
}