import { getCookie } from 'hono/cookie';
import { authenticateUser, findMemberByEmail, generateToken, generateAndSendValidationCode, verifyToken } from './auth.js';
import { addContext, follow, getLogger } from '../util/logger.js';

export default function registerEmailLoginRoutes(app) {
    app.use('*', async (c, next) => await follow(async () => {
        const logger = getLogger();
        try {
            // if they are not logged, sent to a page to gather their email address and send code

            // extract user information from the cookies in the request
            const actsixCookie = getCookie(c, 'actsix');
            if (actsixCookie) {
                const decoded = verifyToken(actsixCookie);  
                if (decoded) {
                    // already logged in
                    c.req.memberId = addContext("memberId", decoded.id);
                    c.req.role = addContext("role", decoded.role);
                    logger.info("already logged in, calling next");
                    return await next();
                }
            }

            // Check for JWT in Authorization header (for server-to-server calls)
            const authHeader = (c.req.header('authorization') || '').toString();
            if (authHeader.startsWith('Bearer ')) {
                const token = authHeader.slice(7);
                const decoded = verifyToken(token);
                if (decoded) {
                    c.req.memberId = addContext("memberId", decoded.id);
                    c.req.role = addContext("role", decoded.role);
                    logger.info("authenticated via Authorization header");
                    return await next();
                }
            }

            // Extract API-key header for scripted generation (fast automation). If provided and matches
            // the configured GENERATION_API_KEY, consider the request authenticated as a script user.
            const generationKey = process.env.GENERATION_API_KEY;
            const xApiKey = c.req.header('x-api-key') || '';

            if (generationKey && xApiKey) {
                const token = xApiKey;
                if (token === generationKey) {
                    // Authenticated as a scripted generator: grant high privileges for seeding
                    const memberId = 'script-generator';
                    const role = 'deacon';
                    // Do not set persistent cookies here; this is for script-based automation only
                    addContext('auth_method', 'generation_api_key');

                    c.req.memberId = addContext("memberId", memberId); // Save memberId as an attribute on the request
                    c.req.role = addContext("role", role); // Save role as an attribute on the request

                    return await next();
                }
            }


            if(c.req.path.startsWith("/email") || c.req.path.startsWith("/form") || c.req.path.endsWith(".js") || c.req.path.endsWith(".css") || c.req.path.endsWith(".png") || c.req.path.endsWith(".jpg") || c.req.path.endsWith(".jpeg") || c.req.path.endsWith(".gif") || c.req.path.endsWith(".ico") ) {
                return await next();
            }
            if(c.req.path.endsWith(".html") || c.req.path === "/" ) {
                // otherwise redirect to email login page
                return c.redirect('/email-login.html');
            }
            return c.json({ error: 'Unauthorized access' }, 403);
        } catch (error) {
            logger.error(error, 'Error handling request:');
            return await c.text('500 Internal Server Error', 500);
        }}, (logger) => {
            logger.addContexts({
                requestId: c.req.header('x-request-id') || undefined,
                path: c.req.path, method: c.req.method, url: c.req.url,
                method: c.req.method
            });
        }, () => {
            return { status: c.res.status };
        }
    ));

  app.use('/email*', async (c, next) => {
    addContext('routeType', 'auth');
    return await next();
  });

  app.post('/email-validate', async (c) => {
    const logger = getLogger();
    try {
      const { email, validationCode } = await c.req.json();
      const user = await authenticateUser(email, validationCode);
      if (!user) {
        return c.text('Invalid email or validation code', 401);
      }
      const token = generateToken(user);
      return c.json({ token, memberId: user._id });
    } catch (error) {
      logger.error(error, 'Error during email login:');
      return c.text('Internal server error', 500);
    }
  });

  app.post('/email-request-code', async (c) => {
    const logger = getLogger();
    try {
      const { email } = await c.req.json();
      addContext('email', email);
      // first see if the email exists in the members collection
      const member = await findMemberByEmail(email);
      if (!member) {
        return c.text('Member not found', 404);
      }
      await generateAndSendValidationCode(member);
      return c.json({ message: 'Validation code sent' });
    } catch (error) {
      logger.error(error, 'Error requesting validation code:');
      return c.text('Internal server error', 500);
    }
  });
};
