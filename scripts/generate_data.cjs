const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xlsx = require('xlsx');
const moment = require('moment');

// Load the Excel file
const filePath = path.join(__dirname, '../hidden/grace-deacon-care-list.xlsx');
const workbook = xlsx.readFile(filePath);

// Extract relevant sheets
const householdsMembersSheet = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
const deaconsSheet = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[1]]);

// API base URL
const apiBaseUrl = 'http://localhost:3001/api';

// Create an axios client that sends an Authorization header with a generation API key for scripting.
// The server middleware will accept the key and treat the request as an authenticated script user.
const generationKey = process.env.GENERATION_API_KEY || '';
if (!generationKey) {
    console.warn('Warning: GENERATION_API_KEY not set in environment. The script may be rejected by the API.');
}

const client = axios.create({
    baseURL: apiBaseUrl,
    headers: generationKey ? { 'Authorization': `Bearer ${generationKey}` } : {}
});

async function createHouseholdsAndMembers() {

    const deaconResponse = await client.get(`/deacons?add=deaconess,elder,staff`);

    for (const row of householdsMembersSheet) {
        const householdData = {
            lastName: row['Last Name'],
            notes: row['Location']
        };

        try {
            console.log(`Creating household: ${JSON.stringify(householdData)}`);
            const householdResponse = await client.post(`/households`, householdData);
            const householdId = householdResponse.data.id;

            // Split names if multiple people are listed in the DEACON CARE  LIST field
            const names = splitNames(row['DEACON CARE  LIST']);

            // Process phone field
            let phone = row['Phone'];
            if(!phone) phone = '';
            const phoneEntries = phone.split(',').map(entry => entry.trim());
            const phoneMap = {};
            phoneEntries?.forEach(entry => {
                const match = entry.match(/^(\w+):\s*(\d{10})$/);
                if (match) {
                    phoneMap[match[1].toLowerCase()] = match[2];
                } else {
                    householdData.notes += `${entry}\n`;
                }
            });
            console.log('phoneMap:', phoneMap);
            const tag = row['Need']?.split(' ').join('-').toLowerCase() || 'other-needs';

            const notes = row["__EMPTY"] || '';
            const notesLower = notes.toLowerCase();
            let relationships = ["head", "spouse"];
            let gender = ["male", "female"];
            if(notesLower.indexOf(' she ') !== -1 || notesLower.indexOf(" her ") !== -1) {
                gender = ["female", "male"];
                relationships = ["spouse", "head"];
            }

            let memberId;
            for (const name of names) {
                const memberData = {
                    householdId,
                    firstName: name,
                    lastName: row['Last Name'],
                    phone: phoneMap?.[name.toLowerCase()] || row['Phone'],
                    tags: ['member', tag],
                    relationship: relationships.shift(),
                    gender: gender.shift()
                };
                console.log(`Creating member: ${JSON.stringify(memberData)}`);
                const memberResponse = await client.post(`/members`, memberData);
                memberId = memberId || memberResponse.data.id;
            }
            // Find the deacon ID by name
            splitNames(row['Assigned Deacon']).forEach(async name => {
                const deacon = deaconResponse.data.deacons.find(
                    (d) => `${d.firstName} ${d.lastName}`.toLowerCase() === name.toLowerCase()
                );

                if (deacon) {
                    const assignmentData = {
                        deaconMemberId: deacon._id,
                        householdId
                    };
                    console.log(`Creating assignment: ${JSON.stringify(assignmentData)}`);
                    await client.post(`/assignments`, assignmentData);
                } else {
                    console.warn(`Deacon not found for name: ${name}`);
                }
            });

            const lastContactDate = moment("1900-01-01").add(row['Last Contact'] - 2, 'days');
            const lastContactDeaconNames = row['Last Contact Deacon'];
            const lastContactDeacons = splitNames(lastContactDeaconNames).map(lastContactDeaconName => {
                return deaconResponse.data.deacons.find(
                    (d) => `${d.firstName} ${d.lastName}`.toLowerCase() === lastContactDeaconName.toLowerCase()
                );
            });
            if (lastContactDate) {
                const contactData = {
                    memberId: [memberId],
                    deaconId: lastContactDeacons?.map(d => d._id) || [],
                    contactType: notesLower.includes('visit') ? 'visit' : 'phone',
                    summary: notes,
                    contactDate: lastContactDate.format(),// ISO format
                    followUpRequired: false
                };
                console.log(`Creating contact log: ${JSON.stringify(contactData)}`);
                await client.post(`/contacts`, contactData);
            }
            processNotesForContacts(row, householdId, memberId, deaconResponse);
        } catch (error) {
            console.error('Failed to create household, member, or assignment:', error.response?.data || error.message);
        }
    }
}

