import { apiFetch } from './fetch-utils.js';

const PHASE_LABELS = {
  discovery: 'Discovery', vetting: 'Vetting', preparation: 'Preparation',
  implementation: 'Implementation', followup: 'Follow-up',
  completed: 'Completed', cancelled: 'Cancelled',
};
const UPDATE_LABELS = { note: 'Note', status: 'Status', blocker: 'Blocker', resolved: 'Resolved' };
const MATERIAL_STATUS_LABELS = {
  needed: 'Needed', sourced: 'Sourced', purchased: 'Purchased',
  delivered: 'Delivered', installed: 'Installed',
};

let projectId = null;
let projectData = null;
let userRoles = [];
let memberId = null;

/** True if the current user has at least one of the given roles. */
function hasUserRole(...roles) {
  return roles.some(r => userRoles.includes(r));
}

function phaseBadge(phase) {
  return `<span class="phase-badge phase-${phase}">${PHASE_LABELS[phase] || phase}</span>`;
}
function updateBadge(type) {
  return `<span class="update-type-badge update-${type}">${UPDATE_LABELS[type] || type}</span>`;
}
function materialBadge(status) {
  return `<span class="material-status-badge material-${status}">${MATERIAL_STATUS_LABELS[status] || status}</span>`;
}
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  projectId = params.get('id');
  if (!projectId) {
    showError('No project ID provided.');
    return;
  }

  memberId = localStorage.getItem('memberId');
  try {
    const res = await apiFetch('api/me');
    if (res.ok) {
      const data = await res.json();
      memberId = memberId || data.memberId;
      userRoles = data.roles || [];
    }
  } catch (e) { /* ignore */ }

  await loadProject();
  await loadUpdates();
  wireUpdateForm();
  wireDocumentForm();
  wireMaterialForm();
});

