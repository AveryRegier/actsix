# Address Functionality Refactoring Plan

## Current State Analysis

### Existing Address Code Locations

1. **Frontend (site/)**
   - `edit-household.html` - Complex address parsing, zip code validation, auto-fill logic (~200 lines)
   - `household.html` - Address display, Google Maps integration
   - `deacon-quick-contact.html` - Address display with maps links
   - `record-contact.html` - Address display only

2. **Backend (src/api/)**
   - `households.js` - Address validation function, PATCH/POST handlers
   - No member-level address support currently

3. **Utilities**
   - `contact-utils.js` - Contact method utilities (phone/address display)
   - `fetch-utils.js` - API fetch wrapper
   - `iowa_zip_codes.json` - Static zip code data

### Current Limitations

- Address only at household level (not member level)
- Address parsing logic embedded in single HTML file
- Zip code validation logic not reusable
- No support for temporary addresses
- No common location presets (hospitals, nursing homes, etc.)

## Proposed Architecture

### Option 1: Shared JavaScript Module (RECOMMENDED)

**Create:** `site/address-utils.js`

**Benefits:**
- Standard ES6 module pattern (matching existing `fetch-utils.js`, `contact-utils.js`)
- Easy to import and use across all pages
- Can be cached by browser
- Clean separation of concerns
- Testable in isolation

**Structure:**
```javascript
// site/address-utils.js

export const COMMON_LOCATIONS = {
  'hospitals': [
    { name: 'Iowa Methodist Medical Center', address: {...}, type: 'hospital' },
    { name: 'Mercy Medical Center', address: {...}, type: 'hospital' }
  ],
  'nursing_homes': [...],
  'assisted_living': [...]
};

export async function loadZipCodeData() { ... }

export function parseFullAddress(addressString) { ... }

export function validateZipCode(zipCode, cityName, zipCodeData) { ... }

export function setupAddressFields(config) { ... }

export function createAddressComponent(elementId, options = {}) { ... }

export function formatAddressForDisplay(addressObj) { ... }

export function formatAddressForMaps(addressObj) { ... }
```

### Option 2: Web Component

**Create:** Custom `<address-editor>` component

**Benefits:**
- Fully encapsulated styling and behavior
- Reusable as simple HTML tag
- Shadow DOM isolation
- Modern browser standard

**Drawbacks:**
- More complex initial setup
- Need to ensure browser compatibility
- May not match current architecture patterns

### Option 3: HTML Template + Includes

**Create:** `site/address-form-template.html` + JavaScript controller

**Benefits:**
- Familiar pattern (already using with `site-nav.html`)
- Easy to understand

**Drawbacks:**
- Less flexible than modules
- Requires fetch/load on each use
- State management more complex

## Recommended Solution: Option 1 - Shared Module

### Implementation Plan

#### Phase 1: Create Core Utilities ✅ COMPLETED

1. **✅ Create `site/address-utils.js`**
   - Extracted 12+ utility functions from edit-household.html
   - `parseFullAddress(text)` - Parse pasted addresses
   - `validateCityForZip(zip, city, data)` - Validate & auto-fill
   - `setupAddressAutofill(config)` - Wire up event handlers
   - `loadZipCodeData()` - Async load JSON
   - `formatAddressForDisplay()` - Format for display
   - `formatAddressForMaps()` - Generate Google Maps URLs
   - `populateAddressFields()` - Populate form fields
   - `getAddressFromFields()` - Extract address from form

2. **✅ Create `site/common-locations.json`**
   - 27 validated locations (8 hospitals, 8 nursing homes, 9 assisted living, 2 rehab)
   - Includes: name, type, address (street/city/state/zip), phone, website, visitingHours
   - All websites and visiting hours validated via web research
   - Google Maps validation completed

3. **✅ Refactor `edit-household.html`**
   - Reduced from ~460 lines to ~254 lines
   - Imports address-utils.js module
   - Uses utility functions instead of inline logic
   - All existing functionality preserved and tested

#### Phase 2: Refactor Other Pages (Next)

1. **Update `household.html`**
   - Import address-utils.js
   - Use `formatAddressForDisplay()` for consistent display
   - Use `formatAddressForMaps()` for Google Maps links

2. **Update `record-contact.html`**
   - Import address-utils.js
   - Use `formatAddressForDisplay()` for address display

3. **Update `deacon-quick-contact.html`**
   - Import address-utils.js
   - Use formatting utilities for consistency

