import { apiFetch } from './fetch-utils.js';

const params = new URLSearchParams(window.location.search);
const eventId = params.get('eventId');
const serviceDate = params.get('serviceDate');

const pageMessage = document.getElementById('pageMessage');
const assignmentHeader = document.getElementById('assignmentHeader');
const openPositionsCallout = document.getElementById('openPositionsCallout');
const assignmentsTableWrap = document.getElementById('assignmentsTableWrap');

document.addEventListener('DOMContentLoaded', async () => {
  await loadNav();
  document.getElementById('printAssignmentsBtn').addEventListener('click', () => window.print());

  if (!eventId && !serviceDate) {
    showMessage('Missing eventId or serviceDate.', true);
    return;
  }

  if (serviceDate) {
    await loadAssignmentsForDate(serviceDate);
    return;
  }

  await loadAssignmentsForEvent(eventId);
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
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function renderFilledBadge(status) {
  const colors = getStatusColors(status);
  const filledCount = status?.filledCount || 0;
  const totalPositions = status?.totalPositions || 0;
  return `<span class="status-badge" style="background:${colors.background}; color:${colors.text};">Filled: ${filledCount}/${totalPositions}</span>`;
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

function renderAssignmentsTable(event) {
  return `
    <table class="summary-table">
      <thead>
        <tr>
          <th>Priority</th>
          <th>Position ID</th>
          <th>Label</th>
          <th>Assigned To</th>
        </tr>
      </thead>
      <tbody>
        ${event.positions.map(position => `
          <tr>
            <td>${escapeHtml(position.priority)}</td>
            <td>${escapeHtml(position.positionId)}</td>
            <td>${escapeHtml(position.label)}</td>
            <td>${position.assignedMember ? `${escapeHtml(position.assignedMember.firstName)} ${escapeHtml(position.assignedMember.lastName)}` : '<span style="color:#b30000;">Open</span>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAssignmentBlock(event, openPositions) {
  const openNames = (openPositions || []).map(position => escapeHtml(position.label));
  const callout = openNames.length
    ? `<div style="background:#fff5d6; border:1px solid #e3c976; border-radius:8px; padding:12px; margin-top:10px;"><strong>Open positions needed:</strong> ${openNames.join(', ')}</div>`
    : '<div style="background:#e2f5e7; border:1px solid #98c5a2; border-radius:8px; padding:12px; margin-top:10px;"><strong>All positions are currently filled.</strong></div>';

  return `
    <section style="border:1px solid #d7dce3; border-radius:10px; padding:14px; background:#fff; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
        <div>
          <div style="font-weight:600; font-size:1.1em;">${escapeHtml(event.serviceTime || '')} - ${escapeHtml(event.title || '')}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
        ${renderFilledBadge(event.status)}
      </div>
      ${callout}
      <div style="margin-top:14px;">
        ${renderAssignmentsTable(event)}
      </div>
    </section>
  `;
}

async function loadAssignmentsForEvent(calendarEventId) {
  const response = await apiFetch(`/api/events/${encodeURIComponent(calendarEventId)}/assignments`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    showMessage(body.message || 'Failed to load assignments.', true);
    return;
  }

  const event = body.event;
  const openPositions = body.openPositions || [];

  assignmentHeader.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
      <div>
        <div style="font-weight:600; font-size:1.15em;">${escapeHtml(event.title || '')}</div>
        <div style="color:#666; margin-top:4px;">${escapeHtml(event.serviceDate || '')} at ${escapeHtml(event.serviceTime || '')}</div>
      </div>
    </div>
  `;

  openPositionsCallout.innerHTML = '';
  assignmentsTableWrap.innerHTML = renderAssignmentBlock(event, openPositions);
}

async function loadAssignmentsForDate(date) {
  const eventsResponse = await apiFetch(`/api/events?serviceDate=${encodeURIComponent(date)}`);
  const eventsBody = await eventsResponse.json().catch(() => ({}));
  if (!eventsResponse.ok) {
    showMessage(eventsBody.message || 'Failed to load events for this date.', true);
    return;
  }

  const events = Array.isArray(eventsBody.events) ? eventsBody.events : [];
  if (events.length === 0) {
    showMessage('No events found for this date.', true);
    return;
  }

  assignmentHeader.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
      <div>
        <div style="font-weight:600; font-size:1.15em;">Assignments for ${escapeHtml(formatDateHeading(date))}</div>
      </div>
      <div><span class="status-badge">${events.length} events</span></div>
    </div>
  `;
  openPositionsCallout.innerHTML = '';

  const assignmentBodies = await Promise.all(events.map(async (event) => {
    const response = await apiFetch(`/api/events/${encodeURIComponent(event._id)}/assignments`);
    if (!response.ok) {
      return null;
    }

    const body = await response.json().catch(() => null);
    if (!body?.event) {
      return null;
    }

    return body;
  }));

  const validAssignments = assignmentBodies.filter(Boolean);
  if (validAssignments.length === 0) {
    showMessage('No printable assignments available for this date.', true);
    return;
  }

  validAssignments.sort((a, b) => String(a.event.serviceTime || '').localeCompare(String(b.event.serviceTime || '')));
  assignmentsTableWrap.innerHTML = validAssignments
    .map(body => renderAssignmentBlock(body.event, body.openPositions || []))
    .join('');
}
