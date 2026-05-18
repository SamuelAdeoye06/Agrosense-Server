const express         = require("express")
const cors            = require("cors")
const authRoutes      = require("./routers/auth.route")
const weatherRoutes   = require("./routers/weather.route")
const savedDatesRoutes = require("./routers/savedDates.route")
const weatherRulesRoutes = require("./routers/weatherRules.route")

const app = express()

app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

app.use("/api/auth",           authRoutes)
app.use("/api/weather",        weatherRoutes)
app.use("/api/saved-dates",    savedDatesRoutes)
app.use("/api/weather-rules",  weatherRulesRoutes)

module.exports = app