# Google Calendar OAuth Setup Guide

## Overview
The Multiverse platform now includes Google Calendar OAuth integration to sync snapshot schedules, shoot days, and deadlines directly to users' Google Calendars.

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (or Internal if using Google Workspace)
   - App name: "The Multiverse"
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `https://www.googleapis.com/auth/calendar`
   - Save and continue through the steps

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: "Multiverse Calendar Integration"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/calendar/callback` (for development)
     - `https://yourdomain.com/api/calendar/callback` (for production)
   - Click "Create"
   - **Save the Client ID and Client Secret**

### 3. Configure Environment Variables

Add the following to your `.env.local` file:

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production, update `NEXT_PUBLIC_APP_URL` to your production domain.

### 4. Install Dependencies

The `googleapis` package has been added to `package.json`. Run:

```bash
npm install
```

## How It Works

### OAuth Flow

1. **User clicks "Connect Calendar"** → Redirects to `/api/calendar/auth`
2. **Google OAuth consent screen** → User authorizes calendar access
3. **Callback handler** → `/api/calendar/callback` receives authorization code
4. **Token exchange** → Code exchanged for access token and refresh token
5. **Token storage** → Tokens stored in httpOnly cookies (in production, use secure storage like database)

### Calendar Sync

1. **User clicks "Sync to Calendar"** → Calls `/api/calendar/sync`
2. **Token validation** → Checks for valid access token or refreshes if needed
3. **Event creation** → Creates events in user's primary Google Calendar
4. **Event tracking** → Stores Google event IDs for future updates/deletions

## Features

### Master Schedule
- **One schedule per universe**: All worlds' events appear in a single calendar view
- **Auto-navigation**: When opening a world, calendar automatically jumps to that world's date range
- **Color coding**: Events are color-coded by world color
- **Overlapping events**: Multiple events on the same date are displayed with stacked cards

### Event Types
- **Post**: Snapshot posting dates
- **Shoot**: Filming/shoot days
- **Treatment**: Treatment deadline (1 week before shoot)
- **Shot List**: Shot list deadline (3 days before shoot)
- **Release**: World release dates

## Security Notes

⚠️ **Current Implementation**: Tokens are stored in cookies. For production:
- Use a secure database to store tokens
- Encrypt tokens at rest
- Implement proper token refresh logic
- Add token expiration handling
- Consider using NextAuth.js or similar for OAuth management

## Testing

1. Start the dev server: `npm run dev`
2. Navigate to a world's detail view
3. Click "Connect Calendar" in the Snapshot Schedule tab
4. Complete OAuth flow
5. Click "Sync to Calendar" to sync events
6. Check your Google Calendar to verify events were created

## Troubleshooting

### "Google OAuth not configured"
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env.local`
- Restart the dev server after adding environment variables

### "Redirect URI mismatch"
- Verify redirect URI in Google Cloud Console matches exactly: `http://localhost:3000/api/calendar/callback`
- Check `NEXT_PUBLIC_APP_URL` matches your current URL

### "Token refresh failed"
- User needs to reconnect calendar
- Check that refresh token is being stored correctly