#### Phase 3: Backend Support for Member Temporary Addresses

1. **Update `src/api/members.js`**
   ```javascript
   // Add temporary address fields to member schema
   {
     temporaryAddress: {
       street: String,
       city: String,
       state: String,
       zipCode: String,
       roomNumber: String,
       startDate: Date,
       endDate: Date,
       locationType: String,  // 'hospital', 'nursing_home', etc.
       notes: String
     }
   }
   ```

2. **Extract validation to shared module**
   - Create `src/util/address-validation.js`
   - Move `validateAddress()` from households.js
   - Reuse in both households and members APIs

3. **Add API endpoints**
   - `PATCH /api/members/:id/temporary-address`
   - `PATCH /api/members/:id/temporary-address`
   - `DELETE /api/members/:id/temporary-address`

#### Phase 4: Member UI for Temporary Addresses

1. **Update `edit-member.html`**
   - Add temporary address section using address-utils
   - Add room number field
   - Add date range fields (start/end)
   - Add location type dropdown (hospital, nursing_home, assisted_living, rehab)
   - Add notes field
   - Add "Use Common Location" dropdown (populated from common-locations.json)
   - Wire up address autofill functionality

2. **Update member display pages**
   - Modify display logic: Show temp address if present and date range valid
   - Show indicator when displaying temporary address
   - Display "at [location name] until [end date]"

3. **Update contact recording**
   - Use temporary address when recording contacts if active
   - Show both household and temporary address for context

### File Structure (Current State)

```
site/
  ├── address-utils.js          # ✅ NEW: Core address utilities (12+ functions)
  ├── common-locations.json     # ✅ NEW: 27 validated locations with websites/hours
  ├── contact-utils.js          # Existing
  ├── fetch-utils.js            # Existing
  ├── edit-household.html       # ✅ REFACTORED: ~460 lines → ~254 lines
  ├── edit-member.html          # TODO Phase 4: Add temp address support
  ├── household.html            # TODO Phase 2: Use address-utils
  ├── record-contact.html       # TODO Phase 2: Use address-utils
  └── iowa_zip_codes.json       # Existing

src/
  ├── api/
  │   ├── households.js         # TODO Phase 3: Extract shared validation
  │   ├── members.js            # TODO Phase 3: Add temp address endpoints
  │   └── locations.js          # OPTIONAL: Common locations API
  └── util/
      ├── address-validation.js # TODO Phase 3: Shared validation logic
      └── helpers.js            # Existing
```

## API Design

### Member Temporary Address

```javascript
// GET /api/members/:id
{
  _id: "...",
  firstName: "John",
  temporaryAddress: {
    street: "Iowa Methodist Medical Center",
    city: "Des Moines",
    state: "IA",
    zipCode: "50309",
    roomNumber: "420",
    startDate: "2026-02-01",
    endDate: "2026-02-15",
    locationType: "hospital",
    notes: "Post-surgery recovery"
  }
}

// PATCH /api/members/:id/temporary-address
{
  temporaryAddress: { ... }
}

// DELETE /api/members/:id/temporary-address
// Removes temporary address
```

### Common Locations (Phase 4 - Using JSON file)

```javascript
// Frontend loads from /common-locations.json
{
  "locations": [
    {
      "name": "Iowa Methodist Medical Center",
      "type": "hospital",
      "address": {
        "street": "1200 Pleasant St",
        "city": "Des Moines",
        "state": "IA",
        "zipCode": "50309"
      },
      "phone": "(515) 241-6212",
      "website": "https://...",
      "visitingHours": "7:00 AM - 8:00 PM daily"
    }
  ]
}
```

**Note:** Common locations are stored as static JSON initially. Future enhancement could move to database with admin UI for management.

## Migration Strategy

### Backward Compatibility

1. Keep existing household address unchanged
2. Add optional temporaryAddress to members (default null)
3. Display logic: Show temp address if present and date range valid, else household address
4. Frontend handles graceful fallback

### Rollout Steps

1. **✅ Phase 1 Complete** - Utilities deployed, no breaking changes
2. **In Progress: Phase 2** - Refactor remaining pages (household.html, record-contact.html, deacon-quick-contact.html)
3. **Phase 3** - Add member temp address backend support (opt-in feature)
4. **Phase 4** - Add member temp address UI with common locations picker
5. **Final** - Update all address displays to check temp address first

## Testing Strategy

