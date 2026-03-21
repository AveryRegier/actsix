
import jwt from 'jsonwebtoken';
import { safeCollectionFind, safeCollectionUpdate } from '../util/helpers.js';
import { getLogger } from '../util/logger.js';
import { sendEmail as _origSendEmail, sendEmail } from '../util/email.js';

const VALIDATION_CODE_TTL_MINUTES = 15;
const VALIDATION_CODE_TTL_MS = VALIDATION_CODE_TTL_MINUTES * 60 * 1000;
const EMAIL_TTL_MINUTES = 30;
const EMAIL_TTL_MS = EMAIL_TTL_MINUTES * 60 * 1000;

export function generateAndSendValidationCode(member) {
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Store the code with an expiration time.
    const codeExpiresAt = Date.now() + VALIDATION_CODE_TTL_MS;
    storeValidationCode(member, code, codeExpiresAt);
    // Send the code via email in a way that will trigger phones to automatically add it to SMS verification code suggestions
    // Build an email subject and body that maximize the chance phones will offer the code for AutoFill.
    const appName = process.env.APP_NAME || 'ActSix';
    const subject = `${appName} verification code: ${code}`;

    // Plain-text form puts the code at the start of a line and uses a clear phrase.
    // HTML form renders the code prominently and also contains the plain-code line to help parsers.
    const textBody = `${code} is your ${appName} verification code.\n\nThis code will expire in ${VALIDATION_CODE_TTL_MINUTES} minutes.`;
    const htmlBody = `
        <div>
            <p>Your ${appName} verification code is:</p>
            <p style="font-family:monospace; font-size:28px; font-weight:600; margin:8px 0;">${code}</p>
            <p style="color:#666; font-size:12px; margin-top:8px;">This code will expire in ${VALIDATION_CODE_TTL_MINUTES} minutes.</p>
            <!-- Keep a plain-code line to improve automatic extraction by mail clients -->
            <div style="display:none">${code}</div>
        </div>
    `;

    const emailOptions = { expiresAt: Date.now() + EMAIL_TTL_MS };

    try {
        // Prefer richer payload if the original supports it.
        return sendEmail(member.email, subject, { text: textBody, html: htmlBody }, emailOptions);
    } catch (err) {
        // Fallback to plain-text
        return sendEmail(member.email, subject, textBody, emailOptions);
    }
}

export async function findMemberByEmail(email) {
    email = email.toLowerCase().trim();
    return (await safeCollectionFind("members", { email }))?.[0] || null;
}

export function generateToken(user) {
    const tags = (user.tags || []);
    const role = tags.includes('deacon') ? 'deacon' : tags.includes('staff') ? 'staff' : tags.includes('helper') ? 'helper' : null;

    const token = jwt.sign({ id: user._id, email: user.email, role }, process.env.JWT_SECRET, { expiresIn: '361d' });
    return token;
}

export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (err) {
        getLogger().error(err, 'Error verifying token');
        return null;
    }
}

export async function storeValidationCode(member, code, expiresAt) {
    member.validationCodes = member.validationCodes?.filter(vc => vc.expiresAt > Date.now()) ?? [];
    member.validationCodes.push({ code, expiresAt });
    // This update only affects validation codes (login flow) and should NOT invalidate the reports cache
    await safeCollectionUpdate(
        'members',
        { _id: member._id },
        { $set: { validationCodes: member.validationCodes } },
        { skipCacheInvalidation: true }
    );
}

export async function clearValidationCodesForMemberId(memberId) {
    if (!memberId || memberId === 'script-generator') {
        return;
    }

    await safeCollectionUpdate(
        'members',
        { _id: memberId },
        { $set: { validationCodes: [] } },
        { skipCacheInvalidation: true }
    );
}

export async function authenticateUser(email, validationCode) {
    const member = await findMemberByEmail(email);
    if (!member) {
        return null;
    }
    const expiration = member.validationCodes?.find(vc => vc.code === validationCode)?.expiresAt;
    if(!expiration || expiration < Date.now()) {
        return null;
    }
    return member;
}

export async function verifyRole(c, requiredRoles) {
    if(c.req.role && requiredRoles.includes(c.req.role)) {
        return true;
    }
    if(c.req.memberId) {
        getLogger().info(`Verifying role for member ID: ${c.req.memberId}`);
        const member = await safeCollectionFind('members', { _id: c.req.memberId });
       if (member && member.role && requiredRoles.includes(member.role)) {
           // then the token and cookie need updated
           c.req.role = member.roles
           c.res.cookie('actsix', generateToken(member), { httpOnly: true, maxAge: 60 * 24 * 60 * 60 * 1000 }); // 60 days
           return true;
       }
    }

    return false;
}