
export default function registerCognitoRoutes(app) {

    // Middleware to log every request and handle authentication
    app.use('*',
        async (c, next) =>
            await follow(async () => {
                try {
                    const logger = getLogger();
                    logger.info('Incoming request:');
                    if (c.req.url.includes('undefined')) {
                        throw new Error("Malformed URL");
                    }
                    // fixme: verify the token

                    // extract user information from the cookies in the request
                    const actsix = getCookie(c, 'actsix')?.split("|");
                    let memberId = actsix?.[0];
                    addContext("memberId", memberId);
                    let role = actsix?.[1];
                    if (!memberId) {
                        const idToken = getCookie(c, 'id_token');
                        if (idToken) {
                            try {
                                const decoded = jwt.decode(idToken);
                                const email = decoded.email; // for lookup of member record
                                const emailVerified = decoded.email_verified;
                                const phoneVerified = decoded.phone_number_verified;
                                const phoneNumber = decoded.phone_number;
                                const userName = decoded['cognito:username']; // for logging
                                logger.addContext("user", userName);
                                memberId = decoded['custom:member_id'];
                                if (!memberId) {
                                    // look it up
                                    // FIXME: only look up member if the email is verified by cognito

                                    // Search for member by email or phone number
                                    let members = emailVerified ? await safeCollectionFind('members', { email }) : null;

                                    if (members.length == 0 && phoneVerified) {
                                        members = await safeCollectionFind('members', { phoneNumbers: phoneNumber });
                                    }
                                    if (members.length > 0) {
                                        memberId = members[0]._id;
                                        role = (members[0].tags || []).includes('deacon') ? 'deacon' : ((members[0].tags || []).includes('staff') ? 'staff' : null);
                                        console.log('Found member ID from user lookup:', memberId);
                                    } else {
                                        console.warn("did not find member")
                                    }
                                }
                            } catch (error) {
                                console.warn('Failed to parse user cookie:', error);
                            }
                        } else {
                            // Extract JWT from Authorization header
                            c.req.headers = c.req.headers || {};
                            const authHeader = c.req.headers?.['authorization'];

                            if (authHeader && authHeader.startsWith('Bearer ')) {
                                logger.debug('Authorization header found:', authHeader);
                                const token = authHeader.slice(7); // Remove 'Bearer '
                                try {
                                    const decoded = jwt.decode(token);
                                    memberId = decoded['custom:member_id'];
                                    role = decoded['cognito:groups'] ? decoded['cognito:groups'][0] : null; // Extract the first group as role

                                } catch (error) {
                                    logger.warn('Failed to decode JWT:', error);
                                    // logger?.warn('Failed to decode JWT', error);
                                }
                            }
                        }
                    }
                    c.req.memberId = memberId; // Save memberId as an attribute on the request
                    c.req.role = role; // Save role as an attribute on the request
                    setCookie(c, 'actsix', `${memberId || ''}|${role || ''}`);
                    logger.info('Incoming request', { method: c.req.method, url: c.req.url, memberId, role });

                    // Exclude the /cognito route from authentication checks
                    if (c.req.path === '/cognito' || c.req.path === '/favicon.ico' || c.req.path.startsWith('/oidc')) {
                        logger.info('Skipping authentication for /cognito route');
                        return await next();
                    }

                    if (!memberId) { // && process.env.API_GATEWAY_URL && process.env.COGNITO_LOGIN_URL
                        logger.warn('No valid member found in request headers');
                        // Redirect to Cognito login if no valid token is found
                        let params = {
                            client_id: process.env.COGNITO_CLIENT_ID,
                            response_type: 'code',
                            scope: 'email openid phone',
                            redirect_uri: `${process.env.API_GATEWAY_URL}/cognito`,
                        }
                        let url = `${process.env.COGNITO_LOGIN_URL}?${qs.stringify(params, { encode: true })}`;
                        logger.info('Redirecting to login:', url);
                        return await c.redirect(url, 302);
                    }

                    logger.info("calling next");
                    return await next();
                } catch (error) {
                    logger.error(error, 'Error handling request:');
                    return await c.text('500 Internal Server Error', 500);
                }
            }, (logger) => {
                logger.addContexts({
                    requestId: c.req.header('x-request-id') || undefined,
                    path: c.req.path, method: c.req.method, url: c.req.url
                });
            }, () => {
                return { status: c.res.status };
            }
        )
    );

    // Cognito callback route (POST)
    app.get('/cognito', async (c) => {
        const logger = getLogger();
        logger.info('Handling Cognito callback...');
        try {
            const code = c.req.query('code');
            if (!code) {
                return c.json({ error: 'Authorization code is missing' }, 400);
            }

            // Exchange the code for tokens
            const awsRegion = process.env.AWS_REGION || c.env.AWS_REGION;
            const url = `https://${process.env.COGNITO_USER_POOL_DOMAIN}.auth.${awsRegion}.amazoncognito.com/oauth2/token`
            const method = 'POST';
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            };
            const grant_type = 'authorization_code'
            const client_id = process.env.COGNITO_CLIENT_ID
            const redirect_uri = `${process.env.API_GATEWAY_URL}/cognito`

            logger.debug('Token exchange request details:', {
                url,
                method,
                headers,
                body: {
                    grant_type,
                    client_id,
                    code,
                    redirect_uri,
                },
            });
            const tokenResponse = await fetch(url, {
                method,
                headers,
                body: new URLSearchParams({
                    grant_type,
                    client_id,
                    code,
                    redirect_uri,
                }),
            });
            logger.debug('Token response:', tokenResponse.status, tokenResponse.statusText);

            if (!tokenResponse.ok) {
                const error = await tokenResponse.json();
                logger.error(error, 'Error exchanging code for tokens:');
                return c.json({ error: 'Failed to exchange code for tokens' }, 500);
            }

            const tokens = await tokenResponse.json();
            logger.debug('Received tokens:', tokens);
            // c.req.session.user = {
            //     accessToken: tokens.access_token,
            //     email: userInfo.email,
            //     emailVerified: userInfo.email_verified,
            //     id: userInfo.username,
            //   };

            // set cookies on the response and redirect to the index
            setCookie(c, 'access_token', tokens.access_token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
            setCookie(c, 'id_token', tokens.id_token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
            setCookie(c, 'refresh_token', tokens.refresh_token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
            // setCookie(c, 'user', JSON.stringify(c.req.session.user), { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
            return c.redirect('/');
        } catch (error) {
            // logger.error('Error handling Cognito callback:', error);
            logger.error(error, 'Error handling Cognito callback:');
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
};
