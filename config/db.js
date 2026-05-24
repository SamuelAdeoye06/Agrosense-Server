const mongoose = require("mongoose")

let connectionPromise

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection
    }

    if (connectionPromise) {
        return connectionPromise
    }

    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is not set")
        }

        connectionPromise = mongoose.connect(process.env.MONGO_URI)
        const conn = await connectionPromise
        console.log(`MongoDB connected`)
        return conn
    } catch (error) {
        connectionPromise = null
        console.error(`MongoDB connection failed: ${error.message}`)
        throw error
    }
}

module.exports = connectDB
