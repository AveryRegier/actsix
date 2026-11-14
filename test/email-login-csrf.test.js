import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import registerEmailLoginRoutes from '../src/auth/email-login.js';

describe('cookie-authenticated requests', () => {
    let app;
    let token;
    let originalSecret;

    beforeEach(() => {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = 'test-secret';
        token = jwt.sign({ id: 'member', role: 'deacon' }, process.env.JWT_SECRET);
        app = new Hono();
        registerEmailLoginRoutes(app);
        app.post('/protected', c => c.text('ok'));
        app.get('/protected', c => c.text('ok'));
    });

    afterEach(() => {
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    const request = (app, token, method, headers = {}) => app.request('https://app.example.test/protected', {
        method,
        headers: { cookie: `actsix=${token}`, ...headers }
    });

    it('allows same-origin form and fetch requests', async () => {
        expect((await request(app, token, 'POST', { origin: 'https://app.example.test' })).status).toBe(200);
        expect((await request(app, token, 'POST', { 'sec-fetch-site': 'same-origin' })).status).toBe(200);
        expect((await request(app, token, 'GET')).status).toBe(200);
    });

    it('rejects cross-origin and unverifiable cookie-authenticated writes', async () => {
        expect((await request(app, token, 'POST', { origin: 'https://attacker.example.test' })).status).toBe(403);
        expect((await request(app, token, 'POST', { origin: 'null' })).status).toBe(403);
        expect((await request(app, token, 'POST', { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
        expect((await request(app, token, 'POST')).status).toBe(403);
    });

    it('preserves bearer-authenticated server-to-server writes', async () => {
        const response = await app.request('https://app.example.test/protected', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` }
        });
        expect(response.status).toBe(200);
    });
});
