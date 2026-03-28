import { apiFetch } from './fetch-utils.js';

// Script 1: Load reusable navigation bar and include its styles so responsive
// rules apply correctly.  Only injects site-nav.js once even if this module is
// evaluated more than once.
document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('site-nav-container');
    if (!navContainer) return;

    try {
        const navResp = await fetch('site-nav.html');
        if (!navResp.ok) return;
        const html = await navResp.text();

        navContainer.innerHTML = html;

        // Load site-nav.js only if not already present on the page
        if (!document.querySelector('script[src="site-nav.js"]')) {
            const script = document.createElement('script');
            script.src = 'site-nav.js';
            document.body.appendChild(script);
        }
    } catch (err) {
        // silently fail but keep page usable
        console.error('Failed to load site-nav:', err);
    }
});

// Script 2: Defensive deduplication — if the form appears more than once
// (duplicate insertion), keep only the first.
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('#emailLoginForm');
    if (forms.length > 1) {
        // Remove duplicates but keep the first occurrence
        for (let i = 1; i < forms.length; i++) {
            forms[i].remove();
        }
    }
});

// Script 3: Form interaction handlers.
document.addEventListener('DOMContentLoaded', function() {
    const emailForm = document.getElementById('emailLoginForm');
    const validationForm = document.getElementById('validationForm');
    const validationEmailInput = document.getElementById('validationEmail');
    const codeInput = document.getElementById('code');
    const changeEmailBtn = document.getElementById('changeEmailBtn');

    // Show the validation form with the provided email and hide the email form
    function showValidationForm(email) {
        validationEmailInput.value = email;
        emailForm.style.display = 'none';
        validationForm.style.display = 'block';
        if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
        }
    }

    // Return to the email form so the user can correct their address
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
            const response = await apiFetch('/email-request-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (response.ok) {
                alert('Login link sent to your email address.');
                showValidationForm(email);
            } else {
                alert('Error sending login validation code. Please try again. ' + response.statusText);
            }
        } catch (err) {
            console.error(err);
            alert('Error sending login validation code.');
        }
    };

    // Handle validation form submit (validate code)
    validationForm.onsubmit = async function(e) {
        e.preventDefault();
        const email = (validationEmailInput.value || '').trim();
        const code = (codeInput && codeInput.value || '').trim();
        if (!code) {
            alert('Please enter the validation code.');
            return;
        }
        try {
            const validateResp = await apiFetch('/email-validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, validationCode: code })
            });
            if (validateResp.ok) {
                const data = await validateResp.json();
                // Store token and redirect (cookie set to expire in ~60 days)
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('memberId', data.memberId);
                const _expires = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toUTCString();
                const _attrs = [`expires=${_expires}`, 'path=/', 'SameSite=Lax'];
                if (location.protocol === 'https:') _attrs.push('Secure');
                document.cookie = `actsix=${encodeURIComponent(data.token)}; ${_attrs.join('; ')}`;
                window.location.href = '/';
            } else {
                alert('Invalid code. Please try again.');
            }
        } catch (err) {
            console.error(err);
            alert('Error validating code.');
        }
    };

    // Allow user to change the email and go back to the first step
    changeEmailBtn.addEventListener('click', function() {
        // copy current validation email back to the email field so it's easy to edit
        const emailField = emailForm.querySelector('[name="email"]');
        if (emailField) emailField.value = validationEmailInput.value || '';
        showEmailForm();
    });
});
