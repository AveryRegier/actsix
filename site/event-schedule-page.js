import { apiFetch } from './fetch-utils.js';

const form = document.getElementById('eventScheduleForm');
const eventTypeSelect = document.getElementById('eventType');
const pageMessage = document.getElementById('pageMessage');
const serviceTimeInput = document.getElementById('serviceTime');
const addServiceTimeButton = document.getElementById('addServiceTimeBtn');
const serviceTimesList = document.getElementById('serviceTimesList');
const serviceTimesHelp = document.getElementById('serviceTimesHelp');

const selectedServiceTimes = new Set();

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
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  updateDefaultTimes();
  dateInput.addEventListener('change', updateDefaultTimes);
  serviceTimeInput.addEventListener('input', () => {
    serviceTimeInput.dataset.userEdited = 'true';
  });

  addServiceTimeButton.addEventListener('click', () => {
    addServiceTimeFromInput();
  });

  serviceTimeInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    addServiceTimeFromInput();
  });

  renderSelectedServiceTimes();
}

function updateDefaultTimes() {
  const dateInput = document.getElementById('serviceDate');
  if (serviceTimeInput.dataset.userEdited === 'true' || serviceTimesList.dataset.userEdited === 'true') {
    return;
  }

  const date = new Date(`${dateInput.value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return;
  }

  const defaults = date.getDay() === 0 ? ['08:30', '10:30'] : ['19:00'];
  selectedServiceTimes.clear();
  for (const time of defaults) {
    selectedServiceTimes.add(time);
  }
  serviceTimeInput.value = defaults[0];
  renderSelectedServiceTimes();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSelectedServiceTimes() {
  const sortedTimes = Array.from(selectedServiceTimes).sort();
  if (sortedTimes.length === 0) {
    serviceTimesList.innerHTML = '<div style="color:#666;">No service times added yet.</div>';
    serviceTimesHelp.textContent = 'Add at least one service time.';
    return;
  }

  serviceTimesHelp.textContent = `${sortedTimes.length} time${sortedTimes.length === 1 ? '' : 's'} selected.`;
  serviceTimesList.innerHTML = sortedTimes
    .map(time => `
      <button type="button" class="btn" data-remove-service-time="${escapeHtml(time)}" style="padding:6px 10px; font-size:14px;">
        ${escapeHtml(time)} ×
      </button>
    `)
    .join('');

  for (const removeButton of serviceTimesList.querySelectorAll('[data-remove-service-time]')) {
    removeButton.addEventListener('click', () => {
      const time = removeButton.getAttribute('data-remove-service-time');
      if (!time) {
        return;
      }
      selectedServiceTimes.delete(time);
      serviceTimesList.dataset.userEdited = 'true';
      renderSelectedServiceTimes();
    });
  }
}

function addServiceTimeFromInput() {
  const time = serviceTimeInput.value;
  if (!time) {
    return;
  }

  selectedServiceTimes.add(time);
  serviceTimesList.dataset.userEdited = 'true';
  serviceTimeInput.dataset.userEdited = 'true';
  renderSelectedServiceTimes();
}

function includePendingTimeInput() {
  const pending = serviceTimeInput.value;
  if (!pending) {
    return;
  }

  selectedServiceTimes.add(pending);
  renderSelectedServiceTimes();
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // If the user typed a time but did not click Add, include it automatically.
  includePendingTimeInput();

  const eventType = eventTypeSelect.value;
  if (!eventType) {
    showMessage('Please choose an event type.', true);
    return;
  }

  if (selectedServiceTimes.size === 0) {
    showMessage('Please add at least one service time.', true);
    return;
  }

  const payload = {
    eventType,
    serviceDate: document.getElementById('serviceDate').value,
    serviceTimes: Array.from(selectedServiceTimes).sort(),
    serviceTime: Array.from(selectedServiceTimes).sort()[0]
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
  const createdCount = Number(responseBody.count || payload.serviceTimes.length || 1);
  const autoCount = Number(responseBody.autoScheduledCount || 0);
  showMessage(`Created ${createdCount} event${createdCount === 1 ? '' : 's'}${autoCount > 0 ? ` and auto-scheduled ${autoCount} linked event${autoCount === 1 ? '' : 's'}` : ''}. Redirecting to sign ups...`, false);
  const target = eventId
    ? `/sign-ups.html?created=${encodeURIComponent(eventId)}`
    : '/sign-ups.html';
  window.location.href = target;
});
