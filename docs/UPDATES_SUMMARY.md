````markdown
# Deacon Care System - Recent Updates

NOTE: Formal MUST/SHOULD constraints were moved to `docs/REQUIREMENTS.md`. This file is a changelog and implementation summary; check REQUIREMENTS.md for authoritative requirements.

## Summary of Changes Made

### 1. Household field adjustments
- `lastName` is the primary household identifier used in search and display.
- Address, phone number, email, and notes are handled as optional fields in the household form; the system ensures a reachable contact point exists (household-level or member-level).

### 2. Member field adjustments
- Member records include fields for `firstName`, `lastName`, `householdId`, `relationship`, and `gender`.
- A gender field was added; current data uses `male`/`female` values. (See `docs/REQUIREMENTS.md` for enforcement details.)
- A tag system was implemented to replace a rigid status field; tags are stored as an array.

### 3. Age vs Birthday Handling
- The UI accepts either an approximate `age` OR a precise `birthDate` for a member. Both fields are supported in the data model; see the requirements doc for validation rules.

### 4. Phone Number Validation
- The UI and API validation were updated so the application enforces that at least one reachable phone number exists for a household (either at household level or via member entries).

### 5. Updated Data Models (illustrative)

#### Household Schema (illustrative)
```javascript
{
  _id: ObjectId,
  lastName: String,
  address: { street: String, city: String, state: String, zipCode: String },
  primaryPhone: String,
  email: String,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Member Schema (illustrative)
```javascript
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  householdId: ObjectId,
  relationship: String,
  gender: String,
  tags: [String],
  age: Number,
  birthDate: Date,
  phone: String,
  email: String,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 6. Frontend Updates
- Household form now displays optional fields clearly.
- Member form includes gender selection and tag checkboxes.
- UI supports either age or birth date input with clear labeling.
- Display shows tags instead of the older status field.

### 7. API Validation (implementation notes)
- Household and member validation updated to reflect the changes above. See `docs/REQUIREMENTS.md` for authoritative validation rules and error messages.

````
# Deacon Care System - Recent Updates

## Summary of Changes Made

### 1. Household Requirements Updated
- **Only `lastName` is required** for creating a household
- **Address is now optional** - can be empty or partially filled
- **Phone number is optional** at household level
- **Email and notes are optional**

### 2. Member Requirements Updated
- **Required fields**: `firstName`, `lastName`, `householdId`, `relationship`, `gender`
- **Gender field added**: Must be `male` or `female`
- **Tags system implemented**: Replaced status with flexible tags
  - Available tags: `member`, `attender`, `in-small-group`, `shut-in`, `cancer`, `long-term-needs`, `widow`, `widower`, `married`, `deceased`
  - Members can have multiple tags
  - Tags are stored as an array

### 3. Age vs Birthday Handling
- **Either age OR birthDate** can be provided, but not both
- **Age**: Number field for approximate age when birthdate is unknown
- **Birth Date**: Date field for exact birth date when known
- Both fields are optional

### 4. Phone Number Validation
- **At least one phone number required per household**
- Can be at household level OR member level
- Validation ensures no household is left without any contact number

### 5. Updated Data Models

#### Household Schema
```javascript
{
  _id: ObjectId,
  lastName: String,        // Required
  address: {              // Optional
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  primaryPhone: String,    // Optional
  email: String,          // Optional
  notes: String,          // Optional
  createdAt: Date,
  updatedAt: Date
}
```

#### Member Schema
```javascript
{
  _id: ObjectId,
  firstName: String,      // Required
  lastName: String,       // Required
  householdId: ObjectId,  // Required
  relationship: String,   // Required: 'head', 'spouse', 'child', 'other'
  gender: String,         // Required: 'male', 'female'
  tags: [String],         // Optional array of tags
  age: Number,           // Optional - use if birthDate unknown
  birthDate: Date,       // Optional - use if age unknown
  phone: String,         // Optional
  email: String,         // Optional
  notes: String,         // Optional
  createdAt: Date,
  updatedAt: Date
}
```

### 6. Frontend Updates
- **Household form** now shows optional fields clearly
- **Member form** includes gender selection and tag checkboxes
- **Age OR birthday** input with clear labeling
- **Updated display** shows tags instead of status
- **Better handling** of optional address fields

### 7. API Validation
- **Household creation**: Only lastName required
- **Member creation**: Gender required, tags validated, age/birthDate mutual exclusion
- **Phone validation**: Ensures at least one phone number per household
- **Proper error messages** for all validation failures
