// Reusable contact utility functions for site pages
export function getBestContactMethod(household) {
    let phoneNumbers = "";
    if (household?.members?.length) {
        phoneNumbers = household.members
            .filter(m => m.phone)
            .map(m => `${m.firstName?.charAt(0)}: ${m.phone}`)
            .join('<br>');
    }
    if (household?.primaryPhone) {
        phoneNumbers += (phoneNumbers ? "<br>" : "") + `P: ${household.primaryPhone}`;
    }
    if (!phoneNumbers && household?.address?.street) {
        phoneNumbers = `${household.address.street}<br>${household.address.city}`;
    }
    return phoneNumbers || "(Contact)";
}

export function getContactedBy(lastContact) {
    if (!lastContact) return "";
    let contactedBy = "";
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
        case 'church':
            contactedBy = "Spoke at church";
            break;
    }
    if (lastContact.contactedBy?.length) {
        if (contactedBy) contactedBy += " by ";
        contactedBy += lastContact.contactedBy.map(c => `${c.firstName} ${c.lastName}`).join(', ');
    }
    return contactedBy;
}

export function getContactDateClass(lastContactDate) {
    let contactDateClass = '';
    if (lastContactDate) {
        const weeksAgo = (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
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
