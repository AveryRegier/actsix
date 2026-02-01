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

#### Phase 1: Create Core Utilities (Week 1)

1. **Create `site/address-utils.js`**
   ```javascript
   // Core functions to extract from edit-household.html:
   - parseFullAddress(text)          // Parse pasted addresses
   - validateZipCode(zip, city, data) // Validate & auto-fill
   - setupAddressAutofill(fieldIds)   // Wire up event handlers
   - loadZipCodeData()                // Async load JSON
   ```

2. **Create `site/common-locations.json`**
   ```json
   {
     "hospitals": [...],
     "nursing_homes": [...],
     "assisted_living": [...]
   }
   ```

3. **Create reusable address form component helper**
   ```javascript
   // Returns configured form fields with event handlers
   export function createAddressFields(options = {
     prefix: 'address',           // Field ID prefix
     includeRoomNumber: false,    // Add room # field
     showCommonLocations: false,  // Show location dropdown
     autoFill: true,              // Enable parsing/validation
     onAddressChange: null        // Callback
   })
   ```

#### Phase 2: Refactor Existing Pages (Week 2)

1. **Refactor `edit-household.html`**
   - Import `address-utils.js`
   - Replace inline logic with utility functions
   - Test all existing functionality

2. **Update `edit-member.html`**
   - Add temporary address section
   - Use `createAddressFields({ prefix: 'temp', includeRoomNumber: true })`
   - Add "Use Common Location" dropdown

3. **Update other pages as needed**
   - `household.html` - Use `formatAddressForDisplay()`
   - `record-contact.html` - Use `formatAddressForDisplay()`

#### Phase 3: Backend Support (Week 3)

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
   - `DELETE /api/members/:id/temporary-address`

#### Phase 4: Common Locations Feature (Week 4)

1. **Create location management**
   - Admin page to manage common locations
   - Store in MongoDB collection
   - Cache on frontend

2. **Add location picker UI**
   ```javascript
   // In address-utils.js
   export function createLocationPicker(containerId) {
     // Dropdown with common locations
     // Auto-fills address when selected
     // Shows room number field
   }
   ```

### File Structure (Final State)

```
site/
  ├── address-utils.js          # NEW: Core address utilities
  ├── common-locations.json     # NEW: Location presets (or from API)
  ├── contact-utils.js          # Existing
  ├── fetch-utils.js            # Existing
  ├── edit-household.html       # REFACTORED: Use address-utils
  ├── edit-member.html          # UPDATED: Add temp address support
  └── iowa_zip_codes.json       # Existing

src/
  ├── api/
  │   ├── households.js         # REFACTORED: Use shared validation
  │   ├── members.js            # UPDATED: Add temp address endpoints
  │   └── locations.js          # NEW: Common locations API
  └── util/
      ├── address-validation.js # NEW: Shared validation logic
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

### Common Locations

```javascript
// GET /api/locations
{
  locations: [
    {
      _id: "...",
      name: "Iowa Methodist Medical Center",
      type: "hospital",
      address: {
        street: "1200 Pleasant St",
        city: "Des Moines",
        state: "IA",
        zipCode: "50309"
      },
      phone: "(515) 241-6212"
    }
  ]
}

// POST /api/locations (staff only)
// PUT /api/locations/:id (staff only)
```

## Migration Strategy

### Backward Compatibility

1. Keep existing household address unchanged
2. Add optional temporaryAddress to members (default null)
3. Display logic: Show temp address if present and date range valid, else household address
4. Frontend handles graceful fallback

### Rollout Steps

1. **Deploy utilities** (no breaking changes)
2. **Refactor existing pages** (behavior unchanged)
3. **Add member temp address** (opt-in feature)
4. **Add common locations** (enhancement)
5. **Update all address displays** to check temp address first

## Testing Strategy

1. **Unit tests** for address-utils.js functions
   - Parse various address formats
   - Zip code validation edge cases
   - Multi-city zip code handling

2. **Integration tests** for API endpoints
   - Member temp address CRUD
   - Validation rules
   - Authorization checks

3. **Manual testing** checklist
   - [ ] Edit household - paste full address
   - [ ] Edit household - zip auto-fills city/state
   - [ ] Edit member - add temporary address
   - [ ] Member display shows temp address during date range
   - [ ] Record contact shows correct address (temp vs household)
   - [ ] Common location dropdown populates addresses
   - [ ] Room number field appears/disappears correctly

## Code Example: Using New Utilities

### Before (edit-household.html)
```javascript
// 200+ lines of inline code for parsing, validation, etc.
streetField.addEventListener('input', function() {
  var value = streetField.value;
  var zipMatch = value.match(/\b(\d{5}(?:-\d{4})?)\b/);
  // ... 150 more lines ...
});
```

### After (edit-household.html)
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

### New (edit-member.html with temp address)
```javascript
import { 
  setupAddressAutofill, 
  loadZipCodeData,
  createLocationPicker 
} from './address-utils.js';

// Add location picker
createLocationPicker('locationDropdown', {
  onSelect: (location) => {
    fillAddressFields('temp', location.address);
    document.getElementById('tempRoomNumber').focus();
  }
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

1. **DRY Principle** - Single source of truth for address logic
2. **Maintainable** - Fix bugs in one place, benefits all pages
3. **Extensible** - Easy to add new features (international addresses, etc.)
4. **Testable** - Pure functions can be unit tested
5. **Consistent** - Same behavior across all forms
6. **Performance** - Shared module cached, loaded once
7. **Readable** - HTML pages focus on page logic, not address parsing

## Timeline

- **Week 1:** Create utilities, test thoroughly
- **Week 2:** Refactor existing pages, ensure no regressions
- **Week 3:** Backend support for member temp addresses
- **Week 4:** Common locations feature
- **Week 5:** Testing, documentation, deployment

## Next Steps

1. Review this plan with team
2. Create GitHub issues/bd issues for each phase
3. Start with Phase 1 (create utilities)
4. Incremental deployment with feature flags if needed
