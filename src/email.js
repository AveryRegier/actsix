import nodemailer from 'nodemailer';
import { getLogger } from './logger.js';

// send an email using GMAIL
const pw = process.env.GMAIL_APP_PASSWORD;
const from = process.env.GMAIL_FROM_ADDRESS;
const logger = getLogger();

// Defensive: if credentials are missing, create a dummy transporter that throws a clear error
let transporter;
if (!from || !pw) {
    logger.warn('Gmail credentials are missing. Set GMAIL_FROM_ADDRESS and GMAIL_APP_PASSWORD in the environment. Email sending will fail.');
    transporter = {
        sendMail: async () => {
            throw new Error('Missing email provider credentials in environment');
        }
    };
} else {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: from,
            pass: pw
        }
    });
}

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
        logger.info('Email sent', { to });
    } catch (error) {
        // Log a clearer message for missing credentials vs other errors
        if (error && error.message && error.message.toLowerCase().includes('missing')) {
            logger.error({ err: error }, 'Email not sent: missing Gmail credentials or misconfiguration');
        } else {
            logger.error({ err: error }, 'Error sending email', { to });
        }
        throw error; // rethrow so callers can handle failures if needed
    }
}
