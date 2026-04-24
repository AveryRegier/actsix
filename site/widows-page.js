import { apiFetch } from './fetch-utils.js';
import { getBestContactMethod, getContactedBy, getContactDateClass } from './contact-utils.js';

const TAG_LABELS = {
    'widow': 'Widow',
    'widower': 'Widower',
    'shut-in': 'Shut-In',
    'long-term-needs': 'Long Term Needs'
};

let summaryData = [];

function filterItems(items, filterValue) {
    if (filterValue === 'assigned') {
        return items.filter(item => item.assignedDeacons && item.assignedDeacons.length > 0);
    }
    if (filterValue === 'unassigned') {
        return items.filter(item => !item.assignedDeacons || item.assignedDeacons.length === 0);
    }
    return items;
}

function renderTagBadges(widowTags) {
    if (!widowTags || widowTags.length === 0) return '';
    return widowTags.map(tag => {
        const label = TAG_LABELS[tag] || tag;
        return `<span class="tag-badge tag-${tag.replace(/[^a-z0-9]/g, '-')}">${label}</span>`;
    }).join(' ');
}

function renderSummary(items) {
    const tableBody = document.getElementById('summaryTable').querySelector('tbody');
    const filterValue = document.getElementById('assignmentFilter')?.value || 'all';
    const filteredItems = filterItems(items, filterValue);

    filteredItems.sort((a, b) => a.household.lastName.localeCompare(b.household.lastName));

    tableBody.innerHTML = filteredItems.map((item, idx) => {
        const currentHouseholdId = item.household._id;
        const householdName = item.household?.members?.map(m => m.firstName).join(' & ');
        const phoneNumbers = getBestContactMethod(item.household);
        const deacons = item.assignedDeacons?.map(d => `${d.firstName} ${d.lastName}`).join(', ') || '(Assign)';
        const lastContactDate = item.lastContact?.contactDate ? new Date(item.lastContact.contactDate) : null;
        const contactedBy = getContactedBy(item.lastContact);
        const contactDateClass = getContactDateClass(lastContactDate);
        const tagBadges = renderTagBadges(item.widowTags);
        const rowClass = idx % 2 === 0 ? 'even' : 'odd';

        return `
            <tr class="summary-row ${rowClass}" data-household-id="${currentHouseholdId}">
                <td class="summary-badge-col">
                    <a class="member-link" href="household.html?id=${currentHouseholdId}">${item.household.lastName}</a>
                    <span class="cell-badge">Last</span>
                </td>
                <td class="summary-badge-col">
                    <a class="member-link" href="household.html?id=${currentHouseholdId}">${householdName || ''}</a>
                    <span class="cell-badge">First</span>
                </td>
                <td class="summary-badge-col">
                    ${tagBadges}
                    <span class="cell-badge">Tags</span>
                </td>
                <td class="summary-badge-col">
                    <a href="record-contact.html?householdId=${currentHouseholdId}">${phoneNumbers}</a>
                    <span class="cell-badge">Make Contact</span>
                </td>
                <td class="summary-badge-col">
                    <a href="assign-deacons.html?householdId=${currentHouseholdId}">${deacons}</a>
                    <span class="cell-badge">Deacons</span>
                </td>
                <td class="last-contact-col ${contactDateClass}">
                    ${lastContactDate ? lastContactDate.toLocaleDateString() : '(needed)'}
                    <span class="cell-badge">When</span>
                </td>
                <td class="last-contact-col">
                    ${contactedBy}
                    <span class="cell-badge">Who & How</span>
                </td>
                <td class="last-contact-col notes-col">
                    ${item.summary}
                    <span class="cell-badge">Summary</span>
                </td>
            </tr>
        `;
    }).join('');

    if (filteredItems.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#666;">No records found for the selected filter.</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('site-nav-container');
    if (navContainer) {
        const navResp = await fetch('site-nav.html');
        if (navResp.ok) {
            navContainer.innerHTML = await navResp.text();
            const script = document.createElement('script');
            script.src = 'site-nav.js';
            document.body.appendChild(script);
        }
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const assignmentFilter = document.getElementById('assignmentFilter');
    if (assignmentFilter) {
        assignmentFilter.addEventListener('change', () => renderSummary(summaryData));
    }

    try {
        const response = await apiFetch('api/reports/widows');
        const data = await response.json();
        summaryData = data.summary || [];
        renderSummary(summaryData);
    } catch (error) {
        console.error('[widows] Failed to load data:', error);
    }
});