function splitNames(names) {
    return names.split(/[,&\/\\:|]+/).map(name => name.trim());
}

async function createDeacons() {
    console.log('Creating deacons...');
    for (const row of deaconsSheet) {
        console.log(row);
        let [deaconFirstName, deaconUnknown, deaconLastName] = row[" Deacon's Name"].split(' ').map(name => name.trim());
        if(!deaconLastName) {
            deaconLastName = deaconUnknown;
        } else {
            if(deaconUnknown.indexOf("(") !== -1) {
                deaconFirstName = deaconFirstName + ' ' + deaconUnknown;
            } else {
                deaconLastName = deaconUnknown + ' ' + deaconLastName;
            }
        }


        const householdData = {
            lastName: deaconLastName.trim(),
            address: {
                street: row['address'],
                city: row['city'],
                state: row['State'],
                zipCode: row['zip']
            }
        };

        try {
            console.log(`Creating household for deacon: ${JSON.stringify(householdData)}`);
            const householdResponse = await client.post(`/households`, householdData);
            const householdId = householdResponse.data.id;

            const deaconData = {
                householdId,
                firstName: deaconFirstName,
                lastName: deaconLastName.trim(),
                phone: row['Phone'],
                email: row['Email'],
                relationship: 'head',
                tags: ['deacon', 'member'],
                gender: "male",
                notes: row['Preferences of Service'] || ''
            };
            console.log(`Creating deacon: ${JSON.stringify(deaconData)}`);
            const deaconResponse = await client.post(`/members`, deaconData);

            // Add spouse as a separate member
            const spouseName = row["Wife's name"];
            const spousePhone = row["Wife's Phone"];
            const spouseEmail = row["Wife's email"];

            if (spouseName) {
                const spouseData = {
                    householdId,
                    firstName: spouseName,
                    lastName: deaconLastName.trim(),
                    phone: spousePhone || '',
                    email: spouseEmail || '',
                    relationship: 'spouse',
                    gender: "female",
                    tags: ['deaconess', 'member']
                };
                console.log(`Creating spouse: ${JSON.stringify(spouseData)}`);
                await client.post(`/members`, spouseData);
            }
        } catch (error) {
            console.error('Failed to create household, deacon, or spouse:', error.response?.data || error.message);
        }
    }
}

async function processNotesForContacts(row, householdId, memberId, deaconResponse) {
    const notes = row['__EMPTY']; // Assuming column I is labeled 'Notes'
    const updates = notes.split(/(?=\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/).map(note => note.trim());

    for (const update of updates) {
        const dateMatch = update.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        const deaconMatch = update.match(/(?:AVW|Deacon:|Initials:|\b)([A-Za-z]+(?:\s[A-Za-z]+)?)/);
        const summary = update.replace(dateMatch?.[0] || '', '').replace(deaconMatch?.[0] || '', '').trim();

        const contactDate = dateMatch ? moment(dateMatch[0], ['MM/DD/YYYY', 'MM-DD-YYYY']).format() : null;
        const deaconName = deaconMatch ? deaconMatch[1]?.trim() : null;

        const deacon = deaconName ? deaconResponse.data.deacons.find(
            (d) => `${d.firstName} ${d.lastName}`.toLowerCase() === deaconName.toLowerCase()
        ) : null;

        if (contactDate && deacon) {
            const contactData = {
                memberId: [memberId],
                deaconId: [deacon._id],
                contactType: summary.toLowerCase().includes('visit') ? 'visit' : 'phone',
                summary,
                contactDate,
                followUpRequired: false
            };
            console.log(`Creating contact log: ${JSON.stringify(contactData)}`);
            await client.post(`/contacts`, contactData);
        } else {
            console.warn(`Skipping contact creation for update: ${update}`);
        }
    }
}

async function main() {
    try {
        await createDeacons();
        await createHouseholdsAndMembers();
        console.log('Data generation completed successfully.');
    } catch (error) {
        console.error('Error during data generation:', error.message);
    }
}

main();
