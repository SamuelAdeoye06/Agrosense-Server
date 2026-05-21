const WeatherRule = require("../models/weatherRule.model")
const User        = require('../models/user.model')
const sendMail    = require('../utils/sendMail')

const getOrCreateRules = async () => {
    let rules = await WeatherRule.findOne({ documentId: "platform_rules" })
    if (!rules) rules = await WeatherRule.create({ documentId: "platform_rules" })
    return rules
}

const validateRules = (data) => {
    const errors = []
    const { planting, harvesting, spraying, irrigation, weeding, tillage, fertilizing, pruning } = data

    if (!weeding || !tillage || !fertilizing || !pruning) {
        errors.push("All 8 activity threshold groups must be defined.")
        return errors
    }

    if (planting.minTemp >= planting.maxTemp)
        errors.push("Planting: minimum temperature must be lower than maximum.")
    if (harvesting.minTemp >= harvesting.maxTemp)
        errors.push("Harvesting: minimum temperature must be lower than maximum.")
    if (weeding.minTemp >= weeding.maxTemp)
        errors.push("Weeding: minimum temperature must be lower than maximum.")
    if (tillage.minTemp >= tillage.maxTemp)
        errors.push("Tillage: minimum temperature must be lower than maximum.")
    if (fertilizing.minTemp >= fertilizing.maxTemp)
        errors.push("Fertilizing: minimum temperature must be lower than maximum.")
    if (pruning.minTemp >= pruning.maxTemp)
        errors.push("Pruning: minimum temperature must be lower than maximum.")

    if (planting.minRain >= planting.maxRain)
        errors.push("Planting: minimum rain chance must be lower than maximum.")
    if (weeding.minRain >= weeding.maxRain)
        errors.push("Weeding: minimum rain chance must be lower than maximum.")
    if (tillage.minRain >= tillage.maxRain)
        errors.push("Tillage: minimum rain chance must be lower than maximum.")
    if (fertilizing.minRain >= fertilizing.maxRain)
        errors.push("Fertilizing: minimum rain chance must be lower than maximum.")
    if (pruning.minRain >= pruning.maxRain)
        errors.push("Pruning: minimum rain chance must be lower than maximum.")

    if (planting.maxRain > 60)
        errors.push("Planting: maximum rain above 60% probability means heavy rain or waterlogging risk — this is agronomically unsafe for sowing.")
    if (planting.minRain > 70)
        errors.push("Planting rain threshold above 70% is too restrictive for Nigerian conditions.")
    if (spraying.maxRain > 30)
        errors.push("Spraying: maximum rain above 30% means chemicals will wash away — this is agronomically unsafe.")
    if (spraying.maxWind > 25)
        errors.push("Spraying: wind above 25 km/h causes dangerous chemical drift onto neighbouring farms.")
    if (harvesting.maxRain > 40)
        errors.push("Harvesting: maximum rain above 40% means produce will be harvested wet — this increases post-harvest losses.")

    if (weeding.maxRain > 40)
        errors.push("Weeding: maximum rain above 40% makes soil too muddy and causes weeds to re-root.")
    if (fertilizing.maxRain > 40)
        errors.push("Fertilizing: maximum rain above 40% washes fertilizer granules away into watercourses.")
    if (pruning.maxRain > 25)
        errors.push("Pruning: maximum rain above 25% keeps stems wet and promotes fatal fungal infections in cut wounds.")

    return errors
}

// GET /api/weather-rules
const getRules = async (req, res) => {
    try {
        const rules = await getOrCreateRules()
        res.status(200).json({ message: "Weather rules retrieved successfully", rules })
    } catch (error) {
        console.error("Get rules error:", error.message)
        res.status(500).json({ message: "Server error fetching weather rules" })
    }
}

// PUT /api/weather-rules
const saveRules = async (req, res) => {
    try {
        const { planting, harvesting, spraying, irrigation, weeding, tillage, fertilizing, pruning, alertRainThreshold, alertWindThreshold, alertTempHighThreshold } = req.body

        if (!planting || !harvesting || !spraying || !irrigation || !weeding || !tillage || !fertilizing || !pruning) {
            return res.status(400).json({ message: "All 8 activity threshold groups are required." })
        }

        const errors = validateRules(req.body)
        if (errors.length > 0) {
            return res.status(400).json({ message: "Rule conflict detected.", errors })
        }

        const updated = await WeatherRule.findOneAndUpdate(
            { documentId: "platform_rules" },
            {
                planting, harvesting, spraying, irrigation, weeding, tillage, fertilizing, pruning,
                alertRainThreshold, alertWindThreshold, alertTempHighThreshold,
                lastUpdatedBy: req.user._id,
                lastUpdatedAt: new Date()
            },
            { new: true, upsert: true }
        )

        res.status(200).json({ message: "Weather rules saved successfully", rules: updated })

        // ── notify all admins of the rule change ──
        const updatedAt = new Date().toLocaleString("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Lagos"
        })

        const updater   = await User.findById(req.user._id)
        const allAdmins = await User.find({
            role: { $in: ["admin", "super_admin"] },
            status: "active"
        })

        await Promise.all(
            allAdmins.map((admin) =>
                sendMail({
                    to: admin.email,
                    subject: "Weather Rules Updated — AgroSense",
                    template: "rules-updated.ejs",
                    data: {
                        name:                  admin.fullName,
                        updatedBy:             updater.fullName,
                        updatedAt,
                        planting,
                        harvesting,
                        spraying,
                        irrigation,
                        alertRainThreshold,
                        alertWindThreshold,
                        alertTempHighThreshold
                    }
                })
            )
        )

    } catch (error) {
        console.error("Save rules error:", error.message)
        res.status(500).json({ message: "Server error saving weather rules" })
    }
}

// POST /api/weather-rules/reset
const resetRules = async (req, res) => {
    try {
        const reset = await WeatherRule.findOneAndUpdate(
            { documentId: "platform_rules" },
            {
                planting:   { minRain: 40, maxRain: 50, minHumidity: 50, maxWind: 25, minTemp: 18, maxTemp: 35 },
                harvesting: { maxRain: 20, maxWind: 20, minTemp: 18, maxTemp: 38 },
                spraying:   { maxRain: 10, maxWind: 20, maxTemp: 35 },
                irrigation: { maxRain: 30, minTemp: 28 },
                weeding:    { minRain: 0,  maxRain: 30, minHumidity: 30, maxWind: 35, minTemp: 15, maxTemp: 35 },
                tillage:    { minRain: 10, maxRain: 40, minHumidity: 30, maxWind: 40, minTemp: 15, maxTemp: 36 },
                fertilizing:{ minRain: 5,  maxRain: 30, minHumidity: 30, maxWind: 20, minTemp: 15, maxTemp: 35 },
                pruning:    { minRain: 0,  maxRain: 15, minHumidity: 0,  maxWind: 30, minTemp: 15, maxTemp: 36 },
                alertRainThreshold: 85, alertWindThreshold: 40, alertTempHighThreshold: 38,
                lastUpdatedBy: req.user._id,
                lastUpdatedAt: new Date()
            },
            { new: true, upsert: true }
        )
        res.status(200).json({ message: "Rules reset to defaults successfully", rules: reset })
    } catch (error) {
        console.error("Reset rules error:", error.message)
        res.status(500).json({ message: "Server error resetting rules" })
    }
}

module.exports = { getRules, saveRules, resetRules }