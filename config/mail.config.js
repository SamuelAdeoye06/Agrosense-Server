const nodemailer = require('nodemailer')

if (!process.env.APP_MAIL || !process.env.APP_PASS) {
    console.error('Mail configuration error: APP_MAIL and APP_PASS are required')
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.APP_MAIL,
        pass: process.env.APP_PASS
    }
})

if (process.env.NODE_ENV !== 'production') {
    transporter.verify((error) => {
        if (error) {
            console.error('Mail transporter error:', error.message)
        } else {
            console.log('Mail transporter ready')
        }
    })
}

module.exports = transporter
