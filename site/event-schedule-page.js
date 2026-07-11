import { apiFetch } from './fetch-utils.js';

const form = document.getElementById('eventScheduleForm');
const eventTypeSelect = document.getElementById('eventType');
const pageMessage = document.getElementById('pageMessage');

document.addEventListener('DOMContentLoaded', async () => {
  await loadNav();
  setSmartDefaults();
  await loadSchedulableEventTypes();
});

async function loadNav() {
  const navContainer = document.getElementById('site-nav-container');
  if (!navContainer) {
    return;
  }

  const navResp = await fetch('site-nav.html');
  if (!navResp.ok) {
    return;
  }

  navContainer.innerHTML = await navResp.text();
  const script = document.createElement('script');
  script.src = 'site-nav.js';
  document.body.appendChild(script);
}

function setSmartDefaults() {
  const dateInput = document.getElementById('serviceDate');
  const timeInput = document.getElementById('serviceTime');
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  updateDefaultTime();
  dateInput.addEventListener('change', updateDefaultTime);
  timeInput.addEventListener('input', () => {
    timeInput.dataset.userEdited = 'true';
  });
}

function updateDefaultTime() {
  const dateInput = document.getElementById('serviceDate');
  const timeInput = document.getElementById('serviceTime');
  if (timeInput.dataset.userEdited === 'true') {
    return;
  }

  const date = new Date(`${dateInput.value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return;
  }

  timeInput.value = date.getDay() === 0 ? '08:30' : '19:00';
}

function showMessage(message, isError) {
  pageMessage.style.display = 'block';
  pageMessage.className = `api-status ${isError ? 'disconnected' : 'connected'}`;
  pageMessage.textContent = message;
}

async function loadSchedulableEventTypes() {
  const response = await apiFetch('/api/events/types');
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    showMessage(body.message || 'Failed to load event types.', true);
    return;
  }

  const eventTypes = Array.isArray(body.eventTypes) ? body.eventTypes : [];
  if (eventTypes.length === 0) {
    eventTypeSelect.innerHTML = '<option value="">No event types available</option>';
    eventTypeSelect.disabled = true;
    showMessage('No event types are available for your role.', true);
    return;
  }

  eventTypeSelect.innerHTML = [
    '<option value="">Choose an event type...</option>',
    ...eventTypes.map(type => `<option value="${escapeHtml(type.eventType)}">${escapeHtml(type.title)}</option>`)
  ].join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const eventType = eventTypeSelect.value;
  if (!eventType) {
    showMessage('Please choose an event type.', true);
    return;
  }

  const payload = {
    eventType,
    serviceDate: document.getElementById('serviceDate').value,
    serviceTime: document.getElementById('serviceTime').value
  };

  const response = await apiFetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    showMessage(responseBody.message || 'Failed to create event.', true);
    return;
  }

  const eventId = responseBody.id || responseBody.event?._id;
  showMessage('Event created successfully. Redirecting to sign ups...', false);
  const target = eventId
    ? `/sign-ups.html?created=${encodeURIComponent(eventId)}`
    : '/sign-ups.html';
  window.location.href = target;
});
