const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xlsx = require('xlsx');
const moment = require('moment');
const chrono = require('chrono-node');

// Determine input Excel file: prefer CLI arg (process.argv[2]) then npm config env var (npm_config_file), then fall back to bundled default
const inputArg = (process.argv[2] || process.env.npm_config_file || '').toString().trim();
let filePath;
if (inputArg) {
    // If passed a relative path, resolve from current working directory; accept absolute paths too
    filePath = path.isAbsolute(inputArg) ? inputArg : path.resolve(process.cwd(), inputArg);
} else {
    filePath = path.join(__dirname, '../hidden/grace-deacon-care-list.xlsx');
}

// Load the Excel file (exit if not readable)
let workbook;
try {
    workbook = xlsx.readFile(filePath);
} catch (err) {
    console.error(`Failed to read Excel file at ${filePath}:`, err.message);
    process.exit(1);
}

// File creation/modification time to use as fallback for dates when row lacks Last Contact
let fileCreatedMoment = null;
try {
    const stats = fs.statSync(filePath);
    const birth = stats.birthtime || stats.ctime || stats.mtime;
    fileCreatedMoment = moment(birth);
} catch (e) {
    fileCreatedMoment = moment();
}

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

// Lightweight preview helpers to avoid logging huge/freeform objects
function previewText(s, len = 120) {
    if (s === undefined || s === null) return '';
    const str = s.toString();
    return str.length > len ? str.slice(0, len) + '...' : str;
}

function maskPhoneMap(pm) {
    if (!pm || typeof pm !== 'object') return {};
    const masked = {};
    for (const k of Object.keys(pm)) {
        const v = pm[k] ? pm[k].toString() : '';
        // mask all but last 4 digits
        masked[k] = v.replace(/\d(?=\d{4})/g, '*');
    }
    return masked;
}

