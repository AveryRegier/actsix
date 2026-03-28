import { apiFetch } from './fetch-utils.js';

// Get memberId and householdId from query params
function getParams() {
    var urlParams = new URLSearchParams(window.location.search);
    return {
        memberId: urlParams.get('memberId'),
        householdId: urlParams.get('householdId')
    };
}
var params = getParams();
var memberId = params.memberId;
var householdId = params.householdId;

// Store selected location data
var selectedLocation = null;
var selectedLocationId = null;
var existingTemporaryAddress = null;
var wasExistingLocationPreselected = false;

function updateTagBadges() {
    var labels = document.querySelectorAll('.tag-badge');
    for (var i = 0; i < labels.length; i++) {
        var label = labels[i];
        var cb = label.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) {
            label.classList.remove('tag-unchecked');
        } else {
            label.classList.add('tag-unchecked');
        }
    }
}

function attachTagBadgeHandlers() {
    var tagCheckboxes = document.querySelectorAll('.tag-badge input[type="checkbox"]');
    for (var i = 0; i < tagCheckboxes.length; i++) {
        tagCheckboxes[i].addEventListener('change', updateTagBadges);
    }
    updateTagBadges();
}

// Consolidated DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', function() {
    // Load reusable navigation bar
    var navContainer = document.getElementById('site-nav-container');
    if (navContainer) {
        fetch('site-nav.html')
            .then(function(navResp) {
                if (navResp.ok) {
                    return navResp.text();
                }
                throw new Error('Failed to load navigation');
            })
            .then(function(navHtml) {
                navContainer.innerHTML = navHtml;
                var script = document.createElement('script');
                script.src = 'site-nav.js';
                document.body.appendChild(script);
            })
            .catch(function(error) {
                console.error('Error loading navigation:', error);
            });
    }

    // Clear temporary location button
    document.getElementById('clearTempBtn').addEventListener('click', function(e) {
        e.preventDefault();
        clearTemporaryLocationFields();
    });

    // Load tags and common locations first, then load member data if editing
    Promise.all([loadTags(), loadCommonLocations()]).then(function() {
        // If editing, load member data
        if (memberId) {
            document.getElementById('formTitle').textContent = 'Edit Member';
            apiFetch('api/members/' + memberId)
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    var member = data.member || data;
                    console.log('Loaded member:', member);
                    document.getElementById('memberId').value = member._id || '';
                    document.getElementById('firstName').value = member.firstName || '';
                    document.getElementById('lastName').value = member.lastName || '';
                    document.getElementById('phone').value = member.phone || '';
                    document.getElementById('email').value = member.email || '';
                    document.getElementById('gender').value = member.gender || '';
                    document.getElementById('relationship').value = member.relationship || '';
                    // Set tags
                    var tags = member.tags || [];
                    var tagInputs = Array.from(document.querySelectorAll('input[name="tags"]'));
                    for (var k = 0; k < tagInputs.length; k++) {
                        var cb = tagInputs[k];
                        cb.checked = tags.indexOf(cb.value) !== -1;
                    }
                    updateTagBadges();
                    // Load temporary address if exists
                    if (member.temporaryAddress && member.temporaryAddress.locationId) {
                        loadTemporaryLocation(member.temporaryAddress);
                    }
                })
                .catch(function() {
                    document.getElementById('formError').textContent = 'Could not load member data.';
                    document.getElementById('formError').style.display = 'block';
                });
        }
    }).catch(function(error) {
        console.error('Error loading page data:', error);
    });
});

