const mongoose = require("mongoose")

const SavedDateSchema = new mongoose.Schema({

    // which farmer saved this date
    farmerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true      // we query by farmerId a lot, so index it
    },

    // the actual calendar date being saved e.g. "2025-08-14"
    date: {
        type: String,
        required: true
    },

    // friendly display label e.g. "Monday", "Tuesday"
    // (the day name shown on the forecast card)
    dayLabel: {
        type: String,
        required: true
    },

    // optional note the farmer adds e.g. "Plant maize on north field"
    note: {
        type: String,
        default: ""
    },

    // crop the farmer plans to work on this day
    cropName: {
        type: String,
        default: ""
    },

    // snapshot of the weather on the day it was saved
    // we store this so historical records make sense even
    // after the live forecast data changes
    weatherSnapshot: {
        temp: Number,          // e.g. 28
        tempUnit: String,      // "°C"
        rain: Number,          // rain probability % e.g. 72
        humidity: Number,      // % e.g. 75
        windSpeed: Number,     // km/h e.g. 12
        icon: String,          // emoji e.g. "🌧"
        description: String    // e.g. "light rain"
    },

    // the decision engine's output for this day
    recommendation: {
        type: String,
        default: ""
    },

    // was it a good farming day when saved?
    isGoodDay: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true   // createdAt tells us when the farmer saved it
})

// prevent a farmer saving the exact same date twice
SavedDateSchema.index({ farmerId: 1, date: 1 }, { unique: true })

const SavedDate = mongoose.model("savedDate", SavedDateSchema)
module.exports = SavedDate