async function createHouseholdsAndMembers() {

    const deaconResponse = await client.get(`/deacons?add=deaconess,elder,staff`);
    // Load all members once (in-memory cache) so we can find existing members without extra API calls
    // This avoids using a non-existent query endpoint and reduces round trips.
    let allMembers = [];
    try {
        const allRes = await client.get(`/members`);
        allMembers = allRes.data?.members || allRes.data || [];
    } catch (e) {
        allMembers = [];
    }
    const memberLookup = new Map();
    function addToMemberCache(m) {
        if (!m) return;
        const fn = (m.firstName || '').toString().trim().toLowerCase();
        const ln = (m.lastName || m.last || '').toString().trim().toLowerCase();
        const key = `${fn}|${ln}`;
        if (!memberLookup.has(key)) memberLookup.set(key, m);
    }
    for (const m of allMembers) addToMemberCache(m);

    for (const row of householdsMembersSheet) {
        const householdData = {
            lastName: row['Last Name'],
            notes: row['Location']
        };

        try {
            // Before creating a new household, check the in-memory member cache for any member on this row.
            // If a matching member exists and has a household, reuse that household to avoid orphan households.
            let names = splitNames(row['DEACON CARE  LIST']);
            let reusedHouseholdId = null;
            let reusedMember = null;
            // declare once here so we don't accidentally redeclare in different branches
            let existingMembersForHousehold = [];
            // memberId may be set from reusedMember branch before we reach the member creation loop;
            // declare it here to avoid TDZ (cannot access before initialization) errors.
            let memberId = null;
            for (const nm of names) {
                const key = `${nm.toString().trim().toLowerCase()}|${(row['Last Name'] || '').toString().trim().toLowerCase()}`;
                const m = memberLookup.get(key);
                if (m) {
                    reusedMember = m;
                    if (m.householdId) {
                        reusedHouseholdId = m.householdId;
                        break;
                    }
                }
            }

            let householdId;
            if (reusedHouseholdId) {
                householdId = reusedHouseholdId;
                console.log(`Reusing household ${householdId} from existing member for ${names.join(', ')}`);
                // refresh existingMembersForHousehold for this household
                try {
                    const emRes2 = await client.get(`/households/${householdId}/members`);
                    existingMembersForHousehold = emRes2.data?.members || [];
                } catch (e) {
                    existingMembersForHousehold = [];
                }
                // set memberId if we have a matched member
                if (reusedMember) memberId = memberId || reusedMember._id;
            } else {
                console.log(`Creating household: lastName=${householdData.lastName} notes=${previewText(householdData.notes,120)}`);
                const householdResponse = await client.post(`/households`, householdData);
                householdId = householdResponse.data.id;
            }

            

            // Split names if multiple people are listed in the DEACON CARE  LIST field
            names = names || splitNames(row['DEACON CARE  LIST']);

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
            console.log('phoneMap keys:', Object.keys(phoneMap || {}), 'masked:', maskPhoneMap(phoneMap));
            const tag = row['Need']?.split(' ').join('-').toLowerCase() || 'other-needs';

            const notes = row["__EMPTY"] || '';
            const notesLower = notes.toLowerCase();
            let relationships = ["head", "spouse"];
            let gender = ["male", "female"];
            if(notesLower.indexOf(' she ') !== -1 || notesLower.indexOf(" her ") !== -1) {
                gender = ["female", "male"];
                relationships = ["spouse", "head"];
            }

            // Fetch existing members for this household so we can avoid creating duplicates by name
            existingMembersForHousehold = [];
            try {
                const emRes = await client.get(`/households/${householdId}/members`);
                existingMembersForHousehold = emRes.data?.members || [];
            } catch (e) {
                // If the fetch fails, proceed to create members as before
                console.warn(`Warning: failed to fetch existing members for household ${householdId}: ${e.message}`);
                existingMembersForHousehold = [];
            }

            // helper: update in-memory member cache when we create or update a member
            function updateMemberCache(m) {
                if (!m) return;
                addToMemberCache(m);
                // also add to allMembers if not present
                try {
                    const exists = allMembers.find(x => x._id === m._id);
                    if (!exists) allMembers.push(m);
                } catch (e) {}
            }

            for (const name of names) {
                // check existing by first + last name (case-insensitive)
                const found = existingMembersForHousehold.find(m => {
                    const fn = (m.firstName || '').toString().trim().toLowerCase();
                    const ln = (m.lastName || m.last || '').toString().trim().toLowerCase();
                    return fn === name.toString().trim().toLowerCase() && ln === (row['Last Name'] || '').toString().trim().toLowerCase();
                });
                if (found) {
                    // Determine phone/email from sheet
                    const phoneVal = phoneMap?.[name.toLowerCase()] || row['Phone'] || '';
                    const emailVal = row['Email'] || row['E-mail'] || '';

                    // Compare and prepare updates if needed (phone, email, tags)
                    const updates = {};
                    if (phoneVal && phoneVal.toString().trim() && phoneVal.toString().trim() !== (found.phone || '').toString().trim()) {
                        updates.phone = phoneVal.toString().trim();
                    }
                    if (emailVal && emailVal.toString().trim() && emailVal.toString().trim() !== (found.email || '').toString().trim()) {
                        updates.email = emailVal.toString().trim();
                    }

                    // derive tags from sheet (same logic as when creating)
                    const sheetTag = tag || 'other-needs';
                    const sheetTags = ['member', sheetTag];
                    const existingTags = Array.isArray(found.tags) ? found.tags : (found.tags ? [found.tags] : []);
                    const mergedTags = Array.from(new Set([...(existingTags || []), ...sheetTags]));
                    // If mergedTags differs from existing, mark it for update
                    const normExistingTags = (existingTags || []).map(t => t.toString().trim()).sort().join('|');
                    const normMergedTags = mergedTags.map(t => t.toString().trim()).sort().join('|');
                    if (normExistingTags !== normMergedTags) {
                        updates.tags = mergedTags;
                    }

                    if (Object.keys(updates).length > 0) {
                        // Prepare a full body for PUT (members API requires certain fields)
                        const putBody = {
                            firstName: found.firstName || name,
                            lastName: found.lastName || row['Last Name'],
                            relationship: found.relationship || 'other',
                            gender: found.gender || 'male',
                            // merged tags
                            tags: updates.tags || (found.tags || []),
                            phone: updates.phone || found.phone || '',
                            email: updates.email || found.email || ''
                        };
                        try {
                            console.log(`Updating member ${found._id}: fields=${Object.keys(updates).join(',')}`);
                            const putRes = await client.put(`/members/${found._id}`, putBody);
                            // putRes.data.member contains updated member
                            const updatedMember = putRes.data?.member || putBody;
                            updateMemberCache(updatedMember);
                            memberId = memberId || (updatedMember._id || found._id);
                        } catch (e) {
                            console.warn(`Failed to update member ${found._id}: ${e.message}`);
                            memberId = memberId || found._id;
                        }
                    } else {
                        console.log(`Member already exists, no changes: ${name} ${row['Last Name']} -> id=${found._id}`);
                        memberId = memberId || found._id;
                    }
                    continue;
                }

                // If not found in the newly created household, try to find the member in the in-memory cache
                const key = `${name.toString().trim().toLowerCase()}|${(row['Last Name'] || '').toString().trim().toLowerCase()}`;
                const globalFound = memberLookup.get(key) || null;
                if (globalFound) {
                    // Reuse their household — avoid creating duplicate family members
                    const existingHouseholdId = globalFound.householdId || globalFound.household || globalFound.household_id || null;
                    if (existingHouseholdId) {
                        console.log(`Using existing household ${existingHouseholdId} for member ${name} ${row['Last Name']} (member id ${globalFound._id})`);
                        // switch to that household for subsequent member creation
                        householdId = existingHouseholdId;
                        // refresh existingMembersForHousehold from that household
                        try {
                            const emRes2 = await client.get(`/households/${householdId}/members`);
                            existingMembersForHousehold = emRes2.data?.members || [];
                        } catch (e) {
                            existingMembersForHousehold = [];
                        }
                        memberId = memberId || globalFound._id;
                        // skip creating this member (we'll reuse existing)
                        continue;
                    } else {
                        // If the global member record lacks household info, just reuse the member id
                        memberId = memberId || globalFound._id;
                        continue;
                    }
                }

                const memberData = {
                    householdId,
                    firstName: name,
                    lastName: row['Last Name'],
                    phone: phoneMap?.[name.toLowerCase()] || row['Phone'],
                    tags: ['member', tag],
                    relationship: relationships.shift(),
                    gender: gender.shift()
                };
                console.log(`Creating member: ${memberData.firstName} ${memberData.lastName} phone=${previewText(memberData.phone,16)} tags=${(memberData.tags||[]).join(',')}`);
                const memberResponse = await client.post(`/members`, memberData);
                // create a normalized member object and add to cache
                const created = memberResponse.data?.member || { ...memberData, _id: (memberResponse.data?.id || memberResponse.data?.insertedId) };
                updateMemberCache(created);
                memberId = memberId || (created._id || memberResponse.data.id);
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
                    console.log(`Creating assignment: deacon=${assignmentData.deaconMemberId} household=${assignmentData.householdId}`);
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
            // Only create a single "last contact" entry here if there are no freeform notes.
            // If notes exist we'll let processNotesForContacts parse and create the appropriate entries
            if (lastContactDate && (!notes || !notes.toString().trim())) {
                const contactData = {
                    memberId: [memberId],
                    deaconId: lastContactDeacons?.map(d => d._id) || [],
                    contactType: notesLower.includes('visit') ? 'visit' : 'phone',
                    summary: notes,
                    contactDate: lastContactDate.format(),// ISO format
                    followUpRequired: false
                };
                console.log(`Creating contact log: member=${contactData.memberId?.[0]} deacons=${(contactData.deaconId||[]).join(',')} date=${contactData.contactDate} summary=${previewText(contactData.summary,120)}`);
                await client.post(`/contacts`, contactData);
            }
            processNotesForContacts(row, householdId, memberId, deaconResponse);
        } catch (error) {
            console.error('Failed to create household, member, or assignment:', error.message);
        }
    }
}

function splitNames(names) {
    return names.split(/[,&\/\\:|]+/).map(name => name.trim());
}

async function createDeacons() {
    console.log('Creating deacons...');
    for (const row of deaconsSheet) {
        console.log(`Deacon row: name=${previewText(row[" Deacon's Name"],60)} phone=${previewText(row['Phone'],24)} email=${previewText(row['Email'],40)}`);
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
            console.log(`Creating household for deacon: lastName=${householdData.lastName} address=${previewText(householdData.address?.street || '',80)}`);
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
            console.log(`Creating deacon member: ${deaconData.firstName} ${deaconData.lastName} phone=${previewText(deaconData.phone,16)} email=${previewText(deaconData.email,40)}`);
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
                console.log(`Creating spouse member: ${spouseData.firstName} ${spouseData.lastName} phone=${previewText(spouseData.phone,16)} email=${previewText(spouseData.email,40)}`);
                await client.post(`/members`, spouseData);
            }
        } catch (error) {
            console.error('Failed to create household, deacon, or spouse:', error.response?.data || error.message);
        }
    }
}

