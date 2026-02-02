# Phase 3: Temporary Address Support - Technical Design

## Overview
Add backend support for member temporary addresses (hospital stays, nursing home, rehab, etc.) with structured location references.

## Data Model Changes

### 1. Common Locations Collection (NEW)

Move from `site/common-locations.json` to backend collection with IDs.

```javascript
// Collection: common_locations
{
  _id: ObjectId,              // Auto-generated unique ID
  name: String,               // "UnityPoint Iowa Methodist Medical Center"
  type: String,               // "hospital" | "nursing_home" | "assisted_living" | "rehab"
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  phone: String,              // "(515) 241-6212"
  website: String,            // URL
  visitingHours: String,      // "7:00 AM - 8:00 PM daily"
  isActive: Boolean,          // true (allow soft delete)
  createdAt: Date,
  updatedAt: Date
}
```

**Indices:**
- Primary: `_id`
- Query: `type` (for filtering by location type)
- Query: `isActive` (exclude deleted)

### 2. Member Schema Updates

Add optional temporary address with structured location reference:

```javascript
// Collection: members (UPDATED)
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  householdId: ObjectId,
  phone: String,
  email: String,
  gender: String,
  tags: [String],
  relationship: String,
  age: Number,
  birthDate: Date,
  
  // NEW: Temporary address support
  temporaryAddress: {           // Optional - only present when member has temp location
    locationId: ObjectId,       // Reference to common_locations._id
    roomNumber: String,         // "Room 312" or "Unit B-14"
    startDate: Date,            // When they moved to temp location
    endDate: Date,              // Optional - expected return date
    notes: String,              // Optional - "Recovering from surgery"
    isActive: Boolean           // true = currently at temp location
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

**Business Rules:**
- Member can only have ONE active temporary address at a time
- `temporaryAddress.isActive = true` means member is currently at that location
- When `isActive = false`, it's historical data (past temporary stay)
- Setting new temp address automatically archives previous one (sets `isActive = false`)

**Indices (existing):**
- Primary: `_id`
- Query: `householdId_1`
- Query: `tags_1`

**New Index:**
- Query: `temporaryAddress.isActive_1` (find all members currently at temp locations)
- Query: `temporaryAddress.locationId_1` (find all members at specific location)

## API Endpoints

### Common Locations API

```javascript
// GET /api/common-locations
// Returns all active common locations
// Auth: deacon, staff, member (read-only)
Response: {
  locations: [
    {
      _id: "507f1f77bcf86cd799439011",
      name: "UnityPoint Iowa Methodist",
      type: "hospital",
      address: {...},
      phone: "...",
      website: "...",
      visitingHours: "..."
    }
  ],
  count: 27
}

// GET /api/common-locations/:id
// Get specific location details
// Auth: deacon, staff, member
Response: {
  location: { _id, name, type, address, ... }
}

// POST /api/common-locations
// Add new common location (admin only)
// Auth: staff only
Body: { name, type, address, phone, website, visitingHours }
Response: { locationId: "..." }

// PUT /api/common-locations/:id
// Update location (admin only)
// Auth: staff only
Body: { name?, type?, address?, phone?, website?, visitingHours? }
Response: { success: true }

// DELETE /api/common-locations/:id
// Soft delete (set isActive = false)
// Auth: staff only
Response: { success: true }
```

### Member Temporary Address API

```javascript
// PUT /api/members/:memberId/temporary-address
// Set or update member's temporary address
// Auth: deacon, staff
Body: {
  locationId: "507f1f77bcf86cd799439011",  // Required - from common_locations
  roomNumber: "Room 312",                   // Required
  startDate: "2026-02-01",                  // Required
  endDate: "2026-02-15",                    // Optional
  notes: "Recovering from hip surgery"      // Optional
}
Response: {
  success: true,
  member: { _id, firstName, lastName, temporaryAddress: {...} }
}

// DELETE /api/members/:memberId/temporary-address
// Clear member's temporary address (mark as returned home)
// Auth: deacon, staff
Response: {
  success: true,
  member: { _id, firstName, lastName }
}

