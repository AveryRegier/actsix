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
  - Available tags: `member`, `attender`, `shut-in`, `cancer`, `long-term-needs`, `widow`, `widower`, `married`
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

## Testing Completed
- ✅ All unit tests pass
- ✅ API endpoints work correctly
- ✅ Validation works as expected
- ✅ Frontend displays new data structure properly
- ✅ Both age and birthDate handling works
- ✅ Tags system functions correctly

## Key Benefits
1. **More flexible data entry** - only essential fields required
2. **Better matching real-world scenarios** - addresses may be unknown
3. **Improved member categorization** with tags vs rigid status
4. **Clearer age handling** - age OR birthdate as appropriate
5. **Ensured contact capability** - at least one phone number required
6. **Maintained data integrity** - all validation and relationships intact

The system now better matches the real-world workflow for church deacon care management while maintaining robust data validation and user experience.
