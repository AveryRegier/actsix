import {
    deduplicateEmailLoginForm,
    initializeEmailLoginForms,
    loadSiteNav
} from './email-login-forms.js';

document.addEventListener('DOMContentLoaded', loadSiteNav);
document.addEventListener('DOMContentLoaded', deduplicateEmailLoginForm);
document.addEventListener('DOMContentLoaded', initializeEmailLoginForms);
