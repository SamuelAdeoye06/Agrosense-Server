const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    farmLocation: {
        type: String,
        required: function () { return this.role === "farmer" },
        default: ""
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        enum: ["farmer", "admin", "super_admin"],
        default: "farmer"
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },

    // ── Avatar ──
    avatarUrl:      { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },

    // ── Crop Categories (farmer only) ──
    // Farmer selects which categories apply to their farm.
    // Each category groups crops that share the same weather
    // behaviour — so advice covers all varieties within the group.
    // A farmer can select multiple categories (e.g. grains + vegetables).
    cropProfiles: {
        type: [String],
        enum: [
            "grains",      // maize, rice, sorghum, millet, wheat, fonio
            "tubers",      // cassava, yam, cocoyam, sweet potato
            "legumes",     // beans, cowpea, soybeans, groundnut, sesame
            "vegetables",  // tomatoes, peppers, okra, onions, cucumber, carrot
            "plantains",   // plantain, banana
            "fruits",      // mango, citrus, pawpaw, pineapple, watermelon
            "cash_crops",  // cocoa, oil palm, rubber, cotton, sugarcane, ginger
            "herbs"        // turmeric, garlic, basil, scent leaf
        ],
        default: []
    },

    // ── Weather Cache (farmer only) ──
    // Stores the last fetched forecast so we don't call
    // OpenWeatherMap on every page load.
    // Refreshed automatically when older than 3 hours.
    weatherCache: {
        fetchedAt: { type: Date,   default: null },
        lat:       { type: Number, default: null },
        lon:       { type: Number, default: null },
        forecast: {
            type:    mongoose.Schema.Types.Mixed,
            default: null
        },
        current: {
            type:    mongoose.Schema.Types.Mixed,
            default: null
        }
    },
    otp:       { type: String,  default: null },
    otpExpiry: { type: Date,    default: null },
    otpAttempts: { type: Number, default: 0 },
}, {
    timestamps: true,
    strict: true
})

const UserModel = mongoose.model("user", UserSchema)
module.exports = UserModel