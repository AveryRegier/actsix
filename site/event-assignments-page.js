import { apiFetch } from './fetch-utils.js';

const params = new URLSearchParams(window.location.search);
const eventId = params.get('eventId');

const pageMessage = document.getElementById('pageMessage');
const assignmentHeader = document.getElementById('assignmentHeader');
const openPositionsCallout = document.getElementById('openPositionsCallout');
const assignmentsTableWrap = document.getElementById('assignmentsTableWrap');

document.addEventListener('DOMContentLoaded', async () => {
  await loadNav();
  document.getElementById('printAssignmentsBtn').addEventListener('click', () => window.print());

  if (!eventId) {
    showMessage('Missing eventId.', true);
    return;
  }

  await loadAssignments();
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

async function loadAssignments() {
  const response = await apiFetch(`/api/events/${encodeURIComponent(eventId)}/assignments`);
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
      <div>${renderStatusBadge(event.status)}</div>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
      <span class="status-badge">Filled: ${event.status?.filledCount || 0}/${event.status?.totalPositions || 0}</span>
    </div>
  `;

  openPositionsCallout.innerHTML = openPositions.length
    ? `<div style="background:#fff5d6; border:1px solid #e3c976; border-radius:8px; padding:12px;"><strong>Open positions needed:</strong> ${openPositions.map(position => escapeHtml(position.label)).join(', ')}</div>`
    : '<div style="background:#e2f5e7; border:1px solid #98c5a2; border-radius:8px; padding:12px;"><strong>All positions are currently filled.</strong></div>';

  assignmentsTableWrap.innerHTML = `
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
