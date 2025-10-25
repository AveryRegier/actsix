
import crypto from 'crypto';
import qs from 'qs';
import axios from 'axios';
import { decode } from 'jsonwebtoken';
import { safeCollectionFind, db } from '../helpers.js';
import { getLogger, follow, addContexts, addContext } from '../logger.js';
import jwt from 'jsonwebtoken';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
// Type for OIDC config
/**
 * @typedef {Object} OIDCConfig
 * @property {string} issuer
 * @property {string} authorization_endpoint
 * @property {string} token_endpoint
 * @property {string} revocation_endpoint
 * @property {string} introspection_endpoint
 * @property {string} userinfo_endpoint
 * @property {string} jwks_uri
 * @property {string[]} scopes_supported
 * @property {string[]} response_types_supported
 * @property {string[]} response_modes_supported
 * @property {string[]} grant_types_supported
 * @property {string[]} token_endpoint_auth_methods_supported
 * @property {string[]} subject_types_supported
 * @property {string[]} id_token_signing_alg_values_supported
 * @property {string[]} claim_types_supported
 * @property {string[]} claims_supported
 * @property {string[]} code_challenge_methods_supported
 */
export default function registerOidcRoutes(app) {
    const OIDC_DISCOVERY_URL = process.env.OIDC_DISCOVERY_URL;
    /** @type {OIDCConfig|null} */
    let OIDC_CONFIG = null;

    async function getOIDCConfig() {
        if (OIDC_CONFIG) return OIDC_CONFIG;
        const resp = await axios.get(OIDC_DISCOVERY_URL);
        OIDC_CONFIG = resp.data;
        return OIDC_CONFIG;
    }

    const CLIENT_ID = process.env.PLANNING_CENTER_CLIENT_ID;
    const CLIENT_SECRET = process.env.PLANNING_CENTER_CLIENT_SECRET;
    const REDIRECT_URI = process.env.API_GATEWAY_URL + '/oidc/callback';

    app.use('*', async (c, next) => await follow(async () => {
        const logger = getLogger();
        try {
            // Extract API-key header for scripted generation (fast automation). If provided and matches
            // the configured GENERATION_API_KEY, consider the request authenticated as a script user.
            const generationKey = process.env.GENERATION_API_KEY;
            const authHeader = (c.req.header('authorization') || '').toString();
            const xApiKey = c.req.header('x-api-key') || '';

            let memberId = null;
            let role = null;

            if (generationKey && (authHeader.startsWith('Bearer ') || xApiKey)) {
                const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : xApiKey;
                if (token === generationKey) {
                    // Authenticated as a scripted generator: grant high privileges for seeding
                    memberId = 'script-generator';
                    role = 'deacon';
                    // Do not set persistent cookies here; this is for script-based automation only
                    addContext('auth_method', 'generation_api_key');
                }
            }

            // If no API key matched, fall back to cookie-based actsix value
            if (!memberId) {
                // fixme: verify the token
                // extract user information from the cookies in the request
                const actsix = getCookie(c, 'actsix')?.split("|");
                memberId = actsix?.[0];
                addContext("memberId", memberId);
                role = actsix?.[1];
            }

            c.req.memberId = memberId; // Save memberId as an attribute on the request
            c.req.role = role; // Save role as an attribute on the request
            logger.info('Incoming request', { method: c.req.method, url: c.req.url, memberId, role });

            if (!memberId && !c.req.path.includes("/oidc")) {
                logger.warn('No valid member found in request headers');
                if (c.req.path.includes(".html") || c.req.path === "/") { 
                    // get planning center login url from oidc discovery
                    let url = `/oidc/login`;
                    logger.info('Redirecting to login:', url);
                    return await c.redirect(url, 302);
                } else {
                    return await c.text('401 Unauthorized', 401);
                }
            }

            logger.info("calling next");
            return await next();
        } catch (error) {
            logger.error(error, 'Error handling request:');
            return await c.text('500 Internal Server Error', 500);
        }}, (logger) => {
            logger.addContexts({
                requestId: c.req.header('x-request-id') || undefined,
                path: c.req.path, method: c.req.method, url: c.req.url
            });
        }, () => {
            return { status: c.res.status };
        }
    ));

    // OIDC Discovery endpoint (proxy)
    app.get('/oidc/.well-known/openid-configuration', async (c) => {
        const config = await getOIDCConfig();
        return c.json(config);
    });

    // Login: redirect to Planning Center authorize endpoint
    // PKCE helper
    function pkceChallenge() {
        const code_verifier = crypto.randomBytes(32).toString('hex');
        const code_challenge = crypto
            .createHash('sha256')
            .update(code_verifier)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        return { code_verifier, code_challenge };
    }

    app.get('/oidc/login', async (c) => {
        const config = await getOIDCConfig();
        const state = crypto.randomBytes(16).toString('hex');
        const nonce = crypto.randomBytes(16).toString('hex');
        const { code_verifier, code_challenge } = pkceChallenge();
        // Store state/nonce/code_verifier in cookies for later validation
        setCookie(c, 'oidc_state', state, { path: '/', httpOnly: true, sameSite: 'Lax' });
        setCookie(c, 'oidc_nonce', nonce, { path: '/', httpOnly: true, sameSite: 'Lax' });
        setCookie(c, 'oidc_code_verifier', code_verifier, { path: '/', httpOnly: true, sameSite: 'Lax' });
        const params = {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: 'openid people',
            state,
            nonce,
            prompt: 'select_account',
            code_challenge,
            code_challenge_method: 'S256',
        };
        const url = `${config.authorization_endpoint}?${qs.stringify(params)}`;
        return c.redirect(url, 302);
    });

    // Callback: exchange code for tokens
    app.get('/oidc/callback', async (c) => {
        const config = await getOIDCConfig();
        const code = c.req.query('code');
        const state = c.req.query('state');
        const cookies = c.req.header('cookie') || '';
        const cookieState = cookies.match(/oidc_state=([^;]+)/)?.[1];
        const code_verifier = cookies.match(/oidc_code_verifier=([^;]+)/)?.[1];
        if (!code || !state || state !== cookieState || !code_verifier) {
            return c.text('Invalid OIDC state, code, or PKCE verifier', 400);
        }
        // Exchange code for tokens using PKCE
        const tokenResp = await axios.post(config.token_endpoint, qs.stringify({
            grant_type: 'authorization_code',
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            code_verifier,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const tokens = tokenResp.data;
        const decoded = decode(tokens.id_token);
        const email = decoded.email;
        const planningCenterId = decoded.sub;
        const organization_id = decoded.organization_id; //need to verify this

        if(organization_id !== Number(process.env.ALLOWED_ORGANIZATION_ID)) {
            return c.text('Not authorized', 403);
        }
        // lookup member by email
        const members = await safeCollectionFind('members', { $or: [{ organization_id, planningCenterId }, { email }] });
        if (members.length === 0) {
            return c.text('Not authorized', 403);
        } else {
            const member = members.pop();
            const memberId = member._id;
            const role = (member.tags || []).includes('deacon') ? 'deacon' : ((member.tags || []).includes('staff') ? 'staff' : null);

            if (member.organization_id !== organization_id) {
                member.organization_id = organization_id;
                member.planningCenterId = planningCenterId;

                await db.collection('members').updateOne(
                    { _id: memberId },
                    { $set: { organization_id, planningCenterId } }
                );
            }

            // set the actsix cookie
            setCookie(c, 'actsix', `${memberId}|${role}`, { secure: c.req.isSecure });

            setCookie(c, 'access_token', tokens.access_token, { path: '/', httpOnly: true, sameSite: 'strict', secure: c.req.isSecure });
            setCookie(c, 'id_token', tokens.id_token, { path: '/', httpOnly: true, sameSite: 'strict', secure: c.req.isSecure });
            setCookie(c, 'refresh_token', tokens.refresh_token, { path: '/', httpOnly: true, sameSite: 'strict', secure: c.req.isSecure });

            deleteCookie(c, 'oidc_state', { path: '/' });
            deleteCookie(c, 'oidc_nonce', { path: '/' });
            deleteCookie(c, 'oidc_code_verifier', { path: '/' });

            return c.redirect('/');
        }
    });

    // Token refresh endpoint
    app.post('/oidc/refresh', async (c) => {
        const config = await getOIDCConfig();
        const { refresh_token } = await c.req.json();
        if (!refresh_token) return c.text('Missing refresh_token', 400);
        const tokenResp = await axios.post(config.token_endpoint, {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token,
            grant_type: 'refresh_token',
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        return c.json(tokenResp.data);
    });

    // User info endpoint
    app.get('/oidc/userinfo', async (c) => {
        const config = await getOIDCConfig();
        const access_token = c.req.header('authorization')?.replace('Bearer ', '') || c.req.query('access_token');
        if (!access_token) return c.text('Missing access_token', 401);
        const resp = await axios.get(config.userinfo_endpoint, {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        return c.json(resp.data);
    });

}