async function loadProject() {
  try {
    const res = await apiFetch(`api/projects/${projectId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    projectData = data;
    renderProject(data);
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('projectContent').classList.remove('is-hidden');
  } catch (err) {
    console.error('Error loading project:', err);
    showError('Failed to load project.');
  }
}

function renderProject(data) {
  const p = data.project;
  document.getElementById('projectTitle').textContent = p.title;

  // Edit button — only for deacon/staff/lead-deacon
  if (hasUserRole('deacon', 'staff', 'lead-deacon')) {
    const editBtn = document.getElementById('editProjectBtn');
    editBtn.href = `edit-project.html?id=${encodeURIComponent(projectId)}`;
    editBtn.classList.remove('is-hidden');
  }

  // Worker update type restriction — workers can only post notes
  if (hasUserRole('worker') && !hasUserRole('deacon', 'staff', 'lead-deacon')) {
    const typeSelect = document.getElementById('updateType');
    if (typeSelect) {
      Array.from(typeSelect.options).forEach(opt => {
        if (opt.value !== 'note') opt.remove();
      });
    }
  }

  const hhName = data.household ? `${data.household.lastName} Household` : '—';
  const hhLink = data.household
    ? `<a href="household.html?id=${encodeURIComponent(p.householdId)}">${escHtml(hhName)}</a>`
    : escHtml(hhName);
  const leadName = data.leadDeacon
    ? `${data.leadDeacon.firstName} ${data.leadDeacon.lastName}`
    : '—';
  const assignedDeacons = data.assignedDeacons?.length
    ? data.assignedDeacons.map(d => `${d.firstName} ${d.lastName}`).join(', ')
    : '—';
  const workers = data.workers?.length
    ? data.workers.map(w => `${w.firstName} ${w.lastName}`).join(', ')
    : 'None assigned';

  document.getElementById('projectInfo').innerHTML = `
    <div class="household-info">
      <span class="info-label">Household</span><span>${hhLink}</span>
      <span class="info-label">Phase</span><span>${phaseBadge(p.phase)}</span>
      <span class="info-label">Status</span><span>${escHtml(p.status)}</span>
      <span class="info-label">Assigned Deacons</span><span>${escHtml(assignedDeacons)}</span>
      <span class="info-label">Workers</span><span>${escHtml(workers)}</span>
      ${p.estimatedCost ? `<span class="info-label">Est. Cost</span><span>$${Number(p.estimatedCost).toFixed(2)}</span>` : ''}
      ${p.needsApproval ? `<span class="info-label">Approval</span><span>Required</span>` : ''}
      ${p.communicationLink ? `<span class="info-label">Link</span><span><a href="${escHtml(p.communicationLink)}" target="_blank" rel="noopener">Open</a></span>` : ''}
      ${p.description ? `<span class="info-label">Description</span><span>${escHtml(p.description)}</span>` : ''}
    </div>
  `;

  // Materials — optional convenience section, hidden when empty unless user can add items
  const matSection = document.getElementById('materialsSection');
  const matList = document.getElementById('materialsList');
  const canManageMaterials = hasUserRole('deacon', 'staff', 'lead-deacon');
  const isAssignedWorker = hasUserRole('worker') && p.workerIds?.includes(memberId);

  if (!p.materials?.length && !canManageMaterials) {
    // Nothing to show and no ability to add — hide entirely
    matSection.style.display = 'none';
  } else {
    if (canManageMaterials) {
      document.getElementById('addMaterialBtn').style.display = '';
    }

    if (!p.materials?.length) {
      matList.innerHTML = '';
    } else {
      const showCost = !hasUserRole('worker') || hasUserRole('deacon', 'staff', 'lead-deacon');
      matList.innerHTML = `<table>
        <thead><tr><th>Item</th><th>Qty</th><th>Status</th><th>Provided By</th>${showCost ? '<th>Est. Cost</th>' : ''}</tr></thead>
        <tbody>
          ${p.materials.map(m => `
            <tr>
              <td>${escHtml(m.description)}</td>
              <td>${m.quantity != null ? escHtml(String(m.quantity)) : ''}${m.unit ? ' ' + escHtml(m.unit) : ''}</td>
              <td>
                ${isAssignedWorker ? `
                  <select class="material-status-select summary-filter-select" data-id="${escHtml(m._id)}">
                    ${['needed','sourced','purchased','delivered','installed'].map(s =>
                      `<option value="${s}"${m.status === s ? ' selected' : ''}>${MATERIAL_STATUS_LABELS[s]}</option>`
                    ).join('')}
                  </select>
                ` : materialBadge(m.status)}
              </td>
              <td>${m.providedBy ? escHtml(m.providedBy) : '—'}</td>
              ${showCost ? `<td>${m.estimatedCost != null ? '$' + Number(m.estimatedCost).toFixed(2) : '—'}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>`;

      if (isAssignedWorker) {
        matList.querySelector('table')?.addEventListener('change', async (e) => {
          const sel = e.target.closest('.material-status-select');
          if (!sel) return;
          await saveMaterialStatus(sel.dataset.id, sel.value);
        });
      }

      // Auto-open for assigned workers so they can update status without extra click
      if (isAssignedWorker) {
        matSection.open = true;
      }
    }
  }

  // Documents
  const docList = document.getElementById('documentsList');
  const canAddDoc = hasUserRole('deacon', 'staff', 'lead-deacon') || isAssignedWorker;
  if (canAddDoc) {
    document.getElementById('addDocumentBtn').style.display = '';
  }
  if (!p.documents || p.documents.length === 0) {
    docList.innerHTML = '<p>No documents attached.</p>';
  } else {
    docList.innerHTML = p.documents.map(d => `
      <div style="margin-bottom:6px;">
        <a href="${escHtml(d.url || d.s3Key || '#')}" target="_blank" rel="noopener">${escHtml(d.label)}</a>
        <span style="font-size:0.8em;color:var(--gh-text-muted);margin-left:6px;">${escHtml(d.type)}</span>
      </div>
    `).join('');
  }
}

async function saveMaterialStatus(itemId, status) {
  // Merge the status update into the existing materials array
  const materials = (projectData?.project?.materials || []).map(m =>
    m._id === itemId ? { ...m, status } : m
  );
  try {
    const res = await apiFetch(`api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials }),
    });
    if (!res.ok) console.error('Failed to update material status');
    else {
      const updated = await res.json();
      if (projectData) projectData.project = updated.project;
    }
  } catch (err) {
    console.error('Error saving material status:', err);
  }
}