async function loadTags() {
    try {
        var response = await apiFetch('/api/tags');
        var data = await response.json();
        var tags = data.tags || [];
        var tagsContainer = document.getElementById('tagCheckboxes');
        tagsContainer.innerHTML = '';

        if (!tags.length) {
            tagsContainer.innerHTML = '<span style="color:#666; font-size:0.9em;">No tags found.</span>';
            return;
        }

        var groupedTags = {};
        for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            var type = tag.type || 'other';
            if (!groupedTags[type]) {
                groupedTags[type] = [];
            }
            groupedTags[type].push(tag);
        }

        var typeOrder = ['role', 'situation', 'status', 'other'];
        for (var j = 0; j < typeOrder.length; j++) {
            var currentType = typeOrder[j];
            var currentTags = groupedTags[currentType];
            if (!currentTags || !currentTags.length) {
                continue;
            }

            var groupWrapper = document.createElement('div');
            groupWrapper.style.marginBottom = '12px';

            var heading = document.createElement('div');
            heading.style.fontSize = '0.85em';
            heading.style.fontWeight = '600';
            heading.style.color = '#666';
            heading.style.marginBottom = '6px';
            heading.textContent = currentType.charAt(0).toUpperCase() + currentType.slice(1);
            groupWrapper.appendChild(heading);

            for (var k = 0; k < currentTags.length; k++) {
                var groupTag = currentTags[k];
                var label = document.createElement('label');
                label.className = 'status-badge tag-badge';

                var input = document.createElement('input');
                input.type = 'checkbox';
                input.name = 'tags';
                input.value = groupTag.name;

                label.appendChild(input);
                label.appendChild(document.createTextNode(groupTag.description || groupTag.name));
                groupWrapper.appendChild(label);
            }

            tagsContainer.appendChild(groupWrapper);
        }

        attachTagBadgeHandlers();
    } catch (error) {
        console.error('Error loading tags:', error);
        document.getElementById('tagCheckboxes').innerHTML = '<span style="color:#b30000; font-size:0.9em;">Could not load tags.</span>';
    }
}

