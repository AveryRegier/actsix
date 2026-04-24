import { apiFetch } from './fetch-utils.js';

const PHASE_LABELS = {
  discovery: 'Discovery', vetting: 'Vetting', preparation: 'Preparation',
  implementation: 'Implementation', followup: 'Follow-up',
  completed: 'Completed', cancelled: 'Cancelled',
};

function phaseBadge(phase) {
  return `<span class="phase-badge phase-${phase}">${PHASE_LABELS[phase] || phase}</span>`;
}

let userRole = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const memberId = localStorage.getItem('memberId');
    if (memberId) {
      const res = await apiFetch(`api/members/${memberId}`);
      if (res.ok) {
        const data = await res.json();
        userRole = (data.member || data)?.role || null;
      }
    }
  } catch (e) { /* ignore */ }

  if (userRole === 'deacon' || userRole === 'staff') {
    const btn = document.getElementById('newProjectBtn');
    if (btn) btn.style.display = '';
  }

  const statusFilter = document.getElementById('statusFilter');
  const phaseFilter = document.getElementById('phaseFilter');
  statusFilter.addEventListener('change', loadProjects);
  phaseFilter.addEventListener('change', loadProjects);

  await loadProjects();
});

async function loadProjects() {
  const status = document.getElementById('statusFilter').value;
  const phase = document.getElementById('phaseFilter').value;

  document.getElementById('loadingState').style.display = '';
  document.getElementById('projectsList').classList.add('is-hidden');
  document.getElementById('emptyState').classList.add('is-hidden');
  document.getElementById('errorState').classList.add('is-hidden');

  try {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (phase) params.set('phase', phase);
    const res = await apiFetch(`api/projects?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    document.getElementById('loadingState').style.display = 'none';

    if (!data.projects || data.projects.length === 0) {
      document.getElementById('emptyState').classList.remove('is-hidden');
      return;
    }

    const list = document.getElementById('projectsList');
    list.innerHTML = data.projects.map(p => `
      <a class="project-card" href="project-detail.html?id=${encodeURIComponent(p._id)}">
        <span class="project-card-title">${escHtml(p.title)}</span>
        <span class="project-card-meta">
          ${phaseBadge(p.phase)}
          <span>${escHtml(p.status)}</span>
          ${p.estimatedCost ? `<span>~$${Number(p.estimatedCost).toFixed(0)}</span>` : ''}
          ${p.updatedAt ? `<span>Updated ${new Date(p.updatedAt).toLocaleDateString()}</span>` : ''}
        </span>
      </a>
    `).join('');
    list.classList.remove('is-hidden');
  } catch (err) {
    console.error('Error loading projects:', err);
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').classList.remove('is-hidden');
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