// GET /api/members/:memberId/temporary-address-history
// Get member's temporary address history
// Auth: deacon, staff
Response: {
  history: [
    {
      location: { _id, name, type, address },
      roomNumber: "Room 312",
      startDate: "2026-01-15",
      endDate: "2026-01-30",
      notes: "Hip surgery recovery"
    }
  ]
}

// GET /api/temporary-locations/active
// Get all members currently at temporary locations
// Auth: deacon, staff
Response: {
  members: [
    {
      _id: "...",
      firstName: "John",
      lastName: "Smith",
      householdId: "...",
      temporaryAddress: {
        location: { name, type, address, visitingHours },
        roomNumber: "Room 312",
        startDate: "2026-02-01",
        notes: "..."
      }
    }
  ],
  count: 5
}
```

## Validation Rules

### Common Locations
- `name`: required, 1-200 chars
- `type`: required, must be one of: `hospital`, `nursing_home`, `assisted_living`, `rehab`
- `address.street`: required
- `address.city`: required
- `address.state`: required, 2 chars
- `address.zipCode`: required, valid format
- `phone`: optional, valid phone format
- `website`: optional, valid URL
- `visitingHours`: optional, string

### Temporary Address
- `locationId`: required, must exist in `common_locations`
- `roomNumber`: required, 1-50 chars
- `startDate`: required, valid date, cannot be in far future
- `endDate`: optional, must be after startDate
- `notes`: optional, max 500 chars
- Cannot set temp address if member already has active one (must clear first)

## Migration Strategy

### Step 1: Create common_locations collection
```javascript
// scripts/migrate-locations.js
// 1. Read site/common-locations.json
// 2. Insert each location into common_locations collection with:
//    - Auto-generated _id
//    - isActive: true
//    - createdAt, updatedAt timestamps
// 3. Log mapping of old array index to new ObjectId
```

### Step 2: Update API layer
- Create `src/api/common-locations.js`
- Update `src/api/members.js` with temp address endpoints
- Update `src/api.js` to register new routes

### Step 3: Update frontend (Phase 4)
- Update address-utils.js to fetch from API instead of JSON
- Update edit pages to show temp address UI

## Database Seed Data

All 27 locations from `site/common-locations.json` will be migrated:
- 8 hospitals
- 8 nursing homes
- 9 assisted living facilities
- 2 rehab centers

## Backward Compatibility

- Existing members without `temporaryAddress` field continue to work
- Household addresses remain unchanged
- Frontend can gracefully handle missing temp address data

## Security Considerations

- Only deacons and staff can modify temporary addresses
- Members can view locations but not modify
- Common locations admin functions restricted to staff only
- Validate locationId exists before setting temp address
- Prevent orphaned locationId references

## Performance Considerations

- Index on `temporaryAddress.isActive` for fast "current temp locations" queries
- Index on `temporaryAddress.locationId` for location-based lookups
- Cache common_locations list (changes infrequently)
- Consider denormalizing location name into temporaryAddress for display performance

## Testing Checklist

- [ ] Create common_locations collection
- [ ] Migrate 27 locations from JSON to collection
- [ ] GET /api/common-locations returns all locations
- [ ] PUT /api/members/:id/temporary-address sets temp address
- [ ] Cannot set temp address with invalid locationId
- [ ] Cannot set temp address if one already active
- [ ] DELETE /api/members/:id/temporary-address clears temp address
- [ ] GET /api/temporary-locations/active returns members at temp locations
- [ ] Address display logic prefers temp address over household address
- [ ] Visiting hours displayed for temp locations
- [ ] Historical temp addresses preserved

## Open Questions

1. **History Storage**: Should we keep full history of temp addresses or just current + last N?
   - **Recommendation**: Keep full history, add `isActive` flag. Disk is cheap, history is valuable.

2. **Multiple Concurrent Addresses**: Should we support multiple active temp addresses?
   - **Recommendation**: No. Keep simple - one active location at a time. Use start/end dates for transitions.

3. **Location Changes**: What happens to member records if a location is deleted?
   - **Recommendation**: Soft delete only (isActive=false). Preserve historical data integrity.

4. **Room Number Format**: Standardize format or free text?
   - **Recommendation**: Free text. Different facilities use different formats.

5. **Notification**: Should system notify deacons when temp address end date approaches?
   - **Recommendation**: Phase 5. Keep Phase 3 focused on data model.
