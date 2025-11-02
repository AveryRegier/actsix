
import jwt from 'jsonwebtoken';
import { db, safeCollectionFind } from './helpers.js';
import { getLogger } from './logger.js';
import { sendEmail as _origSendEmail, sendEmail } from './email.js';

export function generateAndSendValidationCode(email) {
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Store the code with an expiration time (e.g., 15 minutes)
    storeValidationCode(email, code, Date.now() + 15 * 60 * 1000);
    // Send the code via email in a way that will trigger phones to automatically add it to SMS verification code suggestions
    // Build an email subject and body that maximize the chance phones will offer the code for AutoFill.
    const appName = process.env.APP_NAME || 'ActSix';
    const subject = `${appName} verification code: ${code}`;

    // Plain-text form puts the code at the start of a line and uses a clear phrase.
    // HTML form renders the code prominently and also contains the plain-code line to help parsers.
    const textBody = `${code} is your ${appName} verification code.\n\nThis code will expire in 15 minutes.`;
    const htmlBody = `
        <div>
            <p>Your ${appName} verification code is:</p>
            <p style="font-family:monospace; font-size:28px; font-weight:600; margin:8px 0;">${code}</p>
            <p style="color:#666; font-size:12px; margin-top:8px;">This code will expire in 15 minutes.</p>
            <!-- Keep a plain-code line to improve automatic extraction by mail clients -->
            <div style="display:none">${code}</div>
        </div>
    `;

    try {
        // Prefer richer payload if the original supports it.
        return sendEmail(email, subject, { text: textBody, html: htmlBody });
    } catch (err) {
        // Fallback to plain-text
        return sendEmail(to, subject, textBody);
    }
}

export async function authenticateUser(email, validationCode) {
    const member = await findMemberByEmail(email);
    if (!member) {
        return null;
    }
    if(member.validationCode !== validationCode) {
        return null;
    }
    return member;
}

export async function findMemberByEmail(email) {
    return (await safeCollectionFind("members", { email }))?.[0] || null;
}

export function generateToken(user) {
    const role = (user.tags || []).includes('deacon') ? 'deacon' : ((user.tags || []).includes('staff') ? 'staff' : null);

    const token = jwt.sign({ id: user._id, email: user.email, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return token;
}

export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (err) {
        return null;
    }
}

export async function storeValidationCode(email, code, expiresAt) {
    await db.collection("members").updateOne(
        { email },
        { $set: { validationCode: code, validationCodeExpiresAt: expiresAt } }
    );
}
