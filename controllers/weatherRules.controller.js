const WeatherRule = require("../models/weatherRule.model")

// ── Internal helper ──
const getOrCreateRules = async () => {
    let rules = await WeatherRule.findOne({ documentId: "platform_rules" })
    if (!rules) {
        rules = await WeatherRule.create({ documentId: "platform_rules" })
    }
    return rules
}

// ── Conflict + agronomic validation ──
const validateRules = (data) => {
    const errors = []
    const {
        minRain, minHumidity, maxWind, minTemp, maxTemp,
        alertRainThreshold, alertWindThreshold, alertTempHighThreshold
    } = data

    if (minTemp >= maxTemp)
        errors.push("Minimum temperature must be lower than maximum temperature.")

    if (alertRainThreshold <= minRain)
        errors.push("Alert rain threshold must be higher than minimum rain — alerts should only fire in extreme conditions.")

    if (alertWindThreshold <= maxWind)
        errors.push("Alert wind threshold must be higher than maximum wind — alerts should only fire in extreme conditions.")

    if (alertTempHighThreshold <= maxTemp)
        errors.push("Alert temperature threshold must be higher than maximum temperature — alerts should only fire in extreme heat.")

    if (minRain > 70)
        errors.push("Minimum rain above 70% would mark almost every dry day as poor — too restrictive for Nigerian crops.")

    if (minHumidity > 85)
        errors.push("Minimum humidity above 85% would constantly trigger disease warnings — agronomically unrealistic.")

    if (maxWind < 5)
        errors.push("Maximum wind below 5 km/h is unrealistically strict — light breezes are harmless to all crops.")

    if (maxTemp < 25)
        errors.push("Maximum temperature below 25°C would mark most Nigerian days as too hot — does not reflect local climate.")

    if (minTemp > 20)
        errors.push("Minimum temperature above 20°C is too high for Nigerian harmattan conditions.")

    return errors
}


// ═══════════════════════════════════════════════
// GET /api/weather-rules
// Any logged-in user can read rules
// ═══════════════════════════════════════════════
const getRules = async (req, res) => {
    try {
        const rules = await getOrCreateRules()
        res.status(200).json({ message: "Weather rules retrieved successfully", rules })
    } catch (error) {
        console.error("Get rules error:", error.message)
        res.status(500).json({ message: "Server error fetching weather rules" })
    }
}


// ═══════════════════════════════════════════════
// PUT /api/weather-rules
// Admin saves updated thresholds
// ═══════════════════════════════════════════════
const saveRules = async (req, res) => {
    try {
        const {
            minRain, minHumidity, maxWind, minTemp, maxTemp,
            alertRainThreshold, alertWindThreshold, alertTempHighThreshold
        } = req.body

        const requiredFields = [
            "minRain", "minHumidity", "maxWind", "minTemp", "maxTemp",
            "alertRainThreshold", "alertWindThreshold", "alertTempHighThreshold"
        ]

        for (const field of requiredFields) {
            if (req.body[field] === undefined || req.body[field] === null) {
                return res.status(400).json({ message: `Missing required field: ${field}` })
            }
        }

        const errors = validateRules(req.body)
        if (errors.length > 0) {
            return res.status(400).json({
                message: "Rule conflict detected. Please review the following:",
                errors
            })
        }

        const updated = await WeatherRule.findOneAndUpdate(
            { documentId: "platform_rules" },
            {
                minRain, minHumidity, maxWind, minTemp, maxTemp,
                alertRainThreshold, alertWindThreshold, alertTempHighThreshold,
                lastUpdatedBy: req.user._id,
                lastUpdatedAt: new Date()
            },
            { new: true, upsert: true }
        )

        res.status(200).json({ message: "Weather rules saved successfully", rules: updated })

    } catch (error) {
        console.error("Save rules error:", error.message)
        res.status(500).json({ message: "Server error saving weather rules" })
    }
}


// ═══════════════════════════════════════════════
// POST /api/weather-rules/reset
// Super admin resets to safe defaults
// ═══════════════════════════════════════════════
const resetRules = async (req, res) => {
    try {
        const defaults = {
            minRain:                40,
            minHumidity:            50,
            maxWind:                25,
            minTemp:                18,
            maxTemp:                35,
            alertRainThreshold:     85,
            alertWindThreshold:     40,
            alertTempHighThreshold: 38,
            lastUpdatedBy:          req.user._id,
            lastUpdatedAt:          new Date()
        }

        const reset = await WeatherRule.findOneAndUpdate(
            { documentId: "platform_rules" },
            defaults,
            { new: true, upsert: true }
        )

        res.status(200).json({ message: "Weather rules reset to defaults successfully", rules: reset })

    } catch (error) {
        console.error("Reset rules error:", error.message)
        res.status(500).json({ message: "Server error resetting rules" })
    }
}


module.exports = { getRules, saveRules, resetRules }