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

function formatDateHeading(dateValue) {
  if (!dateValue) {
    return 'Unknown Date';
  }

  const parsed = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatEventActivityTitle(event) {
  const title = String(event?.title || '').trim();
  const serviceDate = String(event?.serviceDate || '').trim();
  const serviceTime = String(event?.serviceTime || '').trim();
  const prefix = serviceDate && serviceTime ? `${serviceDate} ${serviceTime} ` : '';

  if (prefix && title.startsWith(prefix)) {
    return title.slice(prefix.length).trim();
  }

  if (title) {
    return title;
  }

  return String(event?.eventType || 'Event')
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStatusColors(status) {
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

  return {
    background: backgroundByColor[color] || backgroundByColor.red,
    text: textByColor[color] || textByColor.red
  };
}

function renderFilledBadge(status, filledCount, totalPositions) {
  const colors = getStatusColors(status);

  return `<span class="status-badge" style="background:${colors.background}; color:${colors.text};">Filled: ${filledCount}/${totalPositions}</span>`;
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

function getMemberStatusColors(signup) {
  if (!signup) {
    return {
      background: '#fff5d6',
      text: '#8a6500'
    };
  }

  if (signup.isAvailable === false) {
    return {
      background: '#fde7e7',
      text: '#9f1c1c'
    };
  }

  return {
    background: '#e2f5e7',
    text: '#136f2d'
  };
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

  const byDate = new Map();
  for (const detail of eventDetails) {
    const event = detail.event || detail;
    const dateKey = String(event?.serviceDate || '').trim() || 'unknown-date';
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }
    byDate.get(dateKey).push(detail);
  }

  const sortedDateKeys = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
  const groupedMarkup = sortedDateKeys.map(dateKey => {
    const groupedEvents = byDate.get(dateKey) || [];
    groupedEvents.sort((a, b) => {
      const eventA = a.event || a;
      const eventB = b.event || b;
      return String(eventA.serviceTime || '').localeCompare(String(eventB.serviceTime || ''));
    });

    const cardsMarkup = groupedEvents.map(detail => {
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

      const activityTitle = formatEventActivityTitle(event);
      const memberStatus = getMemberStatusColors(signup);

      return `
        <div style="border:1px solid #ddd; border-radius:10px; padding:14px; background:#fff;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
            <div>
              <div style="font-weight:600; font-size:1.05em;">${escapeHtml(event.serviceTime || '')} - ${escapeHtml(activityTitle)}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
            ${renderFilledBadge(event.status, filledCount, totalPositions)}
            <span class="status-badge" style="background:${memberStatus.background}; color:${memberStatus.text};">Your status: ${escapeHtml(buildAssignmentText(signup))}</span>
          </div>
          <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:14px;">
            ${availabilityActions}
          </div>
        </div>
      `;
    }).join('');

    const dateAssignmentsLink = canViewAssignments && dateKey !== 'unknown-date'
      ? `<a href="/event-assignments.html?serviceDate=${encodeURIComponent(dateKey)}" class="btn" style="text-decoration:none; display:inline-flex; align-items:center;">Assignments</a>`
      : '';

    return `
      <section style="border:1px solid #d7dce3; border-radius:12px; padding:14px; background:#f7f9fc;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
          <h3 style="margin:0;">${escapeHtml(formatDateHeading(dateKey === 'unknown-date' ? '' : dateKey))}</h3>
          ${dateAssignmentsLink}
        </div>
        <div style="display:grid; gap:12px;">
          ${cardsMarkup}
        </div>
      </section>
    `;
  }).join('');

  eventsList.innerHTML = groupedMarkup;

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
