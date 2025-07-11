# Deacon Care System API

A REST API built with Hono for tracking and managing deacon care activities in a church setting.

## Features

- **Fast & Lightweight**: Built with Hono for optimal performance
- **AWS Lambda Ready**: Designed for serverless deployment
- **ESM Support**: Uses modern JavaScript modules
- **RESTful API**: Clean, intuitive endpoint design

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Testing the API

#### Health Check
```bash
curl http://localhost:3000/
```

#### Hello World
```bash
curl http://localhost:3000/hello
```

## API Endpoints

### Members
- `GET /api/members` - Get all members
- `POST /api/members` - Create a new member

### Households
- `GET /api/households` - Get all households
- `POST /api/households` - Create a new household

### Contacts
- `GET /api/contacts` - Get all contact logs
- `POST /api/contacts` - Create a new contact log

### Deacon Assignments
- `GET /api/deacons/:deaconId/assignments` - Get assignments for a specific deacon

## Deployment

### AWS Lambda

The main Lambda handler is in `lambda.js`. This file is ready for AWS Lambda deployment.

### Local Development

For local development, use `server.js` which provides a Node.js server.

## Project Structure

```
actsix/
├── lambda.js          # AWS Lambda handler
├── server.js          # Local development server
├── package.json       # Dependencies and scripts
└── docs/
    └── PLAN.md        # Project requirements and planning
```

## Technology Stack

- **Hono**: Fast, lightweight web framework
- **AWS Lambda**: Serverless compute
- **AWS S3**: Data storage (via sengo)
- **Node.js**: Runtime environment
- **ESM**: Modern JavaScript modules

## Cost Optimization

This system is designed to operate under $10/month by:
- Using AWS Lambda for pay-per-use computing
- Storing data in S3 instead of expensive databases
- Minimizing bundle size with Hono
- Optimizing for cold starts

## License

Apache-2.0
