import nodemailer from 'nodemailer';
import { getLogger } from './logger.js';

// send an email using GMAIL
const pw = process.env.GMAIL_APP_PASSWORD;
const from = process.env.GMAIL_FROM_ADDRESS;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: from,
        pass: pw
    }
});

export async function sendEmail(to, subject, text) {
    const mailOptions = {
        from,
        to,
        subject,
        text: text.text || text,
        html: text.html || undefined,
    };
    try {
        await transporter.sendMail(mailOptions);
        getLogger().info(`Email sent`, {to});
    } catch (error) {
        getLogger().error(error, `Error sending email`, {to});
    }
}
