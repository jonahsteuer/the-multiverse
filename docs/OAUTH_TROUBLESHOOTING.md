# OAuth Troubleshooting Guide

## "Access Denied" Error

If you're getting an "access denied" error after signing in, it's usually related to the OAuth consent screen configuration. Here's how to fix it:

### Step 1: Check OAuth Consent Screen Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Make sure the following is configured:

#### For Testing (Development):
- **User Type**: External (or Internal if using Google Workspace)
- **App name**: "The Multiverse" (or any name)
- **User support email**: Your email
- **Developer contact**: Your email
- **Scopes**: Make sure `https://www.googleapis.com/auth/calendar` is added
  - Click "ADD OR REMOVE SCOPES"
  - Search for "Calendar API"
  - Select `.../auth/calendar` (full access)
  - Click "UPDATE" then "SAVE AND CONTINUE"

#### Test Users (IMPORTANT for Testing Mode):
- If your app is in "Testing" mode, you MUST add test users:
  - Scroll to "Test users" section
  - Click "+ ADD USERS"
  - Add your Google account email address
  - Click "ADD"
  - Click "SAVE AND CONTINUE"

### Step 2: Verify Scope is Added

1. In OAuth consent screen, go to "Scopes" step
2. You should see: `https://www.googleapis.com/auth/calendar`
3. If not, add it:
   - Click "ADD OR REMOVE SCOPES"
   - Search for "Calendar"
   - Select "https://www.googleapis.com/auth/calendar"
   - Click "UPDATE"
   - Click "SAVE AND CONTINUE"

### Step 3: Check App Publishing Status

- **For Testing**: App can be in "Testing" mode, but test users must be added
- **For Production**: App needs to be published (requires verification if using sensitive scopes)

### Step 4: Verify Redirect URI

1. Go to **APIs & Services** → **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", verify:
   - `http://localhost:3000/api/calendar/callback` is listed
   - No trailing slashes
   - Exact match (case-sensitive)

### Step 5: Clear Browser Cache

Sometimes cached OAuth data causes issues:
1. Clear browser cache and cookies for `accounts.google.com`
2. Or use an incognito/private window

### Step 6: Check Console Logs

Check your terminal/console for detailed error messages. The improved error handling should show:
- The exact redirect URI being used
- Token exchange status
- Specific error messages from Google

## Common Issues

### Issue: "Access blocked: This app's request is invalid"
**Solution**: Check that the redirect URI matches exactly in Google Cloud Console

### Issue: "Access denied: You can't sign in because this app sent an invalid request"
**Solution**: 
- Verify the OAuth consent screen is configured
- Check that your email is added as a test user (if in testing mode)
- Verify the scope is added in the consent screen

### Issue: "Error 400: redirect_uri_mismatch"
**Solution**: 
- Ensure `http://localhost:3000/api/calendar/callback` is exactly registered
- No trailing slashes
- Check for typos

### Issue: Token exchange fails
**Solution**:
- Verify `GOOGLE_CLIENT_SECRET` in `.env.local` is correct
- Check that the client secret hasn't been reset
- Restart your dev server after changing `.env.local`

## Quick Checklist

- [ ] OAuth consent screen configured
- [ ] Scope `https://www.googleapis.com/auth/calendar` added
- [ ] Your email added as test user (if in testing mode)
- [ ] Redirect URI `http://localhost:3000/api/calendar/callback` registered
- [ ] Client ID and Secret in `.env.local`
- [ ] Dev server restarted after adding credentials


