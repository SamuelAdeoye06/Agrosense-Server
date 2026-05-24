const transporter = require('../config/mail.config')
const { renderTemplate } = require('../middleware/mail.sender')

const sendMail = async ({
    to,
    subject,
    template,
    data
}) => {
    try {

        const html = await renderTemplate(template, data)

        const mailOptions = {
            from: `"AgroSense 🌱" <${process.env.APP_MAIL}>`,
            replyTo: process.env.APP_MAIL,
            to,
            subject,
            html
        }

        const info = await transporter.sendMail(mailOptions)

        console.log('Email sent:', info.response)

    } catch (error) {
        console.error('Send mail error:', error)
        throw error
    }
}

module.exports = sendMail
