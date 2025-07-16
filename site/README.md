# Deacon Care System - Frontend

This is the frontend web application for the Deacon Care System.

## Getting Started

### Running the Application

The frontend and API are now served from the same server to avoid CORS issues:

```bash
# Start the combined server (API + Frontend)
npm run start
```

Then open your browser to: **http://localhost:3001**

### Development Mode

For development with automatic restarts:

```bash
# Start in development mode
npm run dev
```

## Current Features

### ✅ Available Now
- **Landing Page** (`/`): Main dashboard with navigation
- **Deacons Management** (`/deacons.html`): 
  - View all deacons
  - Add new deacons
  - See deacon status (active/inactive)
  - Form validation
  - Real-time API status checking

### 🚧 Coming Soon
- **Households & Members Management**: Add/edit household and member information
- **Contact Logs**: Log and view deacon contacts with members
- **Current Status Report**: Printable report of all assignments and recent activity

## File Structure

```
site/
├── index.html          # Landing page with navigation
├── deacons.html        # Deacons management page
└── README.md          # This file
```

## API Integration

The frontend communicates with the backend API on the same server:

- `GET /api` - Health check
- `GET /api/deacons` - Fetch all deacons
- `POST /api/deacons` - Create new deacon
- `GET /` - Serves the main site
- `GET /deacons.html` - Serves the deacons page

## Design Features

- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, professional interface with gradient backgrounds
- **Real-time Status**: Shows API connection status
- **Form Validation**: Client-side and server-side validation
- **Error Handling**: Graceful error messages for network issues
- **Loading States**: Visual feedback during API calls
- **No CORS Issues**: Frontend and API served from same origin

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Development Notes

- No build process required - uses vanilla HTML, CSS, and JavaScript
- No CORS issues since frontend and API are served from same server
- Real-time updates every 30 seconds for API status
- Form data is validated both client-side and server-side
- Static files are served directly by the API server

## Deployment

The same server handles both API and frontend:
- **Local Development**: `npm run start` serves everything on port 3001
- **Production**: Deploy as single Lambda function with static file serving
- **No separate frontend build** required

## Future Enhancements

- Add household management interface
- Implement member management
- Create contact logging system
- Add printable reports
- Implement user authentication
- Add data export functionality
