// ─────────────────────────────────────────────────────────────
// decisionEngine.js
// Evaluates one day's weather against 4 farming activities:
// planting, harvesting, spraying, irrigation.
// Returns recommended activities + crop-specific tips + alert.
// ─────────────────────────────────────────────────────────────

// ── Crop category tips per activity ──
const CATEGORY_TIPS = {
    grains: {
        name:     "Grains & Cereals",
        examples: "maize, rice, sorghum, millet, wheat",
        icon:     "🌾",
        planting:   "Good conditions for grain planting and germination.",
        harvesting: "Dry conditions suit grain harvesting. Ensure grains are fully dry before storage.",
        spraying:   "Good day to apply herbicides or foliar fertilizer to grain crops.",
        irrigation: "Irrigate grain crops early morning to reduce evaporation loss.",
        warning:    {
            highHumidity: "High humidity risk: watch for leaf blight, rust and smut in cereals.",
            highWind:     "Strong wind can cause maize and sorghum lodging. Stake young plants.",
            drought:      "Drought stress will reduce grain yield. Irrigate consistently.",
            heat:         "High heat affects grain filling. Water crops and avoid midday work."
        }
    },
    tubers: {
        name:     "Tubers & Roots",
        examples: "cassava, yam, cocoyam, sweet potato",
        icon:     "🥔",
        planting:   "Good conditions for tuber planting and mounding.",
        harvesting: "Dry day is ideal for digging and harvesting tubers. Avoid harvesting in heavy rain.",
        spraying:   "Good day to spray fungicides on yam and cocoyam foliage.",
        irrigation: "Mulch and irrigate around tuber mounds to maintain soil moisture.",
        warning:    {
            highHumidity: "High humidity promotes tuber rot and bacterial blight. Check drainage on mounds.",
            highWind:     "Wind may topple yam stakes. Inspect and secure all supports.",
            drought:      "Tubers need consistent moisture. Irrigate or apply mulch to retain water.",
            heat:         "Extreme heat causes tuber cracking. Mulch soil to keep roots cool."
        }
    },
    legumes: {
        name:     "Legumes & Pulses",
        examples: "beans, cowpea, soybeans, groundnut",
        icon:     "🫘",
        planting:   "Good moisture levels for legume planting and nodule formation.",
        harvesting: "Dry conditions suit legume pod harvesting. Avoid picking wet pods.",
        spraying:   "Good day to apply insecticide for pod borers and aphids on legumes.",
        irrigation: "Irrigate at flowering stage — moisture stress now reduces pod set.",
        warning:    {
            highHumidity: "High humidity increases pod blight risk. Improve row spacing for airflow.",
            highWind:     "Wind can cause flower drop in beans at flowering stage.",
            drought:      "Drought at flowering stage drastically cuts legume yield.",
            heat:         "Excessive heat causes flower abortion. Water during cooler hours."
        }
    },
    vegetables: {
        name:     "Vegetables",
        examples: "tomatoes, peppers, okra, onions, cabbage, cucumber",
        icon:     "🍅",
        planting:   "Good conditions for vegetable transplanting and direct seeding.",
        harvesting: "Dry day is best for picking vegetables. Wet produce spoils faster.",
        spraying:   "Good day for fungicide and pesticide application on vegetables.",
        irrigation: "Vegetables need consistent moisture. Irrigate deeply but avoid waterlogging.",
        warning:    {
            highHumidity: "High humidity: early blight and late blight risk is high. Apply fungicide immediately.",
            highWind:     "Wind can snap tomato and pepper stems. Stake plants and cover seedling beds.",
            drought:      "Moisture stress quickly reduces vegetable yield and quality.",
            heat:         "Heat stress causes blossom drop in tomatoes. Shade and irrigate frequently."
        }
    },
    plantains: {
        name:     "Plantains & Bananas",
        examples: "plantain, banana",
        icon:     "🍌",
        planting:   "Good moisture conditions for planting plantain suckers.",
        harvesting: "Good day for harvesting plantain bunches. Avoid harvesting in storms.",
        spraying:   "Good day to apply fungicide against Black Sigatoka disease.",
        irrigation: "Plantain is water-demanding. Mulch heavily around the base to retain moisture.",
        warning:    {
            highHumidity: "High humidity significantly increases Black Sigatoka disease risk. Treat promptly.",
            highWind:     "Plantain is extremely wind-sensitive. Prop bunches and check for uprooting urgently.",
            drought:      "Water stress quickly reduces bunch size. Irrigate and mulch heavily.",
            heat:         "High temperatures increase water demand. Ensure consistent irrigation."
        }
    },
    fruits: {
        name:     "Fruits & Orchards",
        examples: "mango, citrus, pawpaw, pineapple, watermelon",
        icon:     "🍊",
        planting:   "Good conditions for planting fruit seedlings and young trees.",
        harvesting: "Dry conditions are ideal for harvesting fruits. Wet fruits bruise easily.",
        spraying:   "Good day for orchard fungicide and insecticide application.",
        irrigation: "Irrigate fruit trees deeply during dry periods especially at fruit set.",
        warning:    {
            highHumidity: "High humidity promotes fruit rot and anthracnose. Ensure good spacing.",
            highWind:     "Strong wind causes premature fruit drop. Support heavy-fruiting branches.",
            drought:      "Moisture stress during fruit development reduces yield and fruit size.",
            heat:         "Extreme heat causes sunscald on fruits. Irrigate frequently."
        }
    },
    cash_crops: {
        name:     "Cash Crops",
        examples: "cocoa, oil palm, rubber, cotton, sugarcane, ginger",
        icon:     "🌴",
        planting:   "Good conditions for cash crop planting and establishment.",
        harvesting: "Good day for cocoa pod harvesting and oil palm bunch collection.",
        spraying:   "Good day for fungicide application on cocoa and pesticide on cotton.",
        irrigation: "Irrigate ginger and sugarcane beds during dry spells.",
        warning:    {
            highHumidity: "High humidity increases black pod disease in cocoa. Inspect and treat promptly.",
            highWind:     "Strong wind can damage cocoa pods and rubber branches. Check plantation.",
            drought:      "Extended drought will significantly reduce cash crop yield.",
            heat:         "Extreme heat reduces cocoa flowering. Maintain shade trees."
        }
    },
    herbs: {
        name:     "Herbs & Spices",
        examples: "ginger, turmeric, garlic, basil, scent leaf",
        icon:     "🌿",
        planting:   "Good conditions for herb planting and transplanting.",
        harvesting: "Dry day is best for harvesting herbs — essential oil content is highest.",
        spraying:   "Good day for light pesticide or neem oil application on herbs.",
        irrigation: "Water herbs consistently but ensure excellent drainage to avoid root rot.",
        warning:    {
            highHumidity: "High humidity promotes damping-off and root rot in herbs. Improve drainage.",
            highWind:     "Wind dries out herb foliage quickly. Provide windbreaks or shelter.",
            drought:      "Most herbs need consistent moisture. Water regularly and mulch.",
            heat:         "Extreme heat causes bolting and reduces oil content. Provide shade."
        }
    }
}

