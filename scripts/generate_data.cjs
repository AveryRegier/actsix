const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xlsx = require('xlsx');

// Load the Excel file
const filePath = path.join(__dirname, '../hidden/grace-deacon-care-list.xlsx');
const workbook = xlsx.readFile(filePath);

// Extract relevant sheets
const householdsMembersSheet = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
const deaconsSheet = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[3]]);

// API base URL
const apiBaseUrl = 'http://localhost:3001/api';

async function createHouseholdsAndMembers() {

    const deaconResponse = await axios.get(`${apiBaseUrl}/deacons`);

    for (const row of householdsMembersSheet) {
        const householdData = {
            lastName: row['Last Name'],
            notes: row['Need']
        };

        try {
            console.log(`Creating household: ${JSON.stringify(householdData)}`);
            const householdResponse = await axios.post(`${apiBaseUrl}/households`, householdData);
            const householdId = householdResponse.data.id;

            // Split names if multiple people are listed in the DEACON CARE  LIST field
            const names = row['DEACON CARE  LIST'].split('&').map(name => name.trim());

            // Process phone field
            const phoneEntries = row['Phone']?.split(',').map(entry => entry.trim());
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

            const notes = row["__EMPTY"]?.toLowerCase() || '';
            let relationships = ["head", "spouse"];
            let gender = ["male", "female"];
            if(notes.indexOf(' she ') !== -1 || notes.indexOf(" her ") !== -1) {
                gender = ["female", "male"];
                relationships = ["spouse", "head"];
            }

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
                const memberResponse = await axios.post(`${apiBaseUrl}/members`, memberData);
                const memberId = memberResponse.data.id;
            }
            // Find the deacon ID by name
            const deaconName = row['Assigned Deacon'];

            const deacon = deaconResponse.data.deacons.find(
                (d) => `${d.firstName} ${d.lastName}`.toLowerCase() === deaconName.toLowerCase()
            );

            if (deacon) {
                const assignmentData = {
                    deaconMemberId: deacon._id,
                    householdId
                };
                console.log(`Creating assignment: ${JSON.stringify(assignmentData)}`);
                await axios.post(`${apiBaseUrl}/assignments`, assignmentData);
            } else {
                console.warn(`Deacon not found for name: ${deaconName}`);
            }
        } catch (error) {
            console.error('Failed to create household, member, or assignment:', error.response?.data || error.message);
        }
    }
}

async function createDeacons() {
    console.log('Creating deacons...');
    for (const row of deaconsSheet) {
        console.log(row);
        const [deaconFirstName, deaconLastName] = row[" Deacon's Name"].split(' ').map(name => name.trim());

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
            const householdResponse = await axios.post(`${apiBaseUrl}/households`, householdData);
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
            const deaconResponse = await axios.post(`${apiBaseUrl}/members`, deaconData);

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
                    tags: ['member']
                };
                console.log(`Creating spouse: ${JSON.stringify(spouseData)}`);
                await axios.post(`${apiBaseUrl}/members`, spouseData);
            }
        } catch (error) {
            console.error('Failed to create household, deacon, or spouse:', error.response?.data || error.message);
        }
    }
}


async function main() {
    await createDeacons();
    await createHouseholdsAndMembers();
}

main().catch((error) => console.error('Error in script execution:', error));