function wireMaterialForm() {
  const addBtn = document.getElementById('addMaterialBtn');
  const form = document.getElementById('addMaterialForm');
  const cancelBtn = document.getElementById('cancelMaterialBtn');
  const saveBtn = document.getElementById('saveMaterialBtn');
  if (!addBtn) return;

  addBtn.addEventListener('click', () => form.classList.toggle('is-hidden'));
  cancelBtn?.addEventListener('click', () => form.classList.add('is-hidden'));

  saveBtn?.addEventListener('click', async () => {
    const description = document.getElementById('matDescription').value.trim();
    if (!description) return;
    const qty = document.getElementById('matQuantity').value.trim();
    const unit = document.getElementById('matUnit').value.trim();
    const cost = document.getElementById('matCost').value.trim();

    const newItem = { description, quantity: qty ? Number(qty) : null, unit: unit || null, estimatedCost: cost ? parseFloat(cost) : null, status: 'needed' };
    const materials = [...(projectData?.project?.materials || []), newItem];

    saveBtn.disabled = true;
    try {
      const res = await apiFetch(`api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (projectData) projectData.project = updated.project;
        form.classList.add('is-hidden');
        ['matDescription','matQuantity','matUnit','matCost'].forEach(id => {
          document.getElementById(id).value = '';
        });
        renderProject(projectData);
      }
    } finally {
      saveBtn.disabled = false;
    }
  });
}

async function loadUpdates() {
  try {
    const res = await apiFetch(`api/projects/${projectId}/updates`);
    if (!res.ok) return;
    const data = await res.json();
    renderUpdates(data.updates || []);
  } catch (err) {
    console.error('Error loading updates:', err);
  }
}

function renderUpdates(updates) {
  const list = document.getElementById('updatesList');
  if (!updates.length) {
    list.innerHTML = '<p>No discussion yet.</p>';
    return;
  }
  list.innerHTML = updates.map(u => {
    const author = u.author ? `${u.author.firstName} ${u.author.lastName}` : 'Unknown';
    const when = u.createdAt ? new Date(u.createdAt).toLocaleString() : '';
    return `
      <div class="project-update-item">
        <div class="project-update-meta">
          ${updateBadge(u.type)} <strong>${escHtml(author)}</strong> &mdash; ${escHtml(when)}
          ${u.phaseSnapshot ? `&mdash; ${phaseBadge(u.phaseSnapshot)}` : ''}
        </div>
        <div>${escHtml(u.text)}</div>
      </div>
    `;
  }).join('');
}

function wireUpdateForm() {
  document.getElementById('submitUpdateBtn').addEventListener('click', async () => {
    const type = document.getElementById('updateType').value;
    const text = document.getElementById('updateText').value.trim();
    if (!text) return;

    const btn = document.getElementById('submitUpdateBtn');
    btn.disabled = true;
    try {
      const res = await apiFetch(`api/projects/${projectId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to post update.');
        return;
      }
      document.getElementById('updateText').value = '';
      await loadUpdates();
    } catch (err) {
      console.error('Error posting update:', err);
    } finally {
      btn.disabled = false;
    }
  });
}

function wireDocumentForm() {
  const addBtn = document.getElementById('addDocumentBtn');
  const form = document.getElementById('addDocumentForm');
  const cancelBtn = document.getElementById('cancelDocBtn');
  const saveBtn = document.getElementById('saveDocBtn');

  addBtn.addEventListener('click', () => form.classList.remove('is-hidden'));
  cancelBtn.addEventListener('click', () => {
    form.classList.add('is-hidden');
    document.getElementById('docLabel').value = '';
    document.getElementById('docUrl').value = '';
  });
  saveBtn.addEventListener('click', async () => {
    const label = document.getElementById('docLabel').value.trim();
    const url = document.getElementById('docUrl').value.trim();
    const type = document.getElementById('docType').value;
    if (!label || !url) { alert('Label and URL are required.'); return; }

    saveBtn.disabled = true;
    try {
      const res = await apiFetch(`api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: [{ label, url, type }] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to add document.');
        return;
      }
      form.classList.add('is-hidden');
      document.getElementById('docLabel').value = '';
      document.getElementById('docUrl').value = '';
      await loadProject();
    } catch (err) {
      console.error('Error adding document:', err);
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function showError(msg) {
  document.getElementById('loadingState').style.display = 'none';
  const errEl = document.getElementById('errorState');
  errEl.querySelector('p').textContent = msg;
  errEl.classList.remove('is-hidden');
}
