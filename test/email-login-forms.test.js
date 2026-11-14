import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../site/fetch-utils.js', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../site/fetch-utils.js';
import { ensureLoginStorage, initializeEmailLoginForms } from '../site/email-login-forms.js';

describe('email login storage', () => {
    let elements;
    let cookies;
    let writes;
    let allowCookies;
    let pageWindow;

    beforeEach(() => {
        cookies = new Map();
        writes = [];
        allowCookies = true;
        const form = () => ({ style: {}, addEventListener: vi.fn(), querySelector: vi.fn() });
        elements = {
            emailLoginForm: { ...form(), email: { value: 'member@example.test' } },
            validationForm: form(),
            validationEmail: { value: 'member@example.test' },
            code: { value: '123456', focus: vi.fn() },
            changeEmailBtn: { addEventListener: vi.fn() },
            loginStorageError: { hidden: true },
            loginStorageErrorMessage: { textContent: '' }
        };
        pageWindow = { self: {}, top: {}, isSecureContext: true, location: { href: '' } };
        const document = {
            getElementById: id => elements[id],
            get cookie() {
                return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
            },
            set cookie(value) {
                writes.push(value);
                if (!allowCookies) return;
                const [pair] = value.split(';');
                const [name, content] = pair.split('=');
                if (value.includes('max-age=0')) cookies.delete(name);
                else cookies.set(name, content);
            }
        };
        vi.stubGlobal('window', pageWindow);
        vi.stubGlobal('document', document);
        vi.stubGlobal('location', { protocol: 'https:' });
        vi.stubGlobal('localStorage', { setItem: vi.fn() });
        vi.stubGlobal('alert', vi.fn());
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        apiFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('sets a secure cross-site cookie and redirects after embedded login', async () => {
        apiFetch.mockResolvedValue({ token: 'token', memberId: 'member' });
        initializeEmailLoginForms();
        await elements.validationForm.onsubmit({ preventDefault() {} });
        expect(writes.at(-1)).toContain('SameSite=None; Secure');
        expect(pageWindow.location.href).toBe('/');
    });

    it('preserves SameSite=Lax for top-level login', async () => {
        pageWindow.top = pageWindow.self;
        apiFetch.mockResolvedValue({ token: 'token', memberId: 'member' });
        initializeEmailLoginForms();
        await elements.validationForm.onsubmit({ preventDefault() {} });
        expect(writes.at(-1)).toContain('SameSite=Lax; Secure');
        expect(pageWindow.location.href).toBe('/');
    });

    it('requests storage access during the email submission when cookies are blocked', async () => {
        allowCookies = false;
        document.requestStorageAccess = vi.fn(() => {
            allowCookies = true;
            return Promise.resolve();
        });
        apiFetch.mockResolvedValue({ message: 'sent' });
        initializeEmailLoginForms();
        const submission = elements.emailLoginForm.onsubmit({ preventDefault() {} });
        expect(document.requestStorageAccess).toHaveBeenCalledOnce();
        await submission;
        expect(apiFetch).toHaveBeenCalledOnce();
        expect(elements.validationForm.style.display).toBe('block');
    });

    it('shows a direct-login fallback when storage access is denied', async () => {
        allowCookies = false;
        document.requestStorageAccess = vi.fn().mockRejectedValue(new Error('denied'));
        initializeEmailLoginForms();
        await elements.emailLoginForm.onsubmit({ preventDefault() {} });
        expect(apiFetch).not.toHaveBeenCalled();
        expect(elements.loginStorageError.hidden).toBe(false);
        expect(elements.loginStorageErrorMessage.textContent).toContain('did not grant cookie access');
    });

    it('does not redirect when the login cookie is blocked', async () => {
        allowCookies = false;
        apiFetch.mockResolvedValue({ token: 'token', memberId: 'member' });
        initializeEmailLoginForms();
        await elements.validationForm.onsubmit({ preventDefault() {} });
        expect(pageWindow.location.href).toBe('');
        expect(elements.loginStorageErrorMessage.textContent).toContain('blocked the login cookie');
    });

    it('rejects insecure embedded contexts', async () => {
        pageWindow.isSecureContext = false;
        await expect(ensureLoginStorage()).rejects.toThrow('requires HTTPS');
    });

    it('rejects a storage grant that does not enable cookies', async () => {
        allowCookies = false;
        document.requestStorageAccess = vi.fn().mockResolvedValue();
        await expect(ensureLoginStorage()).rejects.toThrow('still blocks cookies');
    });
});
