import { apiFetch } from './fetch-utils.js';
import { createAssignmentPicker } from './assignment-picker-widget.js';

const params = new URLSearchParams(window.location.search);
const eventId = params.get('eventId');
const serviceDate = params.get('serviceDate');

const pageMessage = document.getElementById('pageMessage');
const assignmentHeader = document.getElementById('assignmentHeader');
const openPositionsCallout = document.getElementById('openPositionsCallout');
const assignmentsTableWrap = document.getElementById('assignmentsTableWrap');

const assignmentCandidatesByEvent = new Map();
const quickAddRoleByEvent = new Map();
const allowQuickAddByEvent = new Map();
const requiredGenderByEvent = new Map();
let activeModalContext = null;
let assignmentModalPicker = null;
let assignmentModalElements = null;

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

function getMemberDisplayName(member) {
  if (!member) {
    return 'Open';
  }

  const first = String(member.firstName || '').trim();
  const last = String(member.lastName || '').trim();
  const full = `${first} ${last}`.trim();
  return full || 'Open';
}

function ensureAssignmentModal() {
  if (assignmentModalElements) {
    return assignmentModalElements;
  }

  const overlay = document.createElement('div');
  overlay.id = 'assignmentEditModal';
  overlay.tabIndex = -1;
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.35)';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '1200';

  const panel = document.createElement('div');
  panel.style.width = 'min(620px, 92vw)';
  panel.style.maxHeight = '86vh';
  panel.style.overflow = 'auto';
  panel.style.background = '#fff';
  panel.style.borderRadius = '12px';
  panel.style.padding = '16px';
  panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.22)';

  const title = document.createElement('div');
  title.style.fontSize = '1.05em';
  title.style.fontWeight = '600';
  title.style.marginBottom = '8px';

  const subtitle = document.createElement('div');
  subtitle.style.color = '#426671';
  subtitle.style.fontSize = '0.92em';
  subtitle.style.marginBottom = '12px';

  const pickerContainer = document.createElement('div');
  pickerContainer.style.marginBottom = '14px';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.justifyContent = 'flex-end';
  actions.style.flexWrap = 'wrap';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'btn';
  clearButton.textContent = 'Clear Assignment';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn';
  cancelButton.textContent = 'Cancel';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'btn';
  saveButton.textContent = 'Save';

  actions.appendChild(clearButton);
  actions.appendChild(cancelButton);
  actions.appendChild(saveButton);

  panel.appendChild(title);
  panel.appendChild(subtitle);
  panel.appendChild(pickerContainer);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeAssignmentModal();
    }
  });

  cancelButton.addEventListener('click', () => closeAssignmentModal());

  clearButton.addEventListener('click', async () => {
    if (!activeModalContext) {
      return;
    }
    await saveSinglePositionAssignment(activeModalContext.eventId, activeModalContext.positionId, null);
  });

  async function triggerModalSave() {
    if (!activeModalContext) {
      return;
    }
    const selectedMemberId = assignmentModalPicker?.getValue() || null;
    await saveSinglePositionAssignment(activeModalContext.eventId, activeModalContext.positionId, selectedMemberId);
  }

  saveButton.addEventListener('click', triggerModalSave);

  overlay.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    event.preventDefault();
    await triggerModalSave();
  });

  assignmentModalElements = {
    overlay,
    title,
    subtitle,
    pickerContainer
  };

  return assignmentModalElements;
}

function closeAssignmentModal() {
  if (!assignmentModalElements) {
    return;
  }

  assignmentModalElements.overlay.style.display = 'none';
  assignmentModalElements.pickerContainer.innerHTML = '';
  assignmentModalPicker = null;
  activeModalContext = null;
}

function openAssignmentModal(context) {
  const modal = ensureAssignmentModal();
  activeModalContext = context;
  modal.title.textContent = `Assign ${context.positionLabel}`;
  modal.subtitle.textContent = `${context.eventTime} - ${context.eventTitle}`;
  modal.overlay.style.display = 'flex';
  modal.overlay.focus();

  // Load candidates on-demand if not already cached
  loadAssignmentModalData(context);
}

