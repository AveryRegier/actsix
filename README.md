# Deacon Care System (actSix)

Deacon Care System (code name: `actSix`) is a small, focused web application that helps deacons manage caring for church members. The code name `actSix` references Acts 6 in the New Testament, where the role of deacons is first demonstrated. 

The site is the primary product — the API exists to serve the site and keep local/remote state. This repository contains the site, the lightweight API that serves it, and the deployment tooling to run the whole stack as a single serverless service.

## What this project is for

- Help deacons track households, members, contact logs, and assignments.
- Provide a simple web UI used by deacons during visits and follow-ups.
- Keep running costs very low by storing data in S3 and running a single Lambda (or small Node server) to serve the UI and API.

The human goal: let deacons focus on care, not infrastructure.

## High-level architecture

- Frontend: static HTML/CSS/JS in the `site/` folder (served by the same app).
- Backend/API: a tiny Hono-based Node app in `src/` that serves API endpoints and static files.
- Data: stored in JSON files in a single AWS S3 bucket via the `sengo` client (`src/sengoClient.js`) — no relational database required.
- Deployment: packaged as a single Lambda function (handler in `src/lambda.js`) or run locally with `src/server.js`.

This keeps the system small, simple, and cheap to operate.

## Quick start (developer)

Prerequisites

- Node.js 18+ and npm
- (Optional) AWS CLI / PowerShell for deployment steps

Install and run locally

```powershell
# from repository root
npm install
# run in single process (no kill-port step)
npm run start
```

Once started, open http://localhost:3000 (or the port shown in the server logs).

```

## Where the data lives

- Runtime data is stored in AWS S3. The repository includes an S3-backed client (`sengo`) used by `src/sengoClient.js`.
- For local development there are example seed files under `init-files/` and `site/` contains static assets used by the UI.
- No separate database server — S3 is used as the primary store to minimize operational cost.

Local samples

- `init-files/` contains sample household/member JSON used by local development and tests.

## Deployment

- CloudFormation templates (e.g. `cloudformation.yaml`, `cognito-stack.yaml`) and `scripts/deploy-cloudformation.ps1` are used to deploy to AWS.
- The Lambda handler is `src/lambda.js`. The application's code is built into `dist/` by `npm run build` and then packaged by `npm run dist`.
- Environment configuration and secrets are set with your usual AWS tools; the repository contains helper scripts under `hidden/` and `scripts/` for local setup.

Typical deploy steps (power-shell based)

```powershell
# clean, build
npm run clean
npm run build
# deploy CloudFormation stack
npm run dist # create zip file for the lambda.  It takes a while.
npm run deploy
```

See `scripts/deploy-cloudformation.ps1` for the environment-variable expectations and deployment details.

## Cost optimization (why this stays cheap)

- Data in S3: storage is inexpensive and scales automatically.
- Single Lambda / small Node server: no always-on VM costs.
- Minimal third-party services: no managed DB or paid SaaS required.
- Small codebase and tiny dependencies reduce cold start and package size.
- Caching and static assets served from the same function reduce requests.

Design goal: run for pocket change/month, with predictable, low ops surface.

## Project layout (important files)

- `site/` — static frontend pages and JS/CSS used by deacons.
- `src/server.js` — local Node server for dev.
- `src/lambda.js` — AWS Lambda handler for production.
- `src/sengoClient.js` — S3-backed storage client.
- `scripts/` — build, dist, and deploy helpers.
- `init-files/` — sample data for local development and tests.
- `cloudformation.yaml`, `cognito-stack.yaml` — infrastructure as code for AWS.

## Configuration & secrets

The application reads configuration from environment variables. Below is a non-exhaustive list of variables you should declare (names only; never commit secret values).

Required / commonly used environment variables

- `PORT` — port the local server listens on (defaults to `3001`)
- `S3_BUCKET` — S3 bucket name used by the `sengo` client (runtime data storage)
- `AWS_REGION` — AWS region used for S3/Cognito (e.g. `us-east-1`)
- `JWT_SECRET` — secret used to sign/verify JWTs
- `API_GATEWAY_URL` — public base URL used in redirect URIs (e.g. https://api.example.com)
- `GMAIL_FROM_ADDRESS` — address used as the sender for outgoing mail
- `GMAIL_APP_PASSWORD` — app password for the Gmail account used to send mail
- `GENERATION_API_KEY` — API key for optional content-generation features

Notes

- Do not store secret values in version control. Use your platform's secret manager (AWS Secrets Manager, Parameter Store, Azure Key Vault, etc.) or a local `.env` file excluded from source control.
- For local development, set these variables in your shell (PowerShell example):

```powershell
$env:PORT = "3001"
$env:S3_BUCKET = "my-dev-bucket"
$env:JWT_SECRET = "changeme"
```

## License

Apache-2.0
