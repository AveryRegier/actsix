import { apiFetch } from './fetch-utils.js';
import { getBestContactMethod, getContactedBy, getContactDateClass } from './contact-utils.js';
import { formatAddressForDisplay, formatAddressForMaps } from './address-utils.js';

let summaryData = [];

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
        console.log('[contact-summary] member lookup response status:', response.status);
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

function renderSummary(items) {
    const tableBody = document.getElementById('summaryTable').querySelector('tbody');
    const filteredItems = filterSummaryItems(items, document.getElementById('assignmentFilter')?.value || 'all');

    filteredItems.sort((a, b) => a.household.lastName.localeCompare(b.household.lastName));

    tableBody.innerHTML = filteredItems.map((item, idx) => {
        const currentHouseholdId = item.household._id;
        const householdName = item.household?.members?.map(m => m.firstName).join(' & ');

        const phoneNumbers = getBestContactMethod(item.household);
        const deacons = item.assignedDeacons?.map(d => `${d.firstName} ${d.lastName}`).join(', ') || "(Assign)";
        const lastContactDate = item.lastContact?.contactDate ? new Date(item.lastContact.contactDate) : null;

        const contactedBy = getContactedBy(item.lastContact);
        let contactDateClass = getContactDateClass(lastContactDate);

        // Find any member with an active temporary location
        let tempMember = null;
        if (item.household.members && item.household.members.length > 0) {
            for (const member of item.household.members) {
                if (member.temporaryAddress && member.temporaryAddress.isActive && member.temporaryAddress.locationId) {
                    tempMember = member;
                    break;
                }
            }
        }

        const rowClass = idx % 2 === 0 ? 'even' : 'odd';
        const summaryContent = `${item.summary}`;

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
                    <div class="temp-location-info" style="margin-top: 8px;"></div>
                    <span class="cell-badge">Summary</span>
                </td>
            </tr>
        `;
    }).join('');

    // Now fetch and display temporary locations if any exist
    const tempLocationFetches = [];
    filteredItems.forEach(item => {
        if (item.household.members && item.household.members.length > 0) {
            for (const member of item.household.members) {
                if (member.temporaryAddress && member.temporaryAddress.isActive && member.temporaryAddress.locationId) {
                    tempLocationFetches.push({
                        householdId: item.household._id,
                        locationId: member.temporaryAddress.locationId,
                        roomNumber: member.temporaryAddress.roomNumber,
                        startDate: member.temporaryAddress.startDate,
                        notes: member.temporaryAddress.notes
                    });
                    break;  // Only process first member with temp location per household
                }
            }
        }
    });

    tempLocationFetches.forEach(fetchInfo => {
        apiFetch('api/common-locations/' + fetchInfo.locationId)
            .then(res => res.json())
            .then(data => {
                const location = data.location;
                if (location && location.address) {
                    const mapsUrl = formatAddressForMaps(location.address);
                    const displayAddress = formatAddressForDisplay(location.address, false);
                    const roomInfo = fetchInfo.roomNumber ? ' • Room/Unit: ' + fetchInfo.roomNumber : '';
                    const selector = `td[data-household-id="${fetchInfo.householdId}"] .temp-location-info`;
                    const locElement = document.querySelector(selector);
                    if (locElement) {
                        let html = '<div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px; margin-top: 10px;">' +
                            '<strong style="color: #856404;">Temporary Location:</strong>' +
                            '<div style="margin-top: 5px;">' +
                            '<span style="color: #333;">' + location.name + roomInfo + '</span>' +
                            '</div>' +
                            '<div style="margin-top: 3px; font-size: 0.9em;">' +
                            '<a href="' + mapsUrl + '" target="_blank" rel="noopener noreferrer" style="color: #0066cc; text-decoration: none;">' + displayAddress + '</a>' +
                            '</div>';
                        if (fetchInfo.startDate) {
                            html += '<div style="margin-top: 3px; font-size: 0.85em; color: #666;">Since: ' + new Date(fetchInfo.startDate).toLocaleDateString() + '</div>';
                        }
                        if (fetchInfo.notes) {
                            html += '<div style="margin-top: 5px; font-size: 0.9em; font-style: italic; color: #555;">' + fetchInfo.notes + '</div>';
                        }
                        html += '</div>';
                        locElement.innerHTML = html;
                    }
                }
            })
            .catch(err => console.error('Error fetching location:', err));
    });
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
    renderSummary(summaryData);
}

document.addEventListener('DOMContentLoaded', async () => {
    const assignmentFilter = document.getElementById('assignmentFilter');
    if (assignmentFilter) {
        assignmentFilter.addEventListener('change', () => renderSummary(summaryData));
    }
    await applyDefaultAssignmentFilter();
    fetchSummary();
});
