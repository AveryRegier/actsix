// Polyfill Array.from for older browsers
if (!Array.from) {
    Array.from = function(arrayLike) {
        return Array.prototype.slice.call(arrayLike);
    };
}

import { apiFetch } from './fetch-utils.js';
import { loadZipCodeData, setupAddressAutofill, populateAddressFields } from './address-utils.js';

document.addEventListener('DOMContentLoaded', function() {
    var urlParams = new URLSearchParams(window.location.search);
    var householdId = urlParams.get('householdId');

    if (!householdId) {
        alert('No household ID provided');
        return;
    }

    var zipCodeData;
    loadZipCodeData()
        .then(function(data) {
            zipCodeData = data;
            return loadHouseholdData();
        })
        .catch(function(error) {
            console.warn('Zip code data is not available:', error);
            return loadHouseholdData();
        });

    function loadHouseholdData() {

        return apiFetch('api/households/' + householdId)
            .then(function(response) {
                return response.json();
            })
            .then(function(household) {
                document.getElementById('lastName').value = household.lastName || '';
                populateAddressFields('address', household.address || {});
                document.getElementById('primaryPhone').value = household.primaryPhone || '';
                document.getElementById('email').value = household.email || '';
                document.getElementById('notes').value = household.notes || '';

                // Setup address autofill after fields are populated
                if (zipCodeData) {
                    setupAddressAutofill({
                        streetFieldId: 'addressStreet',
                        cityFieldId: 'addressCity',
                        stateFieldId: 'addressState',
                        zipFieldId: 'addressZipCode',
                        zipCodeData: zipCodeData
                    });
                }
            })
            .catch(function(error) {
                console.error('Error fetching household data:', error);
                alert('Failed to load household data');
            });
    }

    document.getElementById('edit-household-form').addEventListener('submit', function(event) {
        event.preventDefault();

        var formData = new FormData(event.target);

        var street = formData.get('addressStreet') || '';
        var city = formData.get('addressCity') || '';
        var state = formData.get('addressState') || '';
        var zipCode = formData.get('addressZipCode') || '';

        var householdData = {
            lastName: formData.get('lastName'),
            primaryPhone: formData.get('primaryPhone'),
            email: formData.get('email'),
            notes: formData.get('notes')
        };

        // Only include address if at least one field has a value
        if (street || city || state || zipCode) {
            householdData.address = {
                street: street,
                city: city,
                state: state,
                zipCode: zipCode
            };
        }

        apiFetch('api/households/' + householdId, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(householdData)
        })
        .then(function(response) {
            if (response.ok) {
                var redirectUrl = document.referrer || ('household.html?id=' + householdId);
                window.location.href = redirectUrl;
            } else {
                console.error('Failed to update household:', response.statusText);
                alert('Failed to update household. Please try again.');
            }
        })
        .catch(function(error) {
            console.error('Error updating household:', error);
            alert('An error occurred while updating the household. Please try again.');
        });
    });
});
