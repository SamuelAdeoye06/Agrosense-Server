const express            = require("express")
const cors               = require("cors")
const helmet             = require("helmet")
const authRoutes         = require("./routers/auth.route")
const weatherRoutes      = require("./routers/weather.route")
const savedDatesRoutes   = require("./routers/savedDates.route")
const weatherRulesRoutes = require("./routers/weatherRules.route")

const app = express()

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL  // your Vercel frontend URL
].filter(Boolean)

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    credentials: true
}))

app.use(helmet())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

app.use("/api/auth",          authRoutes)
app.use("/api/weather",       weatherRoutes)
app.use("/api/saved-dates",   savedDatesRoutes)
app.use("/api/weather-rules", weatherRulesRoutes)

module.exports = app