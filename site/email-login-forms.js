import { apiFetch } from './fetch-utils.js';

function isEmbedded() {
    return window.self !== window.top;
}

function hasCrossSiteCookieAccess() {
    const name = 'actsix_storage_probe';
    document.cookie = `${name}=1; path=/; SameSite=None; Secure`;
    const available = document.cookie.split(';').some(part => part.trim() === `${name}=1`);
    document.cookie = `${name}=; path=/; SameSite=None; Secure; max-age=0`;
    return available;
}

export async function ensureLoginStorage() {
    if (!isEmbedded()) return;
    if (!window.isSecureContext || location.protocol !== 'https:') {
        throw new Error('Embedded login requires HTTPS for both the forwarding page and the app.');
    }
    if (hasCrossSiteCookieAccess()) return;
    if (typeof document.requestStorageAccess !== 'function') {
        throw new Error('Your browser blocks cookies in the embedded app.');
    }
    try {
        await document.requestStorageAccess();
    } catch (error) {
        console.error('Browser denied storage access:', error);
        throw new Error('Your browser did not grant cookie access to the embedded app.');
    }
    if (!hasCrossSiteCookieAccess()) {
        throw new Error('Your browser still blocks cookies in the embedded app.');
    }
}

export async function loadSiteNav() {
    const navContainer = document.getElementById('site-nav-container');
    if (!navContainer) return;

    try {
        const navResp = await fetch('site-nav.html');
        if (!navResp.ok) return;
        const html = await navResp.text();

        navContainer.innerHTML = html;

        // Load site-nav.js only if not already present on the page.
        if (!document.querySelector('script[src="site-nav.js"]')) {
            await new Promise(function(resolve, reject) {
                const script = document.createElement('script');
                script.src = 'site-nav.js';
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        }
    } catch (err) {
        // Silently fail but keep the page usable.
        console.error('Failed to load site-nav:', err);
    }
}

export function deduplicateEmailLoginForm() {
    const forms = document.querySelectorAll('#emailLoginForm');
    if (forms.length > 1) {
        // Remove duplicates but keep the first occurrence.
        for (let i = 1; i < forms.length; i++) {
            forms[i].remove();
        }
    }
}

export function initializeEmailLoginForms() {
    const emailForm = document.getElementById('emailLoginForm');
    const validationForm = document.getElementById('validationForm');
    const validationEmailInput = document.getElementById('validationEmail');
    const codeInput = document.getElementById('code');
    const changeEmailBtn = document.getElementById('changeEmailBtn');
    const storageError = document.getElementById('loginStorageError');
    const storageErrorMessage = document.getElementById('loginStorageErrorMessage');

    if (!emailForm || !validationForm || !validationEmailInput || !changeEmailBtn) {
        return;
    }

    function showStorageError(message) {
        console.error('Login storage error:', message);
        if (storageError && storageErrorMessage) {
            storageErrorMessage.textContent = message;
            storageError.hidden = false;
        } else {
            alert(message);
        }
    }

    // Show the validation form with the provided email and hide the email form.
    function showValidationForm(email) {
        validationEmailInput.value = email;
        emailForm.style.display = 'none';
        validationForm.style.display = 'block';
        if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
        }
    }

    // Return to the email form so the user can correct their address.
    function showEmailForm() {
        validationForm.style.display = 'none';
        emailForm.style.display = 'block';
        const emailField = emailForm.querySelector('[name="email"]');
        if (emailField) {
            emailField.focus();
        }
    }

    emailForm.onsubmit = async function(e) {
        e.preventDefault();
        const email = (emailForm.email && emailForm.email.value || '').trim();
        if (!email) {
            alert('Please enter your email address.');
            return;
        }
        try {
            await ensureLoginStorage();
            if (storageError) storageError.hidden = true;
        } catch (err) {
            showStorageError(err.message);
            return;
        }
        try {
            console.log('[emailForm.onsubmit] Requesting validation code for:', email);
            const response = await apiFetch('/email-request-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            console.log('[emailForm.onsubmit] Received response:', response);
            alert('Login link sent to your email address.');
            showValidationForm(email);
        } catch (err) {
            console.error('[emailForm.onsubmit] Error:', err);
            alert('Error sending login validation code. Please try again.');
        }
    };

    // Handle validation form submit (validate code).
    validationForm.onsubmit = async function(e) {
        e.preventDefault();
        const email = (validationEmailInput.value || '').trim();
        const code = (codeInput && codeInput.value || '').trim();
        if (!code) {
            alert('Please enter the validation code.');
            return;
        }
        try {
            console.log('[validationForm.onsubmit] Validating code for:', email);
            const data = await apiFetch('/email-validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, validationCode: code })
            });
            console.log('[validationForm.onsubmit] Validation successful, received token');
            try {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('memberId', data.memberId);
                const expires = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toUTCString();
                const attrs = [`expires=${expires}`, 'path=/', isEmbedded() ? 'SameSite=None' : 'SameSite=Lax'];
                if (location.protocol === 'https:') attrs.push('Secure');
                document.cookie = `actsix=${encodeURIComponent(data.token)}; ${attrs.join('; ')}`;
                if (!document.cookie.split(';').some(part => part.trim() === `actsix=${encodeURIComponent(data.token)}`)) {
                    throw new Error('Your browser blocked the login cookie.');
                }
            } catch (err) {
                showStorageError(`Unable to save your login: ${err.message}`);
                return;
            }
            window.location.href = '/';
        } catch (err) {
            console.error('[validationForm.onsubmit] Error:', err);
            alert('Invalid code. Please try again.');
        }
    };

    // Allow user to change the email and go back to the first step.
    changeEmailBtn.addEventListener('click', function() {
        // Copy current validation email back to the email field so it is easy to edit.
        const emailField = emailForm.querySelector('[name="email"]');
        if (emailField) emailField.value = validationEmailInput.value || '';
        showEmailForm();
    });
}
