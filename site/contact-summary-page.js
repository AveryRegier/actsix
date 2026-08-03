import { apiFetch } from './fetch-utils.js';
import { getBestContactMethod, getContactedBy, getContactDateClass } from './contact-utils.js';

let summaryData = [];

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadResolvedLocation(locationId) {
    const response = await apiFetch('api/common-locations/' + locationId);
    const data = await response.json();
    return data.location || null;
}

function hasHelperAssignment(item) {
    return (item.assignedDeacons || []).some(member => member.tags && member.tags.includes('helper'));
}

function hasDeaconAssignment(item) {
    return (item.assignedDeacons || []).some(member => member.tags && member.tags.includes('deacon'));
}

function filterSummaryItems(items, filterValue) {
    if (filterValue === 'helper') {
        return items.filter(hasHelperAssignment);
    }
    if (filterValue === 'deacon') {
        return items.filter(hasDeaconAssignment);
    }
    return items;
}

async function applyDefaultAssignmentFilter() {
    const assignmentFilter = document.getElementById('assignmentFilter');
    if (!assignmentFilter) {
        console.log('[contact-summary] assignmentFilter element not found');
        return;
    }

    const currentMemberId = (() => {
        try {
            return localStorage.getItem('memberId');
        } catch (e) {
            return null;
        }
    })();

    console.log('[contact-summary] currentMemberId from localStorage:', currentMemberId);

    if (!currentMemberId) {
        assignmentFilter.value = 'all';
        console.log('[contact-summary] No currentMemberId found, defaulting filter to:', assignmentFilter.value);
        return;
    }

    try {
        const response = await apiFetch('api/members/' + currentMemberId);
        const data = await response.json();
        console.log('[contact-summary] member lookup response payload:', data);
        const member = data && data.member ? data.member : null;
        const tags = member && member.tags ? member.tags : [];
        console.log('[contact-summary] resolved member:', member);
        console.log('[contact-summary] resolved tags:', tags);

        if (tags.includes('staff') || tags.includes('elder')) {
            assignmentFilter.value = 'all';
            console.log('[contact-summary] Defaulting filter to All based on staff/elder tags');
            return;
        }
        if (tags.includes('helper') || tags.includes('deaconess')) {
            assignmentFilter.value = 'helper';
            console.log('[contact-summary] Defaulting filter to H.E.L.P. based on helper/deaconess tags');
            return;
        }
        if (tags.includes('deacon')) {
            assignmentFilter.value = 'deacon';
            console.log('[contact-summary] Defaulting filter to Deacon based on deacon tag');
            return;
        }

        assignmentFilter.value = 'all';
        console.log('[contact-summary] No matching tags found, defaulting filter to:', assignmentFilter.value);
    } catch (error) {
        console.warn('Failed to determine default assignment filter:', error);
        assignmentFilter.value = 'all';
        console.log('[contact-summary] Error fallback, defaulting filter to:', assignmentFilter.value);
    }
}

async function renderSummary(items) {
    const tableBody = document.getElementById('summaryTable').querySelector('tbody');
    const filteredItems = filterSummaryItems(items, document.getElementById('assignmentFilter')?.value || 'all');

    filteredItems.sort((a, b) => a.household.lastName.localeCompare(b.household.lastName));

    const resolvedLocationsByHouseholdId = {};
    await Promise.all(filteredItems.map(async item => {
        if (item.household.members && item.household.members.length > 0) {
            for (const member of item.household.members) {
                if (member.temporaryAddress && member.temporaryAddress.isActive && member.temporaryAddress.locationId) {
                    const location = await loadResolvedLocation(member.temporaryAddress.locationId);
                    if (location) {
                        resolvedLocationsByHouseholdId[item.household._id] = location;
                    }
                    break;
                }
            }
        }
    }));

    tableBody.innerHTML = filteredItems.map((item, idx) => {
        const currentHouseholdId = item.household._id;
        const householdName = item.household?.members?.map(m => m.firstName).join(' & ');

        const phoneNumbers = getBestContactMethod(item.household, resolvedLocationsByHouseholdId[currentHouseholdId]);
        const deacons = item.assignedDeacons?.map(d => `${d.firstName} ${d.lastName}`).join(', ') || "(Assign)";
        const lastContactDate = item.lastContact?.contactDate ? new Date(item.lastContact.contactDate) : null;

        const contactedBy = getContactedBy(item.lastContact);
        let contactDateClass = getContactDateClass(lastContactDate);

        const rowClass = idx % 2 === 0 ? 'even' : 'odd';
        const summaryContent = escapeHtml(item.summary);

        return `
            <tr class="summary-row ${rowClass}" data-household-id="${currentHouseholdId}">
                <td class="summary-badge-col">
                    <a class="member-link" href="household.html?id=${currentHouseholdId}">${item.household.lastName}</a>
                    <span class="cell-badge">Last</span>
                </td>
                <td class="summary-badge-col">
                    <a class="member-link" href="household.html?id=${currentHouseholdId}">${householdName}</a>
                    <span class="cell-badge">First</span>
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
                <td class="last-contact-col notes-col" data-household-id="${currentHouseholdId}">
                    ${summaryContent}
                    <span class="cell-badge">Summary</span>
                </td>
            </tr>
        `;
    }).join('');
}

// Load reusable navigation bar
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

async function fetchSummary() {
    const response = await apiFetch('api/reports/summary');
    const data = await response.json();
    summaryData = data.summary || [];
    console.log('[contact-summary] summary rows loaded:', summaryData.length, 'current filter:', document.getElementById('assignmentFilter')?.value);
    await renderSummary(summaryData);
}

document.addEventListener('DOMContentLoaded', async () => {
    const assignmentFilter = document.getElementById('assignmentFilter');
    if (assignmentFilter) {
        assignmentFilter.addEventListener('change', () => renderSummary(summaryData));
    }
    await applyDefaultAssignmentFilter();
    fetchSummary();
});
