import { apiFetch } from './fetch-utils.js';
import { createAssignmentPicker } from './assignment-picker-widget.js';

// Get householdId from query params
const urlParams = new URLSearchParams(window.location.search);
const householdId = urlParams.get('householdId');
if (!householdId) {
    document.body.innerHTML = '<p>Error: No householdId provided.</p>';
    throw new Error('No householdId');
}

// Fetch all deacons
async function fetchDeacons() {
    const res = await apiFetch('api/deacons?add=deaconess,staff,helper');
    const data = await res.json();
    const sorted = data.deacons.sort((a, b) => {
        const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
        const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
        return nameA.localeCompare(nameB);
    });
    return sorted;
}

// Fetch current assignments
async function fetchAssignments() {
    const res = await apiFetch(`api/households/${householdId}/assignments`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.assignments || [];
}

// Render deacon list with checkboxes
async function renderDeaconList() {
    const deacons = await fetchDeacons();
    const assignments = await fetchAssignments();
    const assignedIds = assignments.map(a => a.deaconMemberId);
    const container = document.getElementById('deaconList');
    const picker = createAssignmentPicker({
        container,
        options: deacons,
        selectedValues: assignedIds,
        multi: true,
        searchPlaceholder: 'Search deacons by name...',
    });

    return picker;
}

const deaconPickerPromise = renderDeaconList();

// Assign selected deacons
document.getElementById('assignBtn').onclick = async function() {
    const picker = await deaconPickerPromise;
    const checked = picker.getValues();
    // Send assignments to API
    const res = await apiFetch(`api/households/${householdId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deaconIds: checked })
    });
    if (res.ok) {
        const where = document.referrer ?? `household.html?id=${householdId}`;
        window.location.href = where;
    } else {
        alert('Failed to assign deacons');
    }
};

document.getElementById('cancelBtn').onclick = function() {
    window.location.href = `household.html?id=${householdId}`;
};
