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

### Creating a Member

```bash
curl -X POST http://localhost:3000/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phone": "(555) 123-4567",
    "email": "john.smith@example.com",
    "address": {
      "street": "123 Main St",
      "city": "Springfield",
      "state": "IL",
      "zipCode": "62701"
    },
    "needs": ["prayer", "companionship"],
    "status": "active"
  }'
```

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
    "members": [
      {
        "firstName": "John",
        "lastName": "Smith",
        "relationship": "head"
      },
      {
        "firstName": "Jane",
        "lastName": "Smith",
        "relationship": "spouse"
      }
    ],
    "primaryPhone": "(555) 123-4567",
    "notes": "Elderly couple, needs regular check-ins"
  }'
```

### Logging a Contact

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "member-id-here",
    "deaconId": "deacon123",
    "contactType": "phone",
    "summary": "Called to check on health status",
    "needs": ["prayer for healing", "grocery shopping"],
    "followUpRequired": true,
    "followUpDate": "2025-07-18T00:00:00.000Z",
    "notes": "Member is recovering well from surgery but needs help with groceries"
  }'
```

### Getting All Members

```bash
curl http://localhost:3000/api/members
```

### Getting All Households

```bash
curl http://localhost:3000/api/households
```

### Getting All Contact Logs

```bash
curl http://localhost:3000/api/contacts
```

### Getting Deacon Assignments

```bash
curl http://localhost:3000/api/deacons/deacon123/assignments
```

## Data Storage

All data is stored in AWS S3 using the sengo library, which provides:
- **Document-based storage**: Similar to MongoDB but using S3
- **Searchable documents**: Full-text search capabilities
- **Cost-effective**: S3 storage is much cheaper than traditional databases
- **Scalable**: Handles concurrent access for monthly deacon meetings

## Collections Structure

The API uses the following collections:

- **members**: Individual church members who need care
- **households**: Family units with shared addresses and contacts
- **contacts**: Log of all deacon interactions with members
- **assignments**: Mapping of deacons to their assigned members

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
