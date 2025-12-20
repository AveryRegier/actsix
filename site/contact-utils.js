// Reusable contact utility functions for site pages
export function getBestContactMethod(household) {
    var phoneNumbers = "";
    if (household && household.members && household.members.length) {
        var filtered = [];
        for (var i = 0; i < household.members.length; i++) {
            if (household.members[i].phone) {
                filtered.push(household.members[i]);
            }
        }
        var mapped = [];
        for (var j = 0; j < filtered.length; j++) {
            var m = filtered[j];
            var initial = m.firstName ? m.firstName.charAt(0) : '';
            mapped.push(initial + ': ' + m.phone);
        }
        phoneNumbers = mapped.join('<br>');
    }
    if (household && household.primaryPhone) {
        phoneNumbers += (phoneNumbers ? "<br>" : "") + 'P: ' + household.primaryPhone;
    }
    if (!phoneNumbers && household && household.address && household.address.street) {
        phoneNumbers = household.address.street + '<br>' + household.address.city;
    }
    return phoneNumbers || "(Contact)";
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
