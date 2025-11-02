import { getCookie } from 'hono/cookie';
import { authenticateUser, findMemberByEmail, generateToken, generateAndSendValidationCode, verifyToken } from '../auth.js';
import { addContext, follow, getLogger } from '../logger.js';

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
                    c.req.memberId = decoded.id;
                    c.req.role = decoded.role;
                    logger.info("already logged in, calling next");
                    return await next();
                }
            }

            if(c.req.path.startsWith("/email") || c.req.path.endsWith(".js") || c.req.path.endsWith(".css") || c.req.path.endsWith(".png") || c.req.path.endsWith(".jpg") || c.req.path.endsWith(".jpeg") || c.req.path.endsWith(".gif") || c.req.path.endsWith(".ico") ) {
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
                path: c.req.path, method: c.req.method, url: c.req.url
            });
        }, () => {
            return { status: c.res.status };
        }
    ));

  app.post('/email-validate', async (c) => {
    const logger = getLogger();
    try {
      const { email, validationCode } = await c.req.json();
      const user = await authenticateUser(email, validationCode);
      if (!user) {
        return c.status(401).json({ error: 'Invalid email or validation code' });
      }
      const token = generateToken(user);
      return c.json({ token });
    } catch (error) {
      logger.error(error, 'Error during email login:');
      return c.status(500).json({ error: 'Internal server error' });
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
        return c.status(404).json({ error: 'Member not found' });
      }
      const validationCode = await generateAndSendValidationCode(email);
      return c.json({ message: 'Validation code sent' });
    } catch (error) {
      logger.error(error, 'Error requesting validation code:');
      return c.status(500).json({ error: 'Internal server error' });
    }
  });
};
