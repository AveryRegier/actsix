// Polyfill Array.from for older browsers
if (!Array.from) {
	Array.from = function(arrayLike) {
		return Array.prototype.slice.call(arrayLike);
	};
}

import { getContactedBy } from './contact-utils.js';
import { formatAddressForDisplay, formatAddressForMaps } from './address-utils.js';
import { apiFetch } from './fetch-utils.js';

function getActiveLocationMember(item) {
	var members = item.members || [];
	for (var i = 0; i < members.length; i++) {
		var member = members[i];
		if (member.temporaryAddress && member.temporaryAddress.isActive && member.temporaryAddress.locationId) {
			return member;
		}
	}
	return null;
}

function buildClickableContact(item, resolvedLocation) {
	var members = item.members || [];
	var parts = [];
	var activeLocationMember = getActiveLocationMember(item);

	for (var i = 0; i < members.length; i++) {
		var m = members[i];
		var isActiveLocationMember = activeLocationMember && m._id === activeLocationMember._id;
		if (isActiveLocationMember && resolvedLocation && resolvedLocation.address && resolvedLocation.address.street) {
			var initial = m.firstName ? m.firstName.charAt(0) : '';
			var mapsUrl = formatAddressForMaps(resolvedLocation.address);
			parts.push('<span>' + initial + ': ' + (resolvedLocation.name || 'Current Location') + '</span>');
			parts.push('<a href="' + mapsUrl + '" target="_blank" rel="noopener noreferrer">' + formatAddressForDisplay(resolvedLocation.address) + '</a>');
			continue;
		}
		if (m.phone) {
			var phoneInitial = m.firstName ? m.firstName.charAt(0) : '';
			parts.push('<a href="tel:' + encodeURIComponent(m.phone) + '">' + phoneInitial + ': ' + m.phone + '</a>');
		}
	}

	if (item.primaryPhone) {
		parts.push('<a href="tel:' + encodeURIComponent(item.primaryPhone) + '">P: ' + item.primaryPhone + '</a>');
	}

	if (!parts.length && item.address && item.address.street) {
		var url = formatAddressForMaps(item.address);
		var displayAddress = formatAddressForDisplay(item.address);
		return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + displayAddress + '</a>';
	}

	return parts.join('<br>') || '(Contact)';
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
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
	// Get deacon memberId from actsix cookie
	// function getCookie(name) {
	// 	const value = `; ${document.cookie}`;
	// 	const parts = value.split(`; ${name}=`);
	// 	if (parts.length === 2) return parts.pop().split(';').shift();
	// }
	// let deaconMemberId = null;
	// const actsixCookie = getCookie('actsix');
	// if (actsixCookie) {
	// 	const decodedCookie = decodeURIComponent(actsixCookie);
	// 	deaconMemberId = decodedCookie.split('|')[0];
	// }
	// if (!deaconMemberId) {
	// 	if (window.currentMemberId) {
	// 		deaconMemberId = window.currentMemberId;
	// 	} else {
	// 		try {
	// 			const meRes = await fetch('/api/me');
	// 			if (meRes.ok) {
	// 				const meData = await meRes.json();
	// 				deaconMemberId = meData._id;
	// 			}
	// 		} catch (err) {
	// 			const urlParams = new URLSearchParams(window.location.search);
	// 			deaconMemberId = urlParams.get('deaconMemberId');
	// 		}
	// 	}
	// }
	// if (!deaconMemberId) {
	// 	alert('Unable to determine logged-in member (deacon) ID.');
	// 	return;
	// }

	// Fetch precomputed quick contacts in one call
	var requestDeaconMemberId = new URLSearchParams(window.location.search).get('deaconMemberId');
	var deaconMemberId = requestDeaconMemberId || localStorage.getItem('memberId') || 'unknown';
	fetch('/api/deacons/' + deaconMemberId + '/quickContacts')
		.then(function(qcRes) {
			return qcRes.json();
		})
		.then(async function(qcData) {
			var quickContacts = qcData.quickContacts || [];

			// Render two-line rows using returned data. Use CSS classes defined in site.css.
			var tbody = document.querySelector('#quickContactsTable tbody');

			var rowsHtml = [];
			var tempLocationFetches = [];
			for (var idx = 0; idx < quickContacts.length; idx++) {
				var item = quickContacts[idx];
				var householdLink = 'household.html?id=' + item.householdId;
				var contactLink = 'record-contact.html?householdId=' + item.householdId + '&deaconMemberId=' + encodeURIComponent(deaconMemberId || '');
				var lastDate = item.lastContact && item.lastContact.contactDate ? new Date(item.lastContact.contactDate).toLocaleDateString() : '(needed)';

				// Queue location fetch if member has current facility address
				var tempMember = null;
				if (item.members && item.members.length > 0) {
					for (var mi = 0; mi < item.members.length; mi++) {
						var mem = item.members[mi];
						if (mem.temporaryAddress && mem.temporaryAddress.isActive && mem.temporaryAddress.locationId) {
							tempMember = mem;
							break;
						}
					}
				}

				if (tempMember) {
					tempLocationFetches.push({
						householdId: item.householdId,
						locationId: tempMember.temporaryAddress.locationId,
						roomNumber: tempMember.temporaryAddress.roomNumber,
						startDate: tempMember.temporaryAddress.startDate,
						notes: tempMember.temporaryAddress.notes
					});
				}

				// display label: prefer the specific member(s) from lastContact.memberId
				var contactTargetName = '';
				if (item.lastContact && item.lastContact.memberId && item.members && item.members.length) {
					var targets = [];
					for (var mi = 0; mi < item.members.length; mi++) {
						var mem = item.members[mi];
						for (var mj = 0; mj < item.lastContact.memberId.length; mj++) {
							if (item.lastContact.memberId[mj] === mem._id) {
								targets.push(mem);
								break;
							}
						}
					}
					if (targets.length === 1) {
						contactTargetName = targets[0].firstName + ' ' + targets[0].lastName;
					} else if (targets.length > 1) {
						var targetNames = [];
						for (var ti = 0; ti < targets.length; ti++) {
							targetNames.push(targets[ti].firstName + ' ' + targets[ti].lastName);
						}
						contactTargetName = targetNames.join(' & ');
					}
				}
				var displayLabel = contactTargetName || item.displayName;

				var deacons = '(Assign)';
				if (item.assignedDeacons && item.assignedDeacons.length) {
					var deaconNames = [];
					for (var di = 0; di < item.assignedDeacons.length; di++) {
						var d = item.assignedDeacons[di];
						deaconNames.push(d.firstName + ' ' + d.lastName);
					}
					deacons = deaconNames.join(', ');
				}

				var contactedBy = getContactedBy(item.lastContact);
				var summary = escapeHtml((item.lastContact && item.lastContact.summary) || item.summary || '');

				var rowClass = idx % 2 === 0 ? 'even' : 'odd';

				rowsHtml.push(
					'<tr class="summary-row ' + rowClass + '" data-household-id="' + item.householdId + '">' +
					'<td class="summary-badge-col name-col">' +
					'<a class="member-link" href="' + householdLink + '">' + displayLabel + '</a>' +
					'</td>' +
					'<td class="summary-badge-col contact-col">' +
					'<div class="contact-cell" data-household-id="' + item.householdId + '">Loading contact method...</div>' +
					'</td>' +
					'<td class="summary-badge-col action-col">' +
					'<a href="' + contactLink + '" class="btn record-btn" role="button" aria-label="Record contact for ' + displayLabel + '" title="Record contact for ' + displayLabel + '">Record</a>' +
					'</td>' +
					'</tr>' +
					'<tr class="summary-row ' + rowClass + ' second-row" data-household-id="' + item.householdId + '">' +
					'<td class="last-contact-col howwhen-col">' + (contactedBy ? contactedBy + ' on ' + lastDate : lastDate) + '</td>' +
					'<td class="notes-col" colspan="2">' + summary + '</td>' +
					'</tr>'
				);
			}
			var tempLocationByHouseholdId = {};
			await Promise.all(tempLocationFetches.map(function(fetchInfo) {
				return apiFetch('api/common-locations/' + fetchInfo.locationId)
					.then(function(res) {
						return res.json();
					})
					.then(function(data) {
						if (data.location) {
							tempLocationByHouseholdId[fetchInfo.householdId] = data.location;
						}
					})
					.catch(function(err) { console.error('Error fetching location:', err); });
			}));

			tbody.innerHTML = rowsHtml.join('');
			for (var r = 0; r < quickContacts.length; r++) {
				var contactItem = quickContacts[r];
				var contactCell = document.querySelector('div.contact-cell[data-household-id="' + contactItem.householdId + '"]');
				if (contactCell) {
					contactCell.innerHTML = buildClickableContact(contactItem, tempLocationByHouseholdId[contactItem.householdId]);
				}
			}
		})
		.catch(function(error) {
			console.error('Error loading quick contacts:', error);
			alert('Failed to load quick contacts. Please try again.');
		});
});
