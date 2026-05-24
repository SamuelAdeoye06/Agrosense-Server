const axios       = require("axios")
const User        = require("../models/user.model")
const WeatherRule = require("../models/weatherRule.model")
const { evaluateDay, getWeatherIcon } = require("../utils/decisionEngine")
const sendMail = require('../utils/sendMail')

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
        params: { q: locationString, limit: 1, appid: OWM_KEY },
        timeout: 8000 
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
            exclude: "minutely,alerts",
            units:   "metric",
            appid:   OWM_KEY
        },
        timeout: 8000 
    })
    return response.data
}

// ── Helper to analyze timing of rain, wind, and temp anomalies from OWM hourly forecasts ──
const analyzeHourlyTiming = (hourlyEntries, dateString, rules) => {
    if (!hourlyEntries || hourlyEntries.length === 0) return { rain: 'none', wind: 'none', temp: 'none' }

    // Filter hourly entries that match this day's date string (e.g. '2026-05-21') in Nigeria timezone (UTC+1)
    const dailyHours = hourlyEntries.filter(hour => {
        const nigeriaDate = new Date((hour.dt + 3600) * 1000) // shift by 1 hour
        const ymd = nigeriaDate.toISOString().split("T")[0]
        return ymd === dateString
    })

    if (dailyHours.length === 0) return { rain: 'none', wind: 'none', temp: 'none' }

    // We split into Daytime (06:00 to 18:00 Nigeria Time) and Nighttime (18:00 to 06:00 Nigeria Time)
    let daytimeRainProbSum = 0, daytimeHoursCount = 0
    let nighttimeRainProbSum = 0, nighttimeHoursCount = 0

    let daytimeWindMax = 0, nighttimeWindMax = 0
    let daytimeTempMax = 0, nighttimeTempMax = 0

    dailyHours.forEach(hour => {
        const nigeriaDate = new Date((hour.dt + 3600) * 1000)
        const hourOfDay = nigeriaDate.getUTCHours()

        const pop = hour.pop || 0
        const windKmh = Math.round((hour.wind_speed || 0) * 3.6)
        const temp = hour.temp || 0

        if (hourOfDay >= 6 && hourOfDay < 18) {
            daytimeRainProbSum += pop
            daytimeHoursCount++
            if (windKmh > daytimeWindMax) daytimeWindMax = windKmh
            if (temp > daytimeTempMax) daytimeTempMax = temp
        } else {
            nighttimeRainProbSum += pop
            nighttimeHoursCount++
            if (windKmh > nighttimeWindMax) nighttimeWindMax = windKmh
            if (temp > nighttimeTempMax) nighttimeTempMax = temp
        }
    })

    const avgDaytimePop = daytimeHoursCount > 0 ? (daytimeRainProbSum / daytimeHoursCount) : 0
    const avgNighttimePop = nighttimeHoursCount > 0 ? (nighttimeRainProbSum / nighttimeHoursCount) : 0

    // ── 1. Rain Timing ──
    let rain = 'none'
    if (avgDaytimePop >= 0.2 || avgNighttimePop >= 0.2) {
        if (avgNighttimePop >= 0.45 && avgDaytimePop < 0.3) {
            rain = 'night'
        } else if (avgDaytimePop >= 0.45 && avgNighttimePop < 0.3) {
            // Check morning vs afternoon
            let morningRainSum = 0, morningCount = 0
            let afternoonRainSum = 0, afternoonCount = 0
            dailyHours.forEach(hour => {
                const nigeriaDate = new Date((hour.dt + 3600) * 1000)
                const hourOfDay = nigeriaDate.getUTCHours()
                const pop = hour.pop || 0
                if (hourOfDay >= 6 && hourOfDay < 12) {
                    morningRainSum += pop
                    morningCount++
                } else if (hourOfDay >= 12 && hourOfDay < 18) {
                    afternoonRainSum += pop
                    afternoonCount++
                }
            })
            const avgMorn = morningCount > 0 ? (morningRainSum / morningCount) : 0
            const avgAft = afternoonCount > 0 ? (afternoonRainSum / afternoonCount) : 0

            if (avgMorn >= 0.45 && avgAft < 0.3) rain = 'morning'
            else if (avgAft >= 0.45 && avgMorn < 0.3) rain = 'afternoon'
            else rain = 'daytime'
        } else {
            rain = 'intermittent'
        }
    }

    // ── 2. Wind Timing ──
    let wind = 'none'
    const windThreshold = rules?.alertWindThreshold ?? 40
    const isDayWindHigh = daytimeWindMax > windThreshold
    const isNightWindHigh = nighttimeWindMax > windThreshold
    if (isDayWindHigh || isNightWindHigh) {
        if (isDayWindHigh && isNightWindHigh) wind = 'intermittent'
        else if (isNightWindHigh) wind = 'night'
        else wind = 'daytime'
    }

    // ── 3. Temp/Heat Timing ──
    let tempTiming = 'none'
    const tempThreshold = rules?.alertTempHighThreshold ?? 38
    const isDayTempHigh = daytimeTempMax > tempThreshold
    const isNightTempHigh = nighttimeTempMax > tempThreshold
    if (isDayTempHigh || isNightTempHigh) {
        if (isDayTempHigh && isNightTempHigh) tempTiming = 'intermittent'
        else if (isNightTempHigh) tempTiming = 'night'
        else tempTiming = 'afternoon'
    }

    return { rain, wind, temp: tempTiming }
}