// Load common locations from static JSON file
async function loadCommonLocations() {
    try {
        // Fetch locations from API (which has the database IDs)
        const response = await apiFetch('/api/common-locations');
        const data = await response.json();
        const locations = data.locations || [];
        
        console.log('Loaded locations from API:', locations);
        
        const dropdown = document.getElementById('tempLocationDropdown');
        locations.forEach(function(location) {
            const option = document.createElement('option');
            option.value = location.name; // Use name as key for display
            option.textContent = location.name + ' (' + location.type + ')';
            option.dataset.locationId = location._id; // Store database ID
            option.dataset.location = JSON.stringify(location);
            console.log('Adding location option:', {
                name: location.name,
                _id: location._id,
                type: location.type
            });
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading common locations:', error);
    }
}

// Handle location selection from dropdown
document.getElementById('tempLocationDropdown').addEventListener('change', function(e) {
    if (this.value) {
        const selectedOption = this.options[this.selectedIndex];
        const isExistingLocationSelection = Boolean(
            existingTemporaryAddress &&
            selectedOption.dataset.locationId === existingTemporaryAddress.locationId &&
            wasExistingLocationPreselected
        );
        selectedLocation = JSON.parse(selectedOption.dataset.location);
        selectedLocationId = selectedOption.dataset.locationId;
        wasExistingLocationPreselected = isExistingLocationSelection;
        
        console.log('Location selected:', {
            name: this.value,
            locationId: selectedLocationId,
            location: selectedLocation
        });
        
        // Display location info
        const display = document.getElementById('tempLocationDisplay');
        const name = document.getElementById('tempLocationName');
        const addr = document.getElementById('tempLocationAddress');
        
        name.textContent = selectedLocation.name;
        const addrParts = [
            selectedLocation.address?.street,
            selectedLocation.address?.city + ', ' + selectedLocation.address?.state,
            selectedLocation.address?.zipCode
        ].filter(Boolean);
        addr.textContent = addrParts.join(' • ');
        display.style.display = 'block';
        
        // Auto-focus room number field
        document.getElementById('tempRoomNumber').focus();
    } else {
        selectedLocation = null;
        selectedLocationId = null;
        wasExistingLocationPreselected = false;
        document.getElementById('tempLocationDisplay').style.display = 'none';
    }
});

// Load existing temporary location into form
function loadTemporaryLocation(tempAddr) {
    existingTemporaryAddress = tempAddr;
    document.getElementById('tempRoomNumber').value = tempAddr.roomNumber || '';
    document.getElementById('tempNotes').value = tempAddr.notes || '';
    
    // Set selectedLocationId from the existing data but mark that it was pre-selected
    selectedLocationId = tempAddr.locationId;
    wasExistingLocationPreselected = true;
    
    // Try to find and select the location in dropdown
    if (tempAddr.locationId) {
        const dropdown = document.getElementById('tempLocationDropdown');
        for (let i = 0; i < dropdown.options.length; i++) {
            if (dropdown.options[i].dataset.locationId === tempAddr.locationId) {
                dropdown.selectedIndex = i;
                dropdown.dispatchEvent(new Event('change'));
                break;
            }
        }
    }
}

// Clear temporary location fields
function clearTemporaryLocationFields() {
    document.getElementById('tempLocationDropdown').value = '';
    document.getElementById('tempLocationDisplay').style.display = 'none';
    document.getElementById('tempRoomNumber').value = '';
    document.getElementById('tempNotes').value = '';
    selectedLocation = null;
    selectedLocationId = null;
    existingTemporaryAddress = null;
    wasExistingLocationPreselected = false;
}

// Save handler
document.getElementById('memberForm').onsubmit = function(e) {
    e.preventDefault();
    var form = e.target;
    var checkedTags = Array.from(form.querySelectorAll('input[name="tags"]:checked'));
    var tagValues = [];
    for (var i = 0; i < checkedTags.length; i++) {
        tagValues.push(checkedTags[i].value);
    }
    
    var member = {
        firstName: form.firstName.value,
        lastName: form.lastName.value,
        phone: form.phone.value,
        email: form.email.value,
        gender: form.gender.value,
        relationship: form.relationship.value,
        tags: tagValues
    };

    // Add temporary address based on what happened with location selection
    if (selectedLocationId && !wasExistingLocationPreselected) {
        // New location just selected by user
        member.temporaryAddress = {
            locationId: selectedLocationId,
            roomNumber: document.getElementById('tempRoomNumber').value || undefined,
            startDate: new Date().toISOString().split('T')[0],
            notes: document.getElementById('tempNotes').value || undefined,
            isActive: true
        };
        // Remove undefined properties
        Object.keys(member.temporaryAddress).forEach(key => 
            member.temporaryAddress[key] === undefined && delete member.temporaryAddress[key]
        );
        console.log('Sending temporaryAddress (new location):', member.temporaryAddress);
    } else if (selectedLocationId && wasExistingLocationPreselected && existingTemporaryAddress) {
        // Existing location loaded, user just editing notes/room
        member.temporaryAddress = {
            locationId: existingTemporaryAddress.locationId,
            roomNumber: document.getElementById('tempRoomNumber').value || undefined,
            startDate: existingTemporaryAddress.startDate,
            notes: document.getElementById('tempNotes').value || undefined,
            isActive: true
        };
        // Remove undefined properties
        Object.keys(member.temporaryAddress).forEach(key => 
            member.temporaryAddress[key] === undefined && delete member.temporaryAddress[key]
        );
        console.log('Sending temporaryAddress (existing updated):', member.temporaryAddress);
    } else if (memberId && !selectedLocationId && document.getElementById('tempLocationDropdown').value === '') {
        // Explicitly cleared existing temporary location
        member.temporaryAddress = {
            isActive: false,
            endDate: new Date().toISOString().split('T')[0]
        };
        console.log('Sending temporaryAddress (cleared):', member.temporaryAddress);
    }

    var url = '/api/members';
    var method = 'POST';
    if (memberId) {
        url = '/api/members/' + memberId;
        method = 'PUT';
    } else {
        // For new member, need householdId
        member.householdId = householdId;
    }
    
    console.log('Saving member data:', member);
    apiFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
    })
    .then(function(res) {
        if (res.ok) {
            document.getElementById('formSuccess').style.display = 'block';
            return res.json().then(function(data) {
                // Use householdId from API response if available
                var redirectHouseholdId = data.member && data.member.householdId ? data.member.householdId : householdId;
                setTimeout(function() {
                    window.location.href = 'household.html?id=' + redirectHouseholdId;
                }, 800);
            });
        } else {
            return res.json().then(function(data) {
                console.error('API error response:', data);
                document.getElementById('formError').textContent = data.message || 'Error saving member.';
                document.getElementById('formError').style.display = 'block';
            });
        }
    })
    .catch(function(err) {
        console.error('Error saving member:', err);
        document.getElementById('formError').textContent = 'Error saving member.';
        document.getElementById('formError').style.display = 'block';
    });
};

// Cancel handler
document.getElementById('cancelBtn').onclick = function(e) {
    e.preventDefault();
    window.location.href = 'household.html?id=' + householdId;
};