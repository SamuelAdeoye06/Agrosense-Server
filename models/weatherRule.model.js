const mongoose = require("mongoose")

const WeatherRuleSchema = new mongoose.Schema({
    documentId: { type: String, default: "platform_rules", unique: true },

    // ── Planting thresholds ──
    planting: {
        minRain:     { type: Number, default: 40,  min: 0, max: 100 },
        maxRain:     { type: Number, default: 50,  min: 0, max: 100 },
        minHumidity: { type: Number, default: 50,  min: 0, max: 100 },
        maxWind:     { type: Number, default: 25,  min: 0, max: 120 },
        minTemp:     { type: Number, default: 18,  min: 0, max: 50  },
        maxTemp:     { type: Number, default: 35,  min: 0, max: 50  },
    },

    // ── Harvesting thresholds ──
    // Dry conditions — low rain, low wind so produce isn't damaged
    harvesting: {
        maxRain:     { type: Number, default: 20,  min: 0, max: 100 },
        maxWind:     { type: Number, default: 20,  min: 0, max: 120 },
        minTemp:     { type: Number, default: 18,  min: 0, max: 50  },
        maxTemp:     { type: Number, default: 38,  min: 0, max: 50  },
    },

    // ── Spraying thresholds (pesticides / fertilizer) ──
    // No rain (washes chemicals away), low wind (drift risk), not too hot
    spraying: {
        maxRain:     { type: Number, default: 10,  min: 0, max: 100 },
        maxWind:     { type: Number, default: 20,  min: 0, max: 120 },
        maxTemp:     { type: Number, default: 35,  min: 0, max: 50  },
    },

    // ── Irrigation thresholds ──
    // Only needed when it's hot and dry
    irrigation: {
        maxRain:     { type: Number, default: 30,  min: 0, max: 100 },
        minTemp:     { type: Number, default: 28,  min: 0, max: 50  },
    },

    // ── Weeding thresholds ──
    weeding: {
        minRain:     { type: Number, default: 0,   min: 0, max: 100 },
        maxRain:     { type: Number, default: 30,  min: 0, max: 100 },
        minHumidity: { type: Number, default: 30,  min: 0, max: 100 },
        maxWind:     { type: Number, default: 35,  min: 0, max: 120 },
        minTemp:     { type: Number, default: 15,  min: 0, max: 50  },
        maxTemp:     { type: Number, default: 35,  min: 0, max: 50  },
    },

    // ── Tillage / Land Prep thresholds ──
    tillage: {
        minRain:     { type: Number, default: 10,  min: 0, max: 100 },
        maxRain:     { type: Number, default: 40,  min: 0, max: 100 },
        minHumidity: { type: Number, default: 30,  min: 0, max: 100 },
        maxWind:     { type: Number, default: 40,  min: 0, max: 120 },
        minTemp:     { type: Number, default: 15,  min: 0, max: 50  },
        maxTemp:     { type: Number, default: 36,  min: 0, max: 50  },
    },

    // ── Fertilizing thresholds ──
    fertilizing: {
        minRain:     { type: Number, default: 5,   min: 0, max: 100 },
        maxRain:     { type: Number, default: 30,  min: 0, max: 100 },
        minHumidity: { type: Number, default: 30,  min: 0, max: 100 },
        maxWind:     { type: Number, default: 20,  min: 0, max: 120 },
        minTemp:     { type: Number, default: 15,  min: 0, max: 50  },
        maxTemp:     { type: Number, default: 35,  min: 0, max: 50  },
    },

    // ── Pruning thresholds ──
    pruning: {
        minRain:     { type: Number, default: 0,   min: 0, max: 100 },
        maxRain:     { type: Number, default: 15,  min: 0, max: 100 },
        minHumidity: { type: Number, default: 0,   min: 0, max: 100 },
        maxWind:     { type: Number, default: 30,  min: 0, max: 120 },
        minTemp:     { type: Number, default: 15,  min: 0, max: 50  },
        maxTemp:     { type: Number, default: 36,  min: 0, max: 50  },
    },

    // ── Alert thresholds (danger level — same for all activities) ──
    alertRainThreshold:     { type: Number, default: 85, min: 0,  max: 100 },
    alertWindThreshold:     { type: Number, default: 40, min: 0,  max: 120 },
    alertTempHighThreshold: { type: Number, default: 38, min: 0,  max: 50  },

    lastUpdatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    lastUpdatedAt:  { type: Date, default: null }

}, { timestamps: true })

const WeatherRule = mongoose.model("weatherRule", WeatherRuleSchema)
module.exports = WeatherRule