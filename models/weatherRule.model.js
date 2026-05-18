const mongoose = require("mongoose")

// There is only ever ONE active rules document for the whole platform.
// Admins update it; all farmers are evaluated against the same thresholds.
// We use a singleton pattern — upsert on a fixed documentId.

const WeatherRuleSchema = new mongoose.Schema({

    // fixed identifier so we always upsert the same doc
    documentId: {
        type: String,
        default: "platform_rules",
        unique: true
    },

    // ── Thresholds ──
    // These are the values admins control via the sliders

    // minimum rain probability % for a "good" day
    minRain: {
        type: Number,
        default: 40,
        min: 0,
        max: 100
    },

    // minimum humidity % for a "good" day
    minHumidity: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
    },

    // maximum wind speed km/h — above this is bad for most farming
    maxWind: {
        type: Number,
        default: 25,
        min: 0,
        max: 120
    },

    // temperature range for good farming
    minTemp: {
        type: Number,
        default: 18,
        min: 0,
        max: 50
    },
    maxTemp: {
        type: Number,
        default: 35,
        min: 0,
        max: 50
    },

    // ── Alert thresholds ──
    // These trigger the warning card on the farmer dashboard
    // separately from the good/poor day logic

    // rain above this % triggers a flood/heavy rain alert
    alertRainThreshold: {
        type: Number,
        default: 85,
        min: 0,
        max: 100
    },

    // wind above this km/h triggers a high wind alert
    alertWindThreshold: {
        type: Number,
        default: 40,
        min: 0,
        max: 120
    },

    // temp above this triggers an extreme heat alert
    alertTempHighThreshold: {
        type: Number,
        default: 38,
        min: 0,
        max: 50
    },

    // who last updated the rules and when
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null
    },
    lastUpdatedAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
})

const WeatherRule = mongoose.model("weatherRule", WeatherRuleSchema)
module.exports = WeatherRule