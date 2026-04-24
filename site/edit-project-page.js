import { apiFetch } from './fetch-utils.js';

let projectId = null;
let allHouseholds = [];

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  projectId = params.get('id');
  if (projectId) {
    document.getElementById('pageTitle').textContent = 'Edit Project';
  }

  await loadFormData();
  wireHouseholdSearch();
  wireForm();
});

async function loadFormData() {
  try {
    const [deaconsRes, householdsRes] = await Promise.all([
      apiFetch('api/deacons'),
      apiFetch('api/households'),
    ]);

    if (deaconsRes.ok) {
      const data = await deaconsRes.json();
      const deacons = data.deacons || data.members || [];
      const select = document.getElementById('leadDeaconSelect');
      deacons.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d._id;
        opt.textContent = `${d.firstName} ${d.lastName}`;
        select.appendChild(opt);
      });
    }

    if (householdsRes.ok) {
      const data = await householdsRes.json();
      allHouseholds = data.households || [];
    }

    if (projectId) {
      const projRes = await apiFetch(`api/projects/${projectId}`);
      if (projRes.ok) {
        const data = await projRes.json();
        populateForm(data.project, data.household);
      }
    }

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('formContent').classList.remove('is-hidden');
  } catch (err) {
    console.error('Error loading form data:', err);
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').classList.remove('is-hidden');
  }
}

function populateForm(project, household) {
  document.getElementById('titleInput').value = project.title || '';
  document.getElementById('descriptionInput').value = project.description || '';
  document.getElementById('phaseSelect').value = project.phase || 'discovery';
  document.getElementById('statusSelect').value = project.status || 'active';
  document.getElementById('leadDeaconSelect').value = project.leadDeaconId || '';
  document.getElementById('estimatedCostInput').value = project.estimatedCost != null ? project.estimatedCost : '';
  document.getElementById('needsApprovalCheck').checked = !!project.needsApproval;
  document.getElementById('communicationLinkInput').value = project.communicationLink || '';

  if (project.householdId) {
    document.getElementById('householdId').value = project.householdId;
    const hhName = household ? `${household.lastName} Household` : project.householdId;
    document.getElementById('householdSearch').value = hhName;
    document.getElementById('householdSelected').textContent = hhName;
    document.getElementById('householdSelected').classList.remove('is-hidden');
  }
}

function wireHouseholdSearch() {
  const searchInput = document.getElementById('householdSearch');
  const suggestions = document.getElementById('householdSuggestions');
  const hiddenId = document.getElementById('householdId');

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) { suggestions.classList.add('is-hidden'); return; }

    const matches = allHouseholds.filter(h =>
      (h.lastName || '').toLowerCase().includes(query)
    ).slice(0, 8);

    if (!matches.length) { suggestions.classList.add('is-hidden'); return; }

    suggestions.innerHTML = matches.map(h => `
      <div class="household-suggestion" data-id="${h._id}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--gh-border);">
        ${escHtml(h.lastName)} Household
      </div>
    `).join('');
    suggestions.classList.remove('is-hidden');
  });

  suggestions.addEventListener('click', (e) => {
    const item = e.target.closest('.household-suggestion');
    if (!item) return;
    hiddenId.value = item.dataset.id;
    searchInput.value = item.textContent.trim();
    document.getElementById('householdSelected').textContent = item.textContent.trim();
    document.getElementById('householdSelected').classList.remove('is-hidden');
    suggestions.classList.add('is-hidden');
  });

  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target) && e.target !== searchInput) {
      suggestions.classList.add('is-hidden');
    }
  });
}

function wireForm() {
  document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('formError');
    errorEl.classList.add('is-hidden');

    const payload = {
      title: document.getElementById('titleInput').value.trim(),
      description: document.getElementById('descriptionInput').value.trim(),
      householdId: document.getElementById('householdId').value.trim(),
      phase: document.getElementById('phaseSelect').value,
      status: document.getElementById('statusSelect').value,
      leadDeaconId: document.getElementById('leadDeaconSelect').value,
      needsApproval: document.getElementById('needsApprovalCheck').checked,
      communicationLink: document.getElementById('communicationLinkInput').value.trim(),
    };

    const cost = document.getElementById('estimatedCostInput').value.trim();
    payload.estimatedCost = cost !== '' ? parseFloat(cost) : null;

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    try {
      const res = projectId
        ? await apiFetch(`api/projects/${projectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await apiFetch('api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        errorEl.textContent = err.message || 'Failed to save project.';
        errorEl.classList.remove('is-hidden');
        return;
      }

      const saved = await res.json();
      const id = saved.id || projectId;
      window.location.href = `project-detail.html?id=${encodeURIComponent(id)}`;
    } catch (err) {
      console.error('Error saving project:', err);
      errorEl.textContent = 'An unexpected error occurred.';
      errorEl.classList.remove('is-hidden');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