// ── General tips (always shown as baseline) ──
const GENERAL_TIPS = {
    planting:   "General conditions look suitable for planting and seedbed preparation.",
    harvesting: "Conditions are suitable for general harvesting activities.",
    spraying:   "Good conditions for pesticide and fertilizer application.",
    irrigation: "Consider irrigating crops if soil moisture is low.",
    warning: {
        highHumidity: "High humidity detected. Watch for fungal diseases across all crops.",
        highWind:     "High wind speeds. Secure farm structures, stakes and young plants.",
        drought:      "Low moisture. Check all crops for stress and irrigate where possible.",
        heat:         "Extreme heat. Schedule heavy farm work for early morning or late evening.",
        cold:         "Unusually low temperatures. Cover sensitive seedlings overnight."
    }
}

// ── Weather icon mapper ──
const getWeatherIcon = (weatherId) => {
    if (!weatherId) return "🌡"
    if (weatherId >= 200 && weatherId < 300) return "⛈"
    if (weatherId >= 300 && weatherId < 400) return "🌦"
    if (weatherId >= 500 && weatherId < 510) return "🌧"
    if (weatherId === 511)                   return "🌨"
    if (weatherId >= 520 && weatherId < 600) return "🌦"
    if (weatherId >= 600 && weatherId < 700) return "❄️"
    if (weatherId >= 700 && weatherId < 800) return "🌫"
    if (weatherId === 800)                   return "☀️"
    if (weatherId === 801)                   return "🌤"
    if (weatherId === 802)                   return "⛅"
    if (weatherId >= 803)                    return "☁️"
    return "🌡"
}

// ── Evaluate which activities are recommended for a day ──
const evaluateActivities = (weather, rules) => {
    const { temp, rain, humidity, windSpeed } = weather
    const p = rules.planting
    const h = rules.harvesting
    const s = rules.spraying
    const i = rules.irrigation

    return {
        planting: (
            rain     >= p.minRain     &&
            humidity >= p.minHumidity &&
            windSpeed <= p.maxWind    &&
            temp     >= p.minTemp     &&
            temp     <= p.maxTemp
        ),
        harvesting: (
            rain     <= h.maxRain  &&
            windSpeed <= h.maxWind &&
            temp     >= h.minTemp  &&
            temp     <= h.maxTemp
        ),
        spraying: (
            rain     <= s.maxRain  &&
            windSpeed <= s.maxWind &&
            temp     <= s.maxTemp
        ),
        irrigation: (
            rain <= i.maxRain &&
            temp >= i.minTemp
        )
    }
}