// ── Format one OWM daily entry into our shape ──
const formatDay = (dailyEntry, index) => {
    const windKmh     = Math.round((dailyEntry.wind_speed || 0) * 3.6)
    const rainPercent = Math.round((dailyEntry.pop || 0) * 100)
    const date        = new Date(dailyEntry.dt * 1000)

    const dayNames   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
    const shortNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

    // ── use Nigeria timezone (UTC+1) for correct day label and date string ──
    const nigeriaDate = new Date(dailyEntry.dt * 1000 + (60 * 60 * 1000)) // shift +1hr
    const dateString  = nigeriaDate.toISOString().split("T")[0]
    const dayIndex    = nigeriaDate.getUTCDay()

    return {
        index,
        date:        dateString,
        dayLabel:    dayNames[dayIndex],
        dayShort:    shortNames[dayIndex],
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
                current: {
                    ...cache.current,
                    ...todayDecision,
                    rainTiming: cache.forecast[0]?.rainTiming || 'none',  // ✅ add this
                    windTiming: cache.forecast[0]?.windTiming || 'none',  // ✅ add this
                    tempTiming: cache.forecast[0]?.tempTiming || 'none',  // ✅ add this
                },
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
        const formattedForecast = owmData.daily.slice(0, 7).map((day, i) => {
            const formatted = formatDay(day, i)
            if (i <= 1 && owmData.hourly) {
                const timings = analyzeHourlyTiming(owmData.hourly, formatted.date, rules)
                formatted.rainTiming = timings.rain
                formatted.windTiming = timings.wind
                formatted.tempTiming = timings.temp
            } else {
                formatted.rainTiming = 'none'
                formatted.windTiming = 'none'
                formatted.tempTiming = 'none'
            }
            return formatted
        })
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
        const todayDecision = evaluateDay({
            ...formattedCurrent,
            rainTiming: formattedForecast[0].rainTiming,
            windTiming: formattedForecast[0].windTiming,
            tempTiming: formattedForecast[0].tempTiming
        }, rules, crops)

        // ── send weather alert email if threshold breached — fresh fetch only ──
        if (todayDecision.alert) {
            sendMail({
                to: farmer.email,
                subject: `⚠️ Weather Alert — ${
                    todayDecision.alert.type === 'flood' ? 'Heavy Rain Expected'
                    : todayDecision.alert.type === 'wind' ? 'High Wind Warning'
                    : 'Extreme Heat Warning'
                }`,
                template: 'weather-alert.ejs',
                data: {
                    name:      farmer.fullName,
                    location:  farmer.farmLocation,
                    alert:     todayDecision.alert,
                    temp:      formattedCurrent.temp,
                    rain:      formattedCurrent.rain,
                    humidity:  formattedCurrent.humidity,
                    windSpeed: formattedCurrent.windSpeed
                }
            }).catch(err => console.error('Weather alert email failed:', err.message))
            // note: no await — fire and forget so it doesn't delay the response
        }
        
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