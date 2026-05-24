require("dotenv").config()

const app = require("../app")
const connectDB = require("../config/db")

let dbReady

const ensureDB = () => {
    if (!dbReady) {
        dbReady = connectDB().catch((error) => {
            dbReady = null
            throw error
        })
    }

    return dbReady
}

module.exports = async (req, res) => {
    try {
        await ensureDB()
        return app(req, res)
    } catch (error) {
        console.error("Request failed before app handler:", error.message)
        return res.status(500).json({ message: "Server configuration error" })
    }
}
