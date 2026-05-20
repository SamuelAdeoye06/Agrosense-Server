const crypto = require('crypto')
const bcrypt = require('bcryptjs')

// generates a cryptographically secure 6-digit OTP
const generateOTP = async () => {
    // crypto.randomInt(min, max) is cryptographically secure
    // generates a number between 100000 and 999999 inclusive
    const plain  = crypto.randomInt(100000, 1000000).toString()
    const salt   = await bcrypt.genSalt(10)
    const hashed = await bcrypt.hash(plain, salt)
    return { plain, hashed }
}

const verifyOTP = async (plain, hashed) => {
    return await bcrypt.compare(String(plain), hashed)
}

module.exports = { generateOTP, verifyOTP }