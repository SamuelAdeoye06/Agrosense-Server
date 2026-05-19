const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.APP_MAIL,
        pass: process.env.APP_PASS
    }
})

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Mail transporter error:', error.message)
    } else {
        console.log('✅ Mail transporter ready')
    }
})

module.exports = transporter