1. **✅ Unit tests** for address-utils.js functions
   - Parse various address formats ✅
   - Zip code validation edge cases ✅
   - Multi-city zip code handling (e.g., Urbandale/Des Moines zip 50322) ✅
   - ZIP+4 format support ✅

2. **Integration tests** for API endpoints (Phase 3)
   - Member temp address CRUD
   - Validation rules
   - Authorization checks

3. **Manual testing** checklist
   - [x] Edit household - paste full address
   - [x] Edit household - zip auto-fills city/state
   - [x] Edit household - handles ZIP+4 format
   - [ ] Edit member - add temporary address (Phase 4)
   - [ ] Member display shows temp address during date range (Phase 4)
   - [ ] Record contact shows correct address (temp vs household) (Phase 4)
   - [ ] Common location dropdown populates addresses (Phase 4)
   - [ ] Room number field appears/disappears correctly (Phase 4)

## Code Example: Using New Utilities

### Before (edit-household.html - ~460 lines)
```javascript
// 200+ lines of inline code for parsing, validation, etc.
streetField.addEventListener('input', function() {
  var value = streetField.value;
  var zipMatch = value.match(/\b(\d{5}(?:-\d{4})?)\b/);
  // ... 150 more lines ...
});
```

### After (edit-household.html - ~254 lines) ✅ COMPLETED
```javascript
import { setupAddressAutofill, loadZipCodeData } from './address-utils.js';

loadZipCodeData().then(zipData => {
  setupAddressAutofill({
    streetField: 'addressStreet',
    cityField: 'addressCity',
    stateField: 'addressState',
    zipField: 'addressZipCode',
    zipCodeData: zipData
  });
});
```

### Phase 4: edit-member.html with temp address
```javascript
import { 
  setupAddressAutofill, 
  loadZipCodeData 
} from './address-utils.js';
import { loadCommonLocations } from './common-locations.js';  // New helper

// Load common locations into dropdown
loadCommonLocations().then(locations => {
  const dropdown = document.getElementById('locationDropdown');
  locations.forEach(location => {
    const option = document.createElement('option');
    option.value = JSON.stringify(location);
    option.textContent = `${location.name} (${location.type})`;
    dropdown.appendChild(option);
  });
  
  // Handle location selection
  dropdown.addEventListener('change', (e) => {
    if (e.target.value) {
      const location = JSON.parse(e.target.value);
      populateAddressFields('temp', location.address);
      document.getElementById('tempRoomNumber').focus();
    }
  });
});

// Setup autofill for temporary address fields
loadZipCodeData().then(zipData => {
  setupAddressAutofill({
    streetField: 'tempAddressStreet',
    cityField: 'tempAddressCity',
    stateField: 'tempAddressState',
    zipField: 'tempAddressZipCode',
    zipCodeData: zipData
  });
});
```

## Benefits of This Approach

1. **✅ DRY Principle** - Single source of truth for address logic (achieved in Phase 1)
2. **✅ Maintainable** - Fix bugs in one place, benefits all pages (proven with edit-household.html)
3. **✅ Extensible** - Easy to add new features (validated with common locations JSON)
4. **✅ Testable** - Pure functions can be unit tested (address parsing, zip validation tested)
5. **✅ Consistent** - Same behavior across all forms (when Phase 2 complete)
6. **✅ Performance** - Shared module cached, loaded once
7. **✅ Readable** - HTML pages focus on page logic (~46% code reduction in edit-household.html)

## Timeline

- **✅ Phase 1 (Completed):** Create utilities, common-locations.json, refactor edit-household.html
- **Phase 2 (Next):** Refactor household.html, record-contact.html, deacon-quick-contact.html
- **Phase 3 (Future):** Backend support for member temp addresses
- **Phase 4 (Future):** Member temp address UI with common locations picker
- **Phase 5 (Future):** Testing, documentation, deployment

## Progress Summary

**Completed:**
- ✅ Created address-utils.js with 12+ utility functions
- ✅ Created common-locations.json with 27 validated locations
- ✅ Validated all website URLs and visiting hours
- ✅ Refactored edit-household.html (reduced from ~460 to ~254 lines)
- ✅ Tested address parsing, zip validation, ZIP+4 format support
- ✅ Build and server validation successful

**Next Steps:**
1. Phase 2: Refactor remaining display pages to use address-utils
2. Phase 3: Design and implement backend schema for member temporary addresses
3. Phase 4: Build member UI for temporary address management
