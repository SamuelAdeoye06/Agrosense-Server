const axios       = require("axios")
const User        = require("../models/user.model")
const WeatherRule = require("../models/weatherRule.model")
const { evaluateDay, getWeatherIcon } = require("../utils/decisionEngine")

const OWM_KEY     = process.env.OPENWEATHER_API_KEY
const CACHE_HOURS = 3

// ── Is the cache still fresh? ──
const isCacheFresh = (fetchedAt) => {
    if (!fetchedAt) return false
    const ageHours = (Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60)
    return ageHours < CACHE_HOURS
}

// ── Geocode location string → { lat, lon } ──
const geocodeLocation = async (locationString) => {
    const response = await axios.get("http://api.openweathermap.org/geo/1.0/direct", {
        params: { q: locationString, limit: 1, appid: OWM_KEY }
    })
    if (!response.data || response.data.length === 0) {
        throw new Error(`Could not find location: "${locationString}". Please update your farm location in Settings.`)
    }
    const { lat, lon, name, country } = response.data[0]
    return { lat, lon, displayName: `${name}, ${country}` }
}

// ── Fetch 7-day forecast from OWM One Call API ──
const fetchForecast = async (lat, lon) => {
    const response = await axios.get("https://api.openweathermap.org/data/3.0/onecall", {
        params: {
            lat,
            lon,
            exclude: "minutely,hourly,alerts",
            units:   "metric",
            appid:   OWM_KEY
        }
    })
    return response.data
}

// ── Format one OWM daily entry into our shape ──
const formatDay = (dailyEntry, index) => {
    const windKmh      = Math.round((dailyEntry.wind_speed || 0) * 3.6)
    const rainPercent  = Math.round((dailyEntry.pop || 0) * 100)
    const date         = new Date(dailyEntry.dt * 1000)
    const dayNames     = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
    const shortNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    const dateString   = date.toISOString().split("T")[0]

    return {
        index,
        date:        dateString,
        dayLabel:    dayNames[date.getDay()],
        dayShort:    shortNames[date.getDay()],
        temp:        Math.round(dailyEntry.temp.day),
        tempMin:     Math.round(dailyEntry.temp.min),
        tempMax:     Math.round(dailyEntry.temp.max),
        humidity:    dailyEntry.humidity || 0,
        rain:        rainPercent,
        windSpeed:   windKmh,
        description: dailyEntry.weather?.[0]?.description || "",
        weatherId:   dailyEntry.weather?.[0]?.id || 800,
        icon:        getWeatherIcon(dailyEntry.weather?.[0]?.id)
    }
}

// ── Format current weather ──
// We merge current conditions (actual temp, humidity, wind right now)
// with today's daily rain probability since current has no pop field
const formatCurrent = (currentEntry, todayDaily) => {
    const windKmh = Math.round((currentEntry.wind_speed || 0) * 3.6)
    return {
        temp:        Math.round(currentEntry.temp),
        feelsLike:   Math.round(currentEntry.feels_like),
        humidity:    currentEntry.humidity || 0,
        windSpeed:   windKmh,
        // use today's daily pop for rain probability — current has none
        rain:        Math.round((todayDaily?.pop || 0) * 100),
        description: currentEntry.weather?.[0]?.description || "",
        weatherId:   currentEntry.weather?.[0]?.id || 800,
        icon:        getWeatherIcon(currentEntry.weather?.[0]?.id)
    }
}


// ── Get or create platform rules ──
const getOrCreateRules = async () => {
    let rules = await WeatherRule.findOne({ documentId: "platform_rules" })
    if (!rules) {
        rules = await WeatherRule.create({ documentId: "platform_rules" })
    }
    return rules
}


