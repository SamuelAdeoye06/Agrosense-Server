// ─────────────────────────────────────────────────────────────
// decisionEngine.js
// Pure function — no DB calls, no side effects.
// Takes weather data + rules + crop categories → decision.
// Called per day when building the 7-day forecast.
// ─────────────────────────────────────────────────────────────

const CATEGORY_ADVICE = {

    grains: {
        name:     "Grains & Cereals",
        examples: "maize, rice, sorghum, millet, wheat, fonio",
        icon:     "🌾",
        goodDay:      "Good conditions for grain planting, germination and growth.",
        badDay:       "Not ideal for grains today. Delay planting or field operations.",
        highHumidity: "High humidity alert for grains: watch for fungal diseases like leaf blight, rust and smut. Ensure field drainage is clear.",
        highWind:     "Strong wind can cause lodging in tall cereals like maize and sorghum. Check and stake young plants.",
        drought:      "Low moisture levels. Irrigate grain crops early morning to prevent heat and drought stress.",
        heatStress:   "Extreme heat can affect grain filling and pollen viability. Water crops and avoid midday field work.",
        coldStress:   "Low temperature slows germination and early growth in grains. Delay planting until soil warms."
    },

    tubers: {
        name:     "Tubers & Roots",
        examples: "cassava, yam, cocoyam, sweet potato, Irish potato",
        icon:     "🥔",
        goodDay:      "Good conditions for tuber planting, mounding and weeding.",
        badDay:       "Conditions not ideal for tubers. Hold off on planting or transplanting today.",
        highHumidity: "Excess moisture risk: high humidity promotes tuber rot and bacterial blight. Check that ridges and mounds drain properly.",
        highWind:     "Wind may topple yam stakes and trellises. Inspect and secure all supports.",
        drought:      "Tubers need consistent soil moisture. Irrigate or apply mulch to retain water around roots.",
        heatStress:   "Extreme heat can cause tuber cracking and poor bulking. Mulch the soil surface to keep roots cool.",
        coldStress:   "Tubers prefer warm soils. Low temperatures significantly slow tuber formation and germination."
    },

    legumes: {
        name:     "Legumes & Pulses",
        examples: "beans, cowpea, soybeans, groundnut, sesame",
        icon:     "🫘",
        goodDay:      "Good conditions for legume growth, nitrogen fixation and pod filling.",
        badDay:       "Legumes prefer moderate warmth and humidity — conditions are not ideal today.",
        highHumidity: "High humidity increases pod and stem blight risk in legumes. Improve air circulation between rows.",
        highWind:     "Wind can cause flower drop in beans and cowpea at flowering stage. Monitor closely.",
        drought:      "Legumes are moderately drought-tolerant but need moisture at flowering. Irrigate if rainfall is absent.",
        heatStress:   "Excessive heat causes flower abortion in beans and groundnut. Water during cooler hours.",
        coldStress:   "Most Nigerian legumes are warm-season crops. Low temperatures will stunt growth significantly."
    },

    vegetables: {
        name:     "Vegetables",
        examples: "tomatoes, peppers, okra, onions, cabbage, cucumber, carrot",
        icon:     "🍅",
        goodDay:      "Good conditions for vegetable growth, transplanting and general farm work.",
        badDay:       "Vegetables are sensitive to extremes — delay transplanting or outdoor work today.",
        highHumidity: "High humidity is dangerous for vegetables: early blight, late blight and damping-off risk is high. Apply appropriate fungicide and improve drainage.",
        highWind:     "Wind can snap vegetable stems and damage fruits. Stake tomatoes and peppers. Cover seedling beds.",
        drought:      "Vegetables are high water-demand crops. Irrigate consistently — moisture stress quickly reduces yield and quality.",
        heatStress:   "Heat stress causes blossom drop in tomatoes and peppers. Shade young plants and irrigate frequently.",
        coldStress:   "Most Nigerian vegetables prefer warm conditions. Low temperatures will slow growth and cause wilting."
    },

    plantains: {
        name:     "Plantains & Bananas",
        examples: "plantain, banana",
        icon:     "🍌",
        goodDay:      "Good moisture and temperature conditions for plantain and banana growth.",
        badDay:       "Conditions are not ideal for plantain work today. Avoid transplanting suckers.",
        highHumidity: "High humidity significantly increases Black Sigatoka disease risk in plantain and banana. Monitor leaves and apply treatment early.",
        highWind:     "Plantain and banana are extremely wind-sensitive. Strong wind can uproot entire plants or snap pseudostems. Prop up heavy bunches urgently.",
        drought:      "Plantain and banana are very water-demanding. Water stress quickly reduces bunch size and fruit quality. Irrigate or mulch heavily.",
        heatStress:   "High temperatures increase water demand in plantain. Ensure consistent irrigation and mulch around the base.",
        coldStress:   "Plantain and banana are tropical crops. Even mild cold can cause leaf damage and slow bunch development."
    },

    fruits: {
        name:     "Fruits & Orchards",
        examples: "mango, citrus, pawpaw, pineapple, watermelon, pear",
        icon:     "🍊",
        goodDay:      "Good conditions for fruit crop growth and orchard management.",
        badDay:       "Not ideal for fruit crop activities today. Delay fertilizer application or pruning.",
        highHumidity: "High humidity promotes fruit rot, anthracnose and fungal diseases in orchards. Ensure good spacing and air circulation between trees.",
        highWind:     "Strong wind can cause premature fruit drop and physical damage to branches. Inspect orchard for broken limbs and support heavy-fruiting branches.",
        drought:      "Fruit crops need consistent moisture especially during fruit set and development. Irrigate and mulch around tree bases.",
        heatStress:   "Extreme heat causes sunscald on fruits and increases water stress. Irrigate frequently and avoid pruning in heat.",
        coldStress:   "Most Nigerian fruit trees are tropical and will suffer leaf damage and reduced flowering in cold conditions."
    },

    cash_crops: {
        name:     "Cash Crops",
        examples: "cocoa, oil palm, rubber, cotton, sugarcane, ginger",
        icon:     "🌴",
        goodDay:      "Good conditions for cash crop maintenance, planting and harvesting activities.",
        badDay:       "Conditions are not ideal for cash crop field work today.",
        highHumidity: "High humidity increases black pod disease risk in cocoa and fungal infections in ginger. Inspect crops and apply treatment as needed.",
        highWind:     "Strong wind can damage cocoa pods and rubber tree branches. Check plantation for wind damage after storms.",
        drought:      "Cash crops like sugarcane and cocoa have high water demands. Extended drought will significantly affect yield. Irrigate where possible.",
        heatStress:   "Extreme heat reduces cocoa flowering and pod set. Maintain shade trees in cocoa plantations and irrigate ginger beds.",
        coldStress:   "Cash crops like cocoa and oil palm are sensitive to cold. Low temperatures will reduce productivity and may cause leaf damage."
    },

    herbs: {
        name:     "Herbs & Spices",
        examples: "turmeric, garlic, basil, ginger, scent leaf",
        icon:     "🌿",
        goodDay:      "Good conditions for herb and spice crop growth and harvesting.",
        badDay:       "Herbs prefer stable moderate conditions. Avoid transplanting or harvesting in these conditions.",
        highHumidity: "High humidity promotes damping-off and root rot in herbs. Ensure containers and beds have excellent drainage.",
        highWind:     "Wind can dry out and damage herb foliage quickly. Provide windbreaks or move potted herbs to shelter.",
        drought:      "Most herbs need consistent but not excessive moisture. Water regularly and mulch to retain soil moisture.",
        heatStress:   "Extreme heat causes bolting and reduced oil content in herbs. Provide partial shade and increase watering frequency.",
        coldStress:   "Tropical herbs like ginger, turmeric and scent leaf are cold-sensitive. Protect from cold nights with covering or mulch."
    }
}

