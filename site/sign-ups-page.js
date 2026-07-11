import { apiFetch } from './fetch-utils.js';
const pageMessage = document.getElementById('pageMessage');
const eventsList = document.getElementById('eventsList');
const canViewAssignments = window.__CAN_VIEW_ASSIGNMENTS__ === true;

let currentMemberId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadNav();
  currentMemberId = localStorage.getItem('memberId');

  await loadExistingEvents();
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

function showMessage(message, isError) {
  pageMessage.style.display = 'block';
  pageMessage.className = `api-status ${isError ? 'disconnected' : 'connected'}`;
  pageMessage.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderStatusBadge(status) {
  const color = status?.color || 'red';
  const backgroundByColor = {
    red: '#fde7e7',
    yellow: '#fff5d6',
    green: '#e2f5e7'
  };
  const textByColor = {
    red: '#9f1c1c',
    yellow: '#8a6500',
    green: '#136f2d'
  };

  return `<span class="status-badge" style="background:${backgroundByColor[color]}; color:${textByColor[color]};">${color.toUpperCase()}</span>`;
}

function getSignupForMember(eventDetails) {
  const signups = Array.isArray(eventDetails?.signups) ? eventDetails.signups : [];
  return signups.find(signup => signup.memberId === currentMemberId) || null;
}

function buildAssignmentText(signup) {
  if (!signup) {
    return 'Not responded';
  }
  if (!signup.isAvailable) {
    return 'Marked unavailable';
  }
  if (signup.assignedPositionId) {
    return `Assigned to ${signup.assignedPositionId}`;
  }
  return 'Available';
}

async function loadExistingEvents() {
  const response = await apiFetch('/api/events');
  if (!response.ok) {
    eventsList.innerHTML = '<div style="color:#b30000;">Could not load scheduled events.</div>';
    return;
  }

  const body = await response.json();
  const events = body.events || [];

  if (!events.length) {
    eventsList.innerHTML = '<div style="color:#666;">No upcoming events scheduled yet.</div>';
    return;
  }

  const eventDetails = await Promise.all(events.map(async event => {
    const detailResponse = await apiFetch(`/api/events/${encodeURIComponent(event._id)}`);
    if (!detailResponse.ok) {
      return { event, signups: [] };
    }
    const detailBody = await detailResponse.json();
    return detailBody;
  }));

  eventsList.innerHTML = eventDetails.map(detail => {
    const event = detail.event || detail;
    const signup = getSignupForMember(detail);
    const filledCount = event.status?.filledCount || 0;
    const totalPositions = event.status?.totalPositions || event.neededCount || 0;
    const availableActive = signup && signup.isAvailable;
    const unavailableActive = signup && signup.isAvailable === false;
    const availabilityActions = [
      !availableActive
        ? `<button type="button" class="btn signup-action-btn" data-event-id="${escapeHtml(event._id)}" data-available="true">Available</button>`
        : '',
      !unavailableActive
        ? `<button type="button" class="btn signup-action-btn" data-event-id="${escapeHtml(event._id)}" data-available="false">Unavailable</button>`
        : ''
    ].filter(Boolean).join('');

    return `
      <div style="border:1px solid #ddd; border-radius:10px; padding:16px; background:#fff;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <div style="font-weight:600; font-size:1.05em;">${escapeHtml(event.title || `${event.serviceDate} ${event.serviceTime}`)}</div>
            <div style="color:#666; margin-top:4px;">${escapeHtml(event.serviceDate || '')} at ${escapeHtml(event.serviceTime || '')}</div>
          </div>
          <div>${renderStatusBadge(event.status)}</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          <span class="status-badge">Filled: ${filledCount}/${totalPositions}</span>
          <span class="status-badge">Your status: ${escapeHtml(buildAssignmentText(signup))}</span>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:14px;">
          ${availabilityActions}
          ${canViewAssignments ? `<a href="/event-assignments.html?eventId=${encodeURIComponent(event._id)}" class="btn" style="text-decoration:none; display:inline-flex; align-items:center;">Assignments</a>` : ''}
        </div>
      </div>
    `;
  }).join('');

  Array.from(document.querySelectorAll('.signup-action-btn')).forEach(button => {
    button.addEventListener('click', async () => {
      const eventId = button.dataset.eventId;
      const isAvailable = button.dataset.available === 'true';
      await updateAvailability(eventId, isAvailable);
    });
  });
}

async function updateAvailability(eventId, isAvailable) {
  const response = await apiFetch(`/api/events/${encodeURIComponent(eventId)}/signups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isAvailable })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    showMessage(body.message || 'Failed to update availability.', true);
    return;
  }

  showMessage('Availability updated.', false);
  await loadExistingEvents();
}