async function loadAssignmentModalData(context) {
  const modal = ensureAssignmentModal();
  
  // Check if we already have candidates cached
  let candidates = assignmentCandidatesByEvent.get(context.eventId);
  let quickAddRole = quickAddRoleByEvent.get(context.eventId) || '';
  let allowQuickAdd = allowQuickAddByEvent.get(context.eventId) === true;
  let requiredGender = requiredGenderByEvent.get(context.eventId) || '';
  
  // If not cached, load from per-event endpoint
  if (!candidates) {
    try {
      const body = await apiFetch(`/api/events/${encodeURIComponent(context.eventId)}/assignments`);
      if (body) {
        candidates = Array.isArray(body.assignmentCandidates) ? body.assignmentCandidates : [];
        quickAddRole = String(body.quickAddAssigneeRole || '').trim();
        allowQuickAdd = body.allowQuickAddAssignee === true;
        requiredGender = String(body.requiredGender || '').trim().toLowerCase();
        
        // Cache for future use
        assignmentCandidatesByEvent.set(context.eventId, candidates);
        quickAddRoleByEvent.set(context.eventId, quickAddRole);
        allowQuickAddByEvent.set(context.eventId, allowQuickAdd);
        requiredGenderByEvent.set(context.eventId, requiredGender);
      }
    } catch (error) {
      showMessage('Failed to load assignment options.', true);
      closeAssignmentModal();
      return;
    }
  }
  
  candidates = candidates || [];
  
  assignmentModalPicker = createAssignmentPicker({
    container: modal.pickerContainer,
    options: candidates,
    selectedValues: context.assignedMemberId ? [context.assignedMemberId] : [],
    multi: false,
    searchPlaceholder: 'Type to filter names...',
    allowQuickAdd: allowQuickAdd && Boolean(quickAddRole),
    quickAddLabel: 'Add new member',
    quickAddRoleLabel: quickAddRole,
    quickAddRequiredGender: requiredGender,
    onQuickAdd: async ({ fullName, gender }) => {
      let body = null;
      try {
        body = await apiFetch(`/api/events/${encodeURIComponent(context.eventId)}/assignment-candidates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            role: quickAddRole,
            gender
          })
        });
      } catch (error) {
        showMessage(error?.cause?.message || error.message || 'Failed to add member.', true);
        return null;
      }

      if (!body?.candidate?._id) {
        showMessage('Failed to add member.', true);
        return null;
      }

      const currentCandidates = assignmentCandidatesByEvent.get(context.eventId) || [];
      const nextCandidates = [...currentCandidates.filter(candidate => candidate._id !== body.candidate._id), body.candidate];
      assignmentCandidatesByEvent.set(context.eventId, nextCandidates);
      showMessage(`Added ${body.candidate.firstName} ${body.candidate.lastName} as ${quickAddRole}.`, false);
      return body.candidate;
    }
  });
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

function renderAssignmentsTable(event, canManage) {
  return `
    <table class="summary-table">
      <thead>
        <tr>
          <th>Priority</th>
          <th>Position ID</th>
          <th>Label</th>
          <th>Note</th>
          <th>Assigned To</th>
        </tr>
      </thead>
      <tbody>
        ${event.positions.map(position => `
          <tr>
            <td>${escapeHtml(position.priority)}</td>
            <td>${escapeHtml(position.positionId)}</td>
            <td>${escapeHtml(position.label)}</td>
            <td>${position.note ? escapeHtml(position.note) : '<span style="color:#6d7c82;">-</span>'}</td>
            <td>
              ${canManage
                ? `<button
                    type="button"
                    class="assignment-edit-trigger"
                    data-event-id="${escapeHtml(event._id)}"
                    data-event-title="${escapeHtml(event.title || '')}"
                    data-event-time="${escapeHtml(event.serviceTime || '')}"
                    data-position-id="${escapeHtml(position.positionId)}"
                    data-position-label="${escapeHtml(position.label)}"
                    data-assigned-member-id="${escapeHtml(position.assignedMember?._id || '')}"
                    style="background:none; border:none; padding:0; margin:0; text-decoration:underline; color:${position.assignedMember ? '#1f4f5a' : '#b30000'}; cursor:pointer; font:inherit;"
                  >${escapeHtml(getMemberDisplayName(position.assignedMember))}</button>`
                : (position.assignedMember
                    ? `${escapeHtml(position.assignedMember.firstName)} ${escapeHtml(position.assignedMember.lastName)}`
                    : '<span style="color:#b30000;">Open</span>')}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAssignmentsTableWithPositions(event, positions, canManage) {
  // Variant that accepts positions as a parameter instead of reading from event.positions
  return `
    <table class="summary-table">
      <thead>
        <tr>
          <th>Priority</th>
          <th>Position ID</th>
          <th>Label</th>
          <th>Note</th>
          <th>Assigned To</th>
        </tr>
      </thead>
      <tbody>
        ${(positions || []).map(position => `
          <tr>
            <td>${escapeHtml(position.priority)}</td>
            <td>${escapeHtml(position.positionId)}</td>
            <td>${escapeHtml(position.label)}</td>
            <td>${position.note ? escapeHtml(position.note) : '<span style="color:#6d7c82;">-</span>'}</td>
            <td>
              ${canManage
                ? `<button
                    type="button"
                    class="assignment-edit-trigger"
                    data-event-id="${escapeHtml(event._id)}"
                    data-event-title="${escapeHtml(event.title || '')}"
                    data-event-time="${escapeHtml(event.serviceTime || '')}"
                    data-position-id="${escapeHtml(position.positionId)}"
                    data-position-label="${escapeHtml(position.label)}"
                    data-assigned-member-id="${escapeHtml(position.assignedMember?._id || '')}"
                    style="background:none; border:none; padding:0; margin:0; text-decoration:underline; color:${position.assignedMember ? '#1f4f5a' : '#b30000'}; cursor:pointer; font:inherit;"
                  >${escapeHtml(getMemberDisplayName(position.assignedMember))}</button>`
                : (position.assignedMember
                    ? `${escapeHtml(position.assignedMember.firstName)} ${escapeHtml(position.assignedMember.lastName)}`
                    : '<span style="color:#b30000;">Open</span>')}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderAssignmentBlock(event, openPositions, canManage, assignmentCandidates) {
  const openNames = (openPositions || []).map(position => escapeHtml(position.label));
  const callout = openNames.length
    ? `<div style="background:#fff5d6; border:1px solid #e3c976; border-radius:8px; padding:12px; margin-top:10px;"><strong>Open positions needed:</strong> ${openNames.join(', ')}</div>`
    : '<div style="background:#e2f5e7; border:1px solid #98c5a2; border-radius:8px; padding:12px; margin-top:10px;"><strong>All positions are currently filled.</strong></div>';

  const assignmentHint = canManage
    ? '<div style="margin-top:12px; background:#eef5f7; border:1px solid #c9d8de; border-radius:8px; padding:10px; color:#426671;">Click Open or an assigned name to edit assignment.</div>'
    : '';

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
        ${renderAssignmentsTable(event, canManage)}
      </div>
      ${assignmentHint}
    </section>
  `;
}

function renderAssignmentBlockWithPositions(event, positions, openPositions, canManage) {
  // Variant for when positions come from the API response, not embedded in event
  const openNames = (openPositions || []).map(position => escapeHtml(position.label));
  const callout = openNames.length
    ? `<div style="background:#fff5d6; border:1px solid #e3c976; border-radius:8px; padding:12px; margin-top:10px;"><strong>Open positions needed:</strong> ${openNames.join(', ')}</div>`
    : '<div style="background:#e2f5e7; border:1px solid #98c5a2; border-radius:8px; padding:12px; margin-top:10px;"><strong>All positions are currently filled.</strong></div>';

  const assignmentHint = canManage
    ? '<div style="margin-top:12px; background:#eef5f7; border:1px solid #c9d8de; border-radius:8px; padding:10px; color:#426671;">Click Open or an assigned name to edit assignment.</div>'
    : '';

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
        ${renderAssignmentsTableWithPositions(event, positions, canManage)}
      </div>
      ${assignmentHint}
    </section>
  `;
}
async function saveSinglePositionAssignment(eventId, positionId, memberId) {
  try {
    await apiFetch(`/api/events/${encodeURIComponent(eventId)}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments: [
          {
            positionId,
            memberId
          }
        ]
      })
    });
  } catch (error) {
    showMessage(error?.cause?.message || error.message || 'Failed to save assignments.', true);
    return;
  }

  showMessage('Assignments updated.', false);
  closeAssignmentModal();

  if (serviceDate) {
    await loadAssignmentsForDate(serviceDate);
    return;
  }

  await loadAssignmentsForEvent(eventId);
}

function wireAssignmentEditTriggers() {
  Array.from(document.querySelectorAll('.assignment-edit-trigger')).forEach(button => {
    button.addEventListener('click', async () => {
      openAssignmentModal({
        eventId: button.getAttribute('data-event-id'),
        eventTitle: button.getAttribute('data-event-title') || '',
        eventTime: button.getAttribute('data-event-time') || '',
        positionId: button.getAttribute('data-position-id'),
        positionLabel: button.getAttribute('data-position-label') || '',
        assignedMemberId: button.getAttribute('data-assigned-member-id') || null
      });
    });
  });
}

async function loadAssignmentsForEvent(calendarEventId) {
  let body = null;
  try {
    body = await apiFetch(`/api/events/${encodeURIComponent(calendarEventId)}/assignments`);
  } catch (error) {
    showMessage(error?.cause?.message || error.message || 'Failed to load assignments.', true);
    return;
  }

  const event = body.event;
  const openPositions = body.openPositions || [];
  const canManage = body.canManageAssignments === true;
  const assignmentCandidates = Array.isArray(body.assignmentCandidates) ? body.assignmentCandidates : [];
  const quickAddAssigneeRole = String(body.quickAddAssigneeRole || '').trim();
  const allowQuickAddAssignee = body.allowQuickAddAssignee === true;
  const requiredGender = String(body.requiredGender || '').trim().toLowerCase();
  assignmentCandidatesByEvent.set(event._id, assignmentCandidates);
  quickAddRoleByEvent.set(event._id, quickAddAssigneeRole);
  allowQuickAddByEvent.set(event._id, allowQuickAddAssignee);
  requiredGenderByEvent.set(event._id, requiredGender);

  assignmentHeader.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
      <div>
        <div style="font-weight:600; font-size:1.15em;">${escapeHtml(event.title || '')}</div>
        <div style="color:#666; margin-top:4px;">${escapeHtml(event.serviceDate || '')} at ${escapeHtml(event.serviceTime || '')}</div>
      </div>
    </div>
  `;

  openPositionsCallout.innerHTML = '';
  assignmentsTableWrap.innerHTML = renderAssignmentBlock(event, openPositions, canManage, assignmentCandidates);
  if (canManage) {
    wireAssignmentEditTriggers();
  }
}

async function loadAssignmentsForDate(date) {
  // Use new bulk endpoint that returns all events for a date efficiently
  const allAssignments = await apiFetch(`/api/event-assignments?serviceDate=${encodeURIComponent(date)}`);
  
  const events = Array.isArray(allAssignments) ? allAssignments : [];
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

  const validEvents = events.filter(item => item.event && Array.isArray(item.openPositions));
  if (validEvents.length === 0) {
    showMessage('No printable assignments available for this date.', true);
    return;
  }

  validEvents.sort((a, b) => String(a.event.serviceTime || '').localeCompare(String(b.event.serviceTime || '')));
  
  // Render all events with their assignments
  assignmentsTableWrap.innerHTML = validEvents
    .map(item => renderAssignmentBlockWithPositions(
      item.event,
      item.positions || [],
      item.openPositions || [],
      false // canManage will be determined on-demand when user tries to edit
    ))
    .join('');

  wireAssignmentEditTriggers();
}
