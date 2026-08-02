import nodemailer from 'nodemailer';
import { getLogger } from './logger.js';

// send an email using GMAIL
const pw = process.env.GMAIL_APP_PASSWORD;
const from = process.env.GMAIL_FROM_ADDRESS;
const logger = getLogger();

// Check if using fake mailer first (for testing)
let transporter;
if (process.env.USE_FAKE_MAILER === '1') {
    logger.info('Using fake mailer (USE_FAKE_MAILER=1)');
    // Create a placeholder that will be intercepted by the nodemailer patch
    transporter = nodemailer.createTransport({
        host: 'localhost',
        port: 1025,
    });
} else if (!from || !pw) {
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

export async function sendEmail(to, subject, text, options = {}) {
    const expiresAt = options.expiresAt ? new Date(options.expiresAt) : null;
    const expiresHeader = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.toUTCString() : undefined;

    const mailOptions = {
        from,
        to,
        subject,
        text: text.text || text,
        html: text.html || undefined,
        headers: {
            ...(expiresHeader ? { Expires: expiresHeader, 'Expiry-Date': expiresHeader } : {}),
            ...(options.headers || {}),
        },
    };
    try {
        console.log('[sendEmail] Sending email to:', to, 'subject:', subject);
        await transporter.sendMail(mailOptions);
        console.log('[sendEmail] Email sent successfully to:', to);
        logger.info('Email sent', { to });
    } catch (error) {
        // Log a clearer message for missing credentials vs other errors
        if (error && error.message && error.message.toLowerCase().includes('missing')) {
            logger.error({ err: error }, 'Email not sent: missing Gmail credentials or misconfiguration');
            console.log('[sendEmail] Missing credentials error:', error.message);
        } else {
            logger.error({ err: error }, 'Error sending email', { to });
            console.log('[sendEmail] Error sending email:', error.message);
        }
        throw error; // rethrow so callers can handle failures if needed
    }
}