// ── Main evaluation function ──
// Returns full decision object for one day
const evaluateDay = (weather, rules, cropCategories = []) => {
    const { temp, rain, humidity, windSpeed, weatherId } = weather

    // which activities are recommended today
    const activities = evaluateActivities(weather, rules)

    // overall score — how many activities are possible (0–4)
    const activityCount = Object.values(activities).filter(Boolean).length

    // isGoodDay = at least planting OR harvesting is possible
    const isGoodDay = activities.planting || activities.harvesting

    // label based on activity count
    let label
    if      (activityCount >= 3) label = "Excellent Farming Day"
    else if (activityCount === 2) label = "Good Farming Day"
    else if (activityCount === 1) label = "Limited Activities Today"
    else                          label = "Poor Farming Day"

    // ── Detect active conditions ──
    const isHighHumidity = humidity > 80
    const isHighWind     = windSpeed > rules.planting.maxWind
    const isDrought      = rain < rules.planting.minRain && humidity < rules.planting.minHumidity
    const isHeatStress   = temp > rules.alertTempHighThreshold
    const isColdStress   = temp < rules.planting.minTemp

    // ── Build recommended activities list for display ──
    const recommendedActivities = []
    if (activities.planting)   recommendedActivities.push({ key: "planting",   icon: "🌱", label: "Planting" })
    if (activities.harvesting) recommendedActivities.push({ key: "harvesting", icon: "🌾", label: "Harvesting" })
    if (activities.spraying)   recommendedActivities.push({ key: "spraying",   icon: "🧪", label: "Spraying" })
    if (activities.irrigation) recommendedActivities.push({ key: "irrigation", icon: "💧", label: "Irrigation" })

    // ── Main recommendation text ──
    let recommendation
    if (activityCount === 0) {
        if (isHeatStress)      recommendation = `Extreme heat (${Math.round(temp)}°C). Avoid all heavy outdoor work. Water crops early morning or late evening.`
        else if (rain > rules.alertRainThreshold) recommendation = `Heavy rain expected (${Math.round(rain)}%). Avoid field work — flooding risk.`
        else if (isHighWind)   recommendation = `High wind (${Math.round(windSpeed)} km/h). Avoid spraying and working with young plants.`
        else                   recommendation = "Conditions are poor for farming today. Rest and plan for a better day."
    } else {
        const actNames = recommendedActivities.map(a => a.label).join(", ")
        recommendation = `Today is suitable for: ${actNames}.`
    }

    // ── Category tips ──
    const categoryTips = []

    // general tip first
    if (activityCount > 0) {
        const actNames = recommendedActivities.map(a => `${a.icon} ${a.label}`).join(" · ")
        categoryTips.push({ category: "Today's Activities", icon: "📋", tip: actNames })
    }

    // general warnings
    if (isHighHumidity) categoryTips.push({ category: "General", icon: "💧", tip: GENERAL_TIPS.warning.highHumidity })
    if (isHighWind)     categoryTips.push({ category: "General", icon: "💨", tip: GENERAL_TIPS.warning.highWind })
    if (isDrought)      categoryTips.push({ category: "General", icon: "🏜️", tip: GENERAL_TIPS.warning.drought })
    if (isHeatStress)   categoryTips.push({ category: "General", icon: "🌡", tip: GENERAL_TIPS.warning.heat })
    if (isColdStress)   categoryTips.push({ category: "General", icon: "❄️", tip: GENERAL_TIPS.warning.cold })

    // crop-specific tips per category
    cropCategories.forEach((cat) => {
        const advice = CATEGORY_TIPS[cat]
        if (!advice) return

        // show tip for each recommended activity
        recommendedActivities.forEach((act) => {
            if (advice[act.key]) {
                categoryTips.push({
                    category: advice.name,
                    icon:     advice.icon,
                    tip:      advice[act.key]
                })
            }
        })

        // warnings specific to this crop category
        if (isHighHumidity && advice.warning.highHumidity)
            categoryTips.push({ category: advice.name, icon: "⚠️", tip: advice.warning.highHumidity })
        if (isHighWind && advice.warning.highWind)
            categoryTips.push({ category: advice.name, icon: "💨", tip: advice.warning.highWind })
        if (isDrought && advice.warning.drought)
            categoryTips.push({ category: advice.name, icon: "🏜️", tip: advice.warning.drought })
        if (isHeatStress && advice.warning.heat)
            categoryTips.push({ category: advice.name, icon: "🌡", tip: advice.warning.heat })
    })

    // ── Alert check ──
    let alert = null
    if (rain > rules.alertRainThreshold) {
        alert = {
            type:     "flood",
            severity: "high",
            message:  `Heavy rain expected (${Math.round(rain)}% chance). Flooding and waterlogged soil risk. Protect harvested produce and check drainage channels.`
        }
    } else if (windSpeed > rules.alertWindThreshold) {
        alert = {
            type:     "wind",
            severity: "high",
            message:  `Dangerous wind speeds (${Math.round(windSpeed)} km/h). Secure farm structures, stakes and young plants immediately.`
        }
    } else if (temp > rules.alertTempHighThreshold) {
        alert = {
            type:     "heat",
            severity: "medium",
            message:  `Extreme heat (${Math.round(temp)}°C). Irrigate early morning or late evening. Avoid working during midday hours.`
        }
    }

    return {
        isGoodDay,
        label,
        score:                activityCount,
        recommendation,
        recommendedActivities,
        categoryTips,
        alert,
        icon: getWeatherIcon(weatherId)
    }
}

module.exports = { evaluateDay, getWeatherIcon }