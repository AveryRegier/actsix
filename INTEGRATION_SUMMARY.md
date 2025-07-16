# Server Integration Summary

## Problem Solved
**CORS Issues**: Eliminated Cross-Origin Resource Sharing issues by serving both the API and frontend from the same server.

## Changes Made

### 1. Modified `src/api.js`
- Added static file serving capability
- Added MIME type support for HTML, CSS, JS, and images
- Added security check to prevent directory traversal
- Added routes for:
  - `GET /` → serves `index.html`
  - `GET /deacons.html` → serves `deacons.html`
  - `GET /:filename` → serves static files (with extension filtering)
- Moved API endpoints to `/api` prefix:
  - `GET /api` → health check
  - `GET /api/hello` → hello endpoint
  - All other API endpoints remain at `/api/*`

### 2. Updated Frontend Files
- Changed `API_BASE_URL` from `'http://localhost:3001'` to `''` (relative URLs)
- Updated health check to use `/api` instead of `/`
- No more CORS issues since everything is same-origin

### 3. Simplified Package.json
- Removed `npm run site` script (no longer needed)
- Single command now serves everything: `npm run start`

### 4. Updated Documentation
- Updated `site/README.md` with simplified setup instructions
- Single server setup instead of two separate servers

### 5. Removed Unnecessary Files
- Deleted `scripts/serve-site.js` (no longer needed)

### 6. Updated Tests
- Modified tests to use new API endpoints (`/api` instead of `/`)
- Added test to verify HTML is served at root path
- All tests now pass

## Benefits

1. **No CORS Issues**: Frontend and API served from same origin
2. **Simplified Deployment**: Single server handles everything
3. **Easier Development**: Only one server to start (`npm run start`)
4. **Lambda Ready**: Same architecture works for AWS Lambda
5. **Cleaner Architecture**: No separate static file server needed

## Usage

### Development
```bash
npm run start
```
Opens: http://localhost:3001

### Production
Same codebase can be deployed as:
- Single Lambda function (API + static files)
- Single Node.js server
- Container with both API and frontend

## Technical Details

- **Static File Security**: Only serves files with allowed extensions
- **Path Security**: Prevents directory traversal attacks
- **MIME Types**: Proper content-type headers for all file types
- **Error Handling**: Graceful 404 and 500 error responses
- **Performance**: Direct file serving without external dependencies

## Architecture

```
Single Server (port 3001)
├── / → index.html (site homepage)
├── /deacons.html → deacons.html (deacons page)
├── /api → health check (JSON)
├── /api/deacons → deacons API (JSON)
├── /api/households → households API (JSON)
└── /api/* → all other API endpoints (JSON)
```

This integration eliminates the complexity of managing two separate servers and the CORS configuration that would be needed between them.