async function processNotesForContacts(row, householdId, memberId, deaconResponse) {
    const notes = (row['__EMPTY'] || '').toString(); // Assuming column I is labeled 'Notes'

    // Fetch existing contacts for this household to avoid creating duplicates.
    let existingContacts = [];
    try {
        const existingRes = await client.get(`/households/${householdId}/contacts`);
        existingContacts = existingRes.data?.contacts || [];
    } catch (e) {
        console.warn(`Warning: failed to fetch existing contacts for household ${householdId}: ${e.message}`);
        existingContacts = [];
    }

    // Also fetch existing household members so tokens that match members' names
    // are not mistaken for deacons in the notes parser.
    let existingMembers = [];
    try {
        const memRes = await client.get(`/households/${householdId}/members`);
        existingMembers = memRes.data?.members || [];
    } catch (e) {
        existingMembers = [];
    }

    // Build a lookup of existing contacts to detect duplicates more flexibly.
    // We'll keep both an exact-key set and a records array for substring matching.
    // Exact key format: `${isoDate}|${normalizedSummary}|${deaconId}`
    const existingSet = new Set();
    const existingRecords = []; // { dateDayIso, normSummary, deaconId }
    try {
        for (const ec of existingContacts) {
            const isoFull = ec.contactDate ? moment(ec.contactDate).toISOString() : '';
            const dateDayIso = ec.contactDate ? moment(ec.contactDate).startOf('day').toISOString() : '';
            const normSummary = (ec.summary || '').toString().trim().toLowerCase();
            const deaconIds = Array.isArray(ec.deaconId) ? ec.deaconId : [ec.deaconId];
            for (const did of deaconIds) {
                existingSet.add(`${isoFull}|${normSummary}|${did}`);
                existingRecords.push({ dateDayIso, normSummary, deaconId: did });
            }
        }
    } catch (e) {
        // non-fatal: proceed without dedupe if something unexpected
        console.warn('Warning building existing contacts lookup:', e.message);
    }

    // Determine last contact date and default deacon from row if present
    let lastContactDateMoment = null;
    try {
        if (row['Last Contact']) {
            // preserve previous behavior: spreadsheet date numbers were used earlier; accept if it's a Date or number
            if (moment.isMoment(row['Last Contact'])) {
                lastContactDateMoment = row['Last Contact'];
            } else if (row['Last Contact'] instanceof Date) {
                lastContactDateMoment = moment(row['Last Contact']);
            } else if (!isNaN(Number(row['Last Contact']))) {
                lastContactDateMoment = moment('1900-01-01').add(Number(row['Last Contact']) - 2, 'days');
            } else {
                const parsed = moment(row['Last Contact']);
                if (parsed.isValid()) lastContactDateMoment = parsed;
            }
        }
    } catch (e) {
        lastContactDateMoment = null;
    }

    const deacons = deaconResponse?.data?.deacons || [];
    // Helper to normalize names
    function normalizeName(s) { return (s || '').toString().trim().toLowerCase(); }
    // Build map of last-name -> deacon (first match)
    const lastNameMap = {};
    const initialsMap = {};
    for (const d of deacons) {
        const ln = normalizeName(d.lastName || d.last);
        if (ln) lastNameMap[ln] = d;
        // also map first names so tokens with just a first name can match
        const fn = normalizeName(d.firstName || d.first);
        if (fn && !lastNameMap[fn]) lastNameMap[fn] = d;
        const fi = (d.firstName || d.first || '').toString().trim();
        const la = (d.lastName || d.last || '').toString().trim();
        const initials = (fi[0] || '') + (la[0] || '');
        if (initials) initialsMap[initials.toUpperCase()] = d;
    }

    // Find default deacon from 'Last Contact Deacon' field if present
    let defaultDeacon = null;
    if (row['Last Contact Deacon']) {
        const lcNames = splitNames(row['Last Contact Deacon']);
        for (const n of lcNames) {
            const nn = normalizeName(n);
            // try full name first
            const foundFull = deacons.find(d => normalizeName(`${d.firstName} ${d.lastName}`) === nn);
            if (foundFull) { defaultDeacon = foundFull; break; }
            // try last name
            if (lastNameMap[nn]) { defaultDeacon = lastNameMap[nn]; break; }
            // try initials
            const initials = n.replace(/[^A-Za-z]/g, '').toUpperCase();
            if (initialsMap[initials]) { defaultDeacon = initialsMap[initials]; break; }
        }
    }

    // Prefer last-contact deacon and assigned deacons when resolving tokens:
    // Add them last into the lookup maps so they override earlier entries.
    try {
        const overrideDeacons = [];
        // last-contact deacons (may be multiple)
        if (row['Last Contact Deacon']) {
            const lcNames = splitNames(row['Last Contact Deacon']);
            for (const n of lcNames) {
                const nn = normalizeName(n);
                const found = deacons.find(d => normalizeName(`${d.firstName} ${d.lastName}`) === nn || normalizeName(d.lastName || d.last) === nn || ((d.firstName||d.first)||'').toString().trim().toLowerCase() === nn);
                if (found && !overrideDeacons.find(x => x._id === found._id)) overrideDeacons.push(found);
            }
        }
        // assigned deacons from the sheet
        if (row['Assigned Deacon']) {
            const asNames = splitNames(row['Assigned Deacon']);
            for (const n of asNames) {
                const nn = normalizeName(n);
                const found = deacons.find(d => normalizeName(`${d.firstName} ${d.lastName}`) === nn || normalizeName(d.lastName || d.last) === nn || ((d.firstName||d.first)||'').toString().trim().toLowerCase() === nn);
                if (found && !overrideDeacons.find(x => x._id === found._id)) overrideDeacons.push(found);
            }
        }
        // apply overrides: map last name, first name, and initials to these deacons (overwriting earlier mapping)
        for (const d of overrideDeacons) {
            const ln = normalizeName(d.lastName || d.last);
            if (ln) lastNameMap[ln] = d;
            const fn = normalizeName(d.firstName || d.first);
            if (fn) lastNameMap[fn] = d;
            const fi = (d.firstName || d.first || '').toString().trim();
            const la = (d.lastName || d.last || '').toString().trim();
            const initials = ((fi[0] || '') + (la[0] || '')).toUpperCase();
            if (initials) initialsMap[initials] = d;
        }
    } catch (e) {
        // non-fatal
    }

    // New word-by-word parsing: build summaries incrementally. Per instructions:
    // - start with an empty summary and use lastContactDateMoment as the date for the first summary
    // - iterate words; treat tokens that contain digits as date separators (only numeric-containing tokens are dates)
    // - detect deacon last-names or initials per-token and collect them into a deacon list for the current summary
    // - when hitting a date token and the current summary is non-empty, create a contact for the current summary
    //   (then reset summary and deacon list), and then start the new summary with the date token

    const createdSummaries = [];
    let currentSummary = '';
    const normalizeTokenForName = t => (t || '').toString().replace(/[^A-Za-z]/g, '').trim().toLowerCase();
    const normalizeTokenForInitials = t => (t || '').toString().replace(/[^A-Za-z]/g, '').toUpperCase();

    // Build quick member name lookups to avoid treating household member names as deacon tokens
    const memberNameSet = new Set();
    const memberInitialsSet = new Set();
    for (const m of existingMembers) {
        const fn = normalizeName(m.firstName || m.first || '');
        const ln = normalizeName(m.lastName || m.last || '');
        if (fn) memberNameSet.add(fn);
        if (ln) memberNameSet.add(ln);
        const full = `${(m.firstName||m.first||'').toString().trim()} ${(m.lastName||m.last||'').toString().trim()}`.trim().toLowerCase();
        if (full) memberNameSet.add(full);
        const fi = (m.firstName || m.first || '').toString().trim();
        const la = (m.lastName || m.last || '').toString().trim();
        const initials = ((fi[0] || '') + (la[0] || '')).toUpperCase();
        if (initials) memberInitialsSet.add(initials);
    }

    // helper: try to parse a date from a single token (only if token contains at least one digit)
    const currentYear = moment().year();
    function parseDateFromToken(tok) {
        if (!tok || !/\d/.test(tok)) return null;
        // strip leading/trailing non-date punctuation (keeps digits, -, /, .)
        const cleaned = tok.replace(/^[^\d\-\/\.]+|[^\d\-\/\.]+$/g, '');

        // 1) YYYY-MM-DD or YYYY/MM/DD
        const ymd = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/;
        let m = ymd.exec(cleaned);
        if (m) return moment({ year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) });

        // 2) MM-DD-YYYY or MM/DD/YYYY or MM-DD-YY or MM/DD/YY
        const mdy = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/;
        m = mdy.exec(cleaned);
        if (m) {
            let yr = Number(m[3]);
            if (String(m[3]).length === 2) {
                // interpret 2-digit years as 2000+YY
                yr = 2000 + yr;
            }
            return moment({ year: yr, month: Number(m[1]) - 1, day: Number(m[2]) });
        }

        // 3) MM/DD or M-D (assume current year)
        const two = /^(\d{1,2})[\/\-](\d{1,2})$/;
        m = two.exec(cleaned);
        if (m) return moment({ year: currentYear, month: Number(m[1]) - 1, day: Number(m[2]) });

        // 4) D.M or D.M.Y (dot-separated)
        const dot = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/;
        m = dot.exec(cleaned);
        if (m) {
            let yr = currentYear;
            if (m[3]) {
                yr = Number(m[3]);
                if (String(m[3]).length === 2) yr = 2000 + yr;
            }
            return moment({ year: yr, month: Number(m[2]) - 1, day: Number(m[1]) });
        }

        return null;
    }

    // initial contactMoment for the first summary
    let currentContactMoment = lastContactDateMoment || fileCreatedMoment || null;
    // initialize current deacons list with defaultDeacon if present
    let currentDeacons = defaultDeacon ? [defaultDeacon] : [];

    // Build words array preserving tokens like '10/25' and 'J.S.'; split on whitespace
    const words = notes.split(/\s+/).filter(Boolean);

    for (const rawWord of words) {
        const word = rawWord.trim();
        if (!word) continue;

        // 1) Check if this token looks like a date (must contain digits)
        const parsedDate = parseDateFromToken(word);
        if (parsedDate) {
            // If there is an accumulated summary, flush it as a contact using currentContactMoment
            const trimmed = currentSummary.trim();
            if (trimmed) {
                const contactMomentObj = (currentContactMoment && currentContactMoment.isValid()) ? currentContactMoment.clone() : null;
                const contactDate = contactMomentObj ? contactMomentObj.toISOString() : null;
                const normSummary = trimmed.toLowerCase();

                // choose deacon for this summary: prefer any collected, else defaultDeacon
                const deaconList = (currentDeacons && currentDeacons.length) ? currentDeacons : (defaultDeacon ? [defaultDeacon] : []);
                const deaconIds = deaconList.map(d => d._id).filter(Boolean);

                    if (contactMomentObj && deaconIds.length) {
                        const dateDayIso = contactMomentObj.startOf('day').toISOString();
                    const isExisting = existingRecords.some(er => deaconIds.includes(er.deaconId) && er.dateDayIso === dateDayIso && (er.normSummary.includes(normSummary) || normSummary.includes(er.normSummary)));
                    const isCreated = createdSummaries.some(cs => cs.includes(normSummary) || normSummary.includes(cs));
                    if (isExisting) {
                        console.log(`Skipping duplicate contact (already exists): date=${contactDate} deacons=${deaconIds.join(',')} summary="${previewText(trimmed,120)}"`);
                    } else if (isCreated) {
                        console.log(`Skipping duplicate contact (created earlier this run): date=${contactDate} deacons=${deaconIds.join(',')} summary="${previewText(trimmed,120)}"`);
                    } else {
                        const contactData = {
                            memberId: [memberId],
                            deaconId: deaconIds,
                            contactType: trimmed.toLowerCase().includes('visit') ? 'visit' : 'phone',
                            summary: trimmed,
                            contactDate,
                            followUpRequired: false
                        };
                        console.log(`Creating contact log: member=${memberId} deacons=${deaconIds.join(',')} date=${contactDate} summary=${previewText(trimmed,120)}`);
                        await client.post(`/contacts`, contactData);
                        createdSummaries.push(normSummary);
                    }
                } else {
                    console.warn(`Skipping contact (insufficient data): date=${contactDate || 'n/a'} deacons=${deaconIds.join(',') || 'n/a'} summary="${previewText(trimmed,120)}"`);
                }
                // reset summary and deacons for next segment
                currentSummary = '';
                currentDeacons = defaultDeacon ? [defaultDeacon] : [];
            }

            // Now start the new summary with this date token and set currentContactMoment to parsedDate
            currentContactMoment = parsedDate && parsedDate.isValid() ? parsedDate : currentContactMoment;
            currentSummary = word;
            continue;
        }

        // 2) Not a numeric date token — check if token is a deacon last name or initials
        const tryLn = normalizeTokenForName(word);
        if (tryLn && lastNameMap[tryLn]) {
            // If this token matches a household member's name, do NOT treat it as a deacon token.
            if (memberNameSet.has(tryLn)) {
                currentSummary = (currentSummary + ' ' + word).trim();
                continue;
            }
            const d = lastNameMap[tryLn];
            if (!currentDeacons.find(x => x._id === d._id)) currentDeacons.push(d);
            // also include the word in the summary
            currentSummary = (currentSummary + ' ' + word).trim();
            continue;
        }

        const tryInit = normalizeTokenForInitials(word);
        if (tryInit && initialsMap[tryInit]) {
            // If the initials match a household member, don't treat as deacon
            if (memberInitialsSet.has(tryInit)) {
                currentSummary = (currentSummary + ' ' + word).trim();
                continue;
            }
            const d = initialsMap[tryInit];
            if (!currentDeacons.find(x => x._id === d._id)) currentDeacons.push(d);
            currentSummary = (currentSummary + ' ' + word).trim();
            continue;
        }

        // 3) Otherwise, append token to current summary
        currentSummary = (currentSummary + ' ' + word).trim();
    }

    // After looping, flush any remaining summary as a contact
    const finalTrim = currentSummary.trim();
    if (finalTrim) {
        const contactMomentObj = (currentContactMoment && currentContactMoment.isValid()) ? currentContactMoment.clone() : null;
        const contactDate = contactMomentObj ? contactMomentObj.toISOString() : null;
        const normSummary = finalTrim.toLowerCase();
        const deaconList = (currentDeacons && currentDeacons.length) ? currentDeacons : (defaultDeacon ? [defaultDeacon] : []);
        const deaconIds = deaconList.map(d => d._id).filter(Boolean);
        if (contactMomentObj && deaconIds.length) {
            const dateDayIso = contactMomentObj.startOf('day').toISOString();
            const isExisting = existingRecords.some(er => deaconIds.includes(er.deaconId) && er.dateDayIso === dateDayIso && (er.normSummary.includes(normSummary) || normSummary.includes(er.normSummary)));
            const isCreated = createdSummaries.some(cs => cs.includes(normSummary) || normSummary.includes(cs));
            if (isExisting) {
                console.log(`Skipping duplicate contact (already exists): date=${contactDate} deacons=${deaconIds.join(',')} summary="${previewText(finalTrim,120)}"`);
            } else if (isCreated) {
                console.log(`Skipping duplicate contact (created earlier this run): date=${contactDate} deacons=${deaconIds.join(',')} summary="${previewText(finalTrim,120)}"`);
            } else {
                const contactData = {
                    memberId: [memberId],
                    deaconId: deaconIds,
                    contactType: finalTrim.toLowerCase().includes('visit') ? 'visit' : 'phone',
                    summary: finalTrim,
                    contactDate,
                    followUpRequired: false
                };
                console.log(`Creating contact log: member=${memberId} deacons=${deaconIds.join(',')} date=${contactDate} summary=${previewText(finalTrim,120)}`);
                await client.post(`/contacts`, contactData);
                createdSummaries.push(normSummary);
            }
        } else {
            console.warn(`Skipping final contact (insufficient data): date=${contactDate || 'n/a'} deacons=${deaconIds.join(',') || 'n/a'} summary="${previewText(finalTrim,120)}"`);
        }
    }
}

async function main() {
    try {
        // await createDeacons();
        await createHouseholdsAndMembers();
        console.log('Data generation completed successfully.');
    } catch (error) {
        console.error('Error during data generation:', error.message);
    }
}

main();
