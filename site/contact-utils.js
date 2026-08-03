// Reusable contact utility functions for site pages
function formatAddressLine(address) {
    if (!address || !address.street) {
        return '';
    }
    var cityStateZip = [address.city, address.state, address.zipCode].filter(Boolean).join(' ');
    return address.street + (cityStateZip ? ', ' + cityStateZip : '');
}

function getActiveLocationMember(household) {
    if (!household || !household.members || !household.members.length) {
        return null;
    }

    for (var i = 0; i < household.members.length; i++) {
        var member = household.members[i];
        if (member.temporaryAddress && member.temporaryAddress.isActive && member.temporaryAddress.locationId) {
            return member;
        }
    }

    return null;
}

export function getBestContactMethod(household, resolvedLocation) {
    var contactLines = [];
    var activeLocationMember = getActiveLocationMember(household);
    var hasLocation = Boolean(activeLocationMember && resolvedLocation && resolvedLocation.address && resolvedLocation.address.street);

    if (household && household.members && household.members.length) {
        var hasMemberPhoneOrLocation = false;
        for (var i = 0; i < household.members.length; i++) {
            var member = household.members[i];
            var isActiveLocationMember = activeLocationMember && member._id === activeLocationMember._id;

            if (isActiveLocationMember && hasLocation) {
                var locationLabel = resolvedLocation.name || 'Current Location';
                contactLines.push((member.firstName ? member.firstName.charAt(0) : '') + ': ' + locationLabel);
                contactLines.push(formatAddressLine(resolvedLocation.address));
                hasMemberPhoneOrLocation = true;
                continue;
            }

            if (member.phone) {
                var initial = member.firstName ? member.firstName.charAt(0) : '';
                contactLines.push(initial + ': ' + member.phone);
                hasMemberPhoneOrLocation = true;
            }
        }

        if (!hasMemberPhoneOrLocation && hasLocation) {
            contactLines.push((activeLocationMember && activeLocationMember.firstName ? activeLocationMember.firstName.charAt(0) : '') + ': ' + (resolvedLocation.name || 'Current Location'));
            contactLines.push(formatAddressLine(resolvedLocation.address));
        }
    }

    if (household && household.primaryPhone) {
        contactLines.push('P: ' + household.primaryPhone);
    }

    if (!contactLines.length && household && household.address && household.address.street) {
        contactLines.push(household.address.street + '<br>' + household.address.city);
    }

    return contactLines.join('<br>') || '(Contact)';
}

export function getContactedBy(lastContact) {
    if (!lastContact) return "";
    var contactedBy = "";
    switch (lastContact.contactType) {
        case 'phone':
            contactedBy = "Called";
            break;
        case 'visit':
            contactedBy = "Visited";
            break;
        case 'voicemail':
            contactedBy = "Left voicemail";
            break;
        case 'text':
            contactedBy = "Texted";
            break;
        case 'church':
            contactedBy = "Spoke at church";
            break;
        case 'note':
            contactedBy = "Updated";
            break;
    }
    if (lastContact.contactedBy && lastContact.contactedBy.length) {
        if (contactedBy) contactedBy += " by ";
        var names = [];
        for (var i = 0; i < lastContact.contactedBy.length; i++) {
            var c = lastContact.contactedBy[i];
            names.push(c.firstName + ' ' + c.lastName);
        }
        contactedBy += names.join(', ');
    }
    return contactedBy;
}

export function getContactDateClass(lastContactDate) {
    var contactDateClass = '';
    if (lastContactDate) {
        var weeksAgo = (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
        if (weeksAgo > 6) {
            contactDateClass = 'red';
        } else if (weeksAgo > 3) {
            contactDateClass = 'yellow';
        }
    } else {
        contactDateClass = 'red'
    }
    return contactDateClass;
}
