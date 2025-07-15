# Deacon Care System API Usage Examples

This document provides examples of how to use the Deacon Care System API with sengo integration.

## Environment Setup

Make sure you have the following environment variables set:

```bash
export AWS_REGION=us-east-1
export S3_BUCKET=deacon-care-system
# AWS credentials will be handled by Lambda execution role in production
```

## API Examples

### Creating a Household

```bash
curl -X POST http://localhost:3000/api/households \
  -H "Content-Type: application/json" \
  -d '{
    "lastName": "Smith",
    "address": {
      "street": "123 Main St",
      "city": "Springfield",
      "state": "IL",
      "zipCode": "62701"
    },
    "primaryPhone": "(555) 123-4567",
    "notes": "Elderly couple, regular check-ins scheduled"
  }'
```

### Creating a Member

```bash
curl -X POST http://localhost:3000/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "householdId": "household-id-here",
    "phone": "(555) 123-4567",
    "email": "john.smith@example.com",
    "relationship": "head",
    "status": "active"
  }'
```

### Creating a Deacon

```bash
curl -X POST http://localhost:3000/api/deacons \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Pastor",
    "lastName": "Johnson",
    "email": "pastor.johnson@church.org",
    "phone": "(555) 987-6543",
    "isActive": true
  }'
```

### Creating an Assignment

```bash
curl -X POST http://localhost:3000/api/assignments \
  -H "Content-Type: application/json" \
  -d '{
    "deaconId": "deacon-id-here",
    "householdId": "household-id-here",
    "isActive": true,
    "notes": "Primary assignment for this household"
  }'
```

### Logging a Contact

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "member-id-here",
    "deaconId": "deacon-id-here",
    "contactType": "phone",
    "summary": "Called to check on health status",
    "contactDate": "2025-07-14T10:30:00.000Z",
    "followUpRequired": true,
    "notes": "Member is recovering well from surgery"
  }'
```

### Getting All Collections

```bash
# Get all households
curl http://localhost:3000/api/households

# Get all members
curl http://localhost:3000/api/members

# Get all deacons
curl http://localhost:3000/api/deacons

# Get all assignments
curl http://localhost:3000/api/assignments

# Get all contact logs
curl http://localhost:3000/api/contacts
```

### Getting Related Data

```bash
# Get all members of a specific household
curl http://localhost:3000/api/households/household-id-here/members

# Get all contacts for a specific member
curl http://localhost:3000/api/members/member-id-here/contacts

# Get all assignments for a specific deacon
curl http://localhost:3000/api/deacons/deacon-id-here/assignments
```

## Data Storage

All data is stored in AWS S3 using the sengo library, which provides:
- **Document-based storage**: Similar to MongoDB but using S3
- **Searchable documents**: Full-text search capabilities
- **Cost-effective**: S3 storage is much cheaper than traditional databases
- **Scalable**: Handles concurrent access for monthly deacon meetings

## Collections Structure

The API uses the following collections:

- **households**: Family units with shared addresses and contact information
- **members**: Individual church members who belong to households
- **deacons**: Deacons who provide care to assigned households
- **assignments**: Active assignments mapping deacons to households
- **contacts**: Log of all deacon interactions with members

## Field Validation

The API enforces the following validation rules:

### Households
- `lastName` (required): Primary household surname
- `address` (required): Complete address object with street, city, state, zipCode
- `primaryPhone` (required): Main contact number

### Members
- `firstName` (required): Member's first name
- `lastName` (required): Member's last name
- `householdId` (required): Reference to household
- `relationship` (required): One of 'head', 'spouse', 'child', 'other'
- `status` (optional): One of 'active', 'inactive', 'deceased', 'moved' (defaults to 'active')

### Deacons
- `firstName` (required): Deacon's first name
- `lastName` (required): Deacon's last name
- `email` (required): Email address
- `phone` (required): Phone number
- `isActive` (optional): Boolean, defaults to true

### Assignments
- `deaconId` (required): Reference to deacon
- `householdId` (required): Reference to household
- `isActive` (optional): Boolean, defaults to true

### Contacts
- `memberId` (required): Reference to member contacted
- `deaconId` (required): Reference to deacon making contact
- `contactType` (required): One of 'phone', 'visit', 'email', 'text'
- `summary` (required): Brief contact summary
- `contactDate` (required): When contact was made
- `followUpRequired` (optional): Boolean, defaults to false

## Error Handling

All endpoints include proper error handling:
- 400: Bad Request (invalid data)
- 404: Not Found (endpoint doesn't exist)
- 500: Internal Server Error (database/system errors)

## Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. The server will run on `http://localhost:3000`

3. Test endpoints using curl, Postman, or any HTTP client

## Production Deployment

The `lambda.js` file is ready for AWS Lambda deployment with proper sengo integration for S3 storage.