// ── General advice ──
// Always shown — covers farmers who haven't set crop profiles
// and provides a baseline for anyone growing something outside
// the listed categories.
const GENERAL_ADVICE = {
    goodDay:      "Overall conditions look favorable for general farm work today.",
    badDay:       "Conditions are not ideal for farming today. Consider postponing sensitive outdoor operations.",
    highHumidity: "High humidity detected across the farm. Watch for fungal diseases and ensure drainage channels are clear.",
    highWind:     "High wind speeds recorded. Secure farm structures, nets, stakes and young plants before wind picks up.",
    drought:      "Low rainfall and moisture levels. Check all crops for stress signs and irrigate where possible.",
    heatStress:   "Extreme heat warning. Schedule heavy farm work for early morning or late evening. Keep animals and workers hydrated.",
    coldStress:   "Unusually low temperatures. Cover sensitive seedlings overnight and delay transplanting until temperatures recover."
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

// ── Main evaluation function ──
const evaluateDay = (weather, rules, cropCategories = []) => {
    const { temp, rain, humidity, windSpeed, weatherId } = weather

    // ── 1. Score the day 0–100 ──
    let score = 100

    if (rain < rules.minRain)                    score -= 25
    if (rain > rules.alertRainThreshold)         score -= 20
    if (humidity < rules.minHumidity)            score -= 20
    if (humidity > 90)                           score -= 15
    if (windSpeed > rules.maxWind)               score -= 20
    if (windSpeed > rules.alertWindThreshold)    score -= 15
    if (temp < rules.minTemp)                    score -= 20
    if (temp > rules.maxTemp)                    score -= 20
    if (temp > rules.alertTempHighThreshold)     score -= 15

    score = Math.max(0, score)

    // ── 2. Label based on score ──
    const isGoodDay = score >= 50
    let label
    if      (score >= 80) label = "Excellent Farming Day"
    else if (score >= 60) label = "Good Farming Day"
    else if (score >= 40) label = "Fair Conditions"
    else if (score >= 20) label = "Poor Farming Day"
    else                  label = "Avoid Farm Work"

    // ── 3. Detect which conditions are active ──
    const isDrought   = rain < rules.minRain && humidity < rules.minHumidity
    const isHighWind  = windSpeed > rules.maxWind
    const isHeatStress = temp > rules.maxTemp
    const isColdStress = temp < rules.minTemp
    const isHighHumidity = humidity > 80

    // ── 4. Main recommendation ──
    let recommendation
    if (isGoodDay) {
        if (rain >= rules.minRain && humidity >= rules.minHumidity) {
            recommendation = "Good moisture levels. Ideal for planting, transplanting and general field work."
        } else if (isHighWind) {
            recommendation = `Conditions are mostly good but wind is elevated (${Math.round(windSpeed)} km/h). Avoid spraying and transplanting delicate seedlings.`
        } else {
            recommendation = "Conditions are acceptable. A good day for general farm activities."
        }
    } else {
        if (isHeatStress) {
            recommendation = `High temperature (${Math.round(temp)}°C). Avoid heavy outdoor work. Irrigate early morning or late evening.`
        } else if (isColdStress) {
            recommendation = `Low temperature (${Math.round(temp)}°C). Cold stress may damage crops. Delay planting and protect seedlings.`
        } else if (isHighWind) {
            recommendation = `High wind speeds (${Math.round(windSpeed)} km/h). Avoid spraying, transplanting and any work with young plants.`
        } else if (isDrought) {
            recommendation = "Low rain and humidity. Consider irrigation and apply mulch to retain soil moisture."
        } else {
            recommendation = "Conditions are not ideal today. Postpone sensitive farm operations where possible."
        }
    }

    // ── 5. Category-specific tips ──
    const categoryTips = []

    // always add general advice first as a baseline
    const generalTip = isGoodDay ? GENERAL_ADVICE.goodDay : GENERAL_ADVICE.badDay
    categoryTips.push({ category: "General", icon: "🌱", tip: generalTip })

    // add condition-based general warnings
    if (isHighHumidity) categoryTips.push({ category: "General", icon: "💧", tip: GENERAL_ADVICE.highHumidity })
    if (isHighWind)     categoryTips.push({ category: "General", icon: "💨", tip: GENERAL_ADVICE.highWind })
    if (isDrought)      categoryTips.push({ category: "General", icon: "☀️", tip: GENERAL_ADVICE.drought })
    if (isHeatStress)   categoryTips.push({ category: "General", icon: "🌡", tip: GENERAL_ADVICE.heatStress })
    if (isColdStress)   categoryTips.push({ category: "General", icon: "❄️", tip: GENERAL_ADVICE.coldStress })

    // now add per-category tips for each category the farmer selected
    cropCategories.forEach((cat) => {
        const advice = CATEGORY_ADVICE[cat]
        if (!advice) return

        // primary good/bad tip for this category
        const primaryTip = isGoodDay ? advice.goodDay : advice.badDay
        categoryTips.push({
            category: advice.name,
            icon:     advice.icon,
            examples: advice.examples,
            tip:      primaryTip
        })

        // condition-specific warnings for this category
        if (isHighHumidity && advice.highHumidity)
            categoryTips.push({ category: advice.name, icon: "⚠️", tip: advice.highHumidity })
        if (isHighWind && advice.highWind)
            categoryTips.push({ category: advice.name, icon: "💨", tip: advice.highWind })
        if (isDrought && advice.drought)
            categoryTips.push({ category: advice.name, icon: "🏜️", tip: advice.drought })
        if (isHeatStress && advice.heatStress)
            categoryTips.push({ category: advice.name, icon: "🌡", tip: advice.heatStress })
        if (isColdStress && advice.coldStress)
            categoryTips.push({ category: advice.name, icon: "❄️", tip: advice.coldStress })
    })

    // ── 6. Alert check ──
    // Separate from good/poor — fires only for genuinely dangerous conditions
    let alert = null
    if (rain > rules.alertRainThreshold) {
        alert = {
            type:     "flood",
            severity: "high",
            message:  `Heavy rain expected (${Math.round(rain)}% chance). Risk of flooding and waterlogged soil. Protect harvested produce and check all drainage channels.`
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
        score,
        recommendation,
        categoryTips,
        alert,
        icon: getWeatherIcon(weatherId)
    }
}

module.exports = { evaluateDay, getWeatherIcon }