// ═══════════════════════════════════════════════
// GET /api/weather/forecast
// ═══════════════════════════════════════════════
const getForecast = async (req, res) => {
    try {
        const farmer = await User.findById(req.user._id)

        if (!farmer.farmLocation) {
            return res.status(400).json({
                message: "No farm location set. Please update your location in Settings."
            })
        }

        const cache = farmer.weatherCache
        const rules = await getOrCreateRules()
        const crops = farmer.cropProfiles || []

        // serve from cache if still fresh
        if (isCacheFresh(cache?.fetchedAt) && cache?.forecast && cache?.current) {
            const forecastWithDecisions = cache.forecast.map((day) =>
                ({ ...day, ...evaluateDay(day, rules, crops) })
            )
            // use forecast[0] (today's daily) for decisions — current has no rain probability
            const todayDecision = evaluateDay(cache.forecast[0], rules, crops)

            return res.status(200).json({
                message:   "Weather data retrieved (cached)",
                cached:    true,
                location:  farmer.farmLocation,
                current:   { ...cache.current, ...todayDecision },
                forecast:  forecastWithDecisions,
                fetchedAt: cache.fetchedAt
            })
        }

        // cache stale — fetch fresh
        let lat = cache?.lat
        let lon = cache?.lon

        if (!lat || !lon) {
            const geo = await geocodeLocation(farmer.farmLocation)
            lat = geo.lat
            lon = geo.lon
        }

        const owmData          = await fetchForecast(lat, lon)
        const formattedForecast = owmData.daily.slice(0, 7).map((day, i) => formatDay(day, i))
        const formattedCurrent  = formatCurrent(owmData.current, owmData.daily[0])

        // save to cache
        await User.findByIdAndUpdate(farmer._id, {
            weatherCache: {
                fetchedAt: new Date(),
                lat,
                lon,    
                forecast: formattedForecast,
                current:  formattedCurrent
            }
        })

        const forecastWithDecisions = formattedForecast.map((day) =>
            ({ ...day, ...evaluateDay(day, rules, crops) })
        )
        const todayDecision = evaluateDay(formattedCurrent, rules, crops)

        return res.status(200).json({
            message:   "Weather data retrieved (fresh)",
            cached:    false,
            location:  farmer.farmLocation,
            current:   { ...formattedCurrent, ...todayDecision },
            forecast:  forecastWithDecisions,
            fetchedAt: new Date()
        })

    } catch (error) {
        console.error("Get forecast error:", error.message)
        if (error.message.includes("Could not find location")) {
            return res.status(400).json({ message: error.message })
        }
        res.status(500).json({ message: "Server error fetching weather data" })
    }
}


// ═══════════════════════════════════════════════
// POST /api/weather/refresh
// ═══════════════════════════════════════════════
const refreshForecast = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            "weatherCache.fetchedAt": null,
            "weatherCache.lat":       null,
            "weatherCache.lon":       null,
            "weatherCache.forecast":  null,
            "weatherCache.current":   null
        })
        res.status(200).json({ message: "Weather cache cleared. Reload to fetch fresh data." })
    } catch (error) {
        console.error("Refresh forecast error:", error.message)
        res.status(500).json({ message: "Server error refreshing weather" })
    }
}


// ═══════════════════════════════════════════════
// GET /api/weather/today-alert
// ═══════════════════════════════════════════════
const getTodayAlert = async (req, res) => {
    try {
        const farmer = await User.findById(req.user._id)
        const cache  = farmer.weatherCache

        if (!cache?.forecast?.[0]) {
            return res.status(200).json({ alert: null, message: "No weather data yet" })
        }

        const rules    = await getOrCreateRules()
        const crops    = farmer.cropProfiles || []
        const decision = evaluateDay(cache.forecast[0], rules, crops)

        res.status(200).json({
            alert:     decision.alert,
            isGoodDay: decision.isGoodDay,
            label:     decision.label,
            cropTips:  decision.categoryTips
        })

    } catch (error) {
        console.error("Get today alert error:", error.message)
        res.status(500).json({ message: "Server error fetching alert" })
    }
}


module.exports = { getForecast, refreshForecast, getTodayAlert }