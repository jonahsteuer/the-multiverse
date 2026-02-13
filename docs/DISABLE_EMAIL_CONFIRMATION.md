# How to Disable Email Confirmation in Supabase

## Problem
You're getting "Email not confirmed" errors when trying to sign in. This is because Supabase requires users to confirm their email address by default.

## Solution: Disable Email Confirmation (For Development)

**⚠️ Important:** Only disable email confirmation for development/testing. Re-enable it before deploying to production.

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard
   - Select your project

2. **Open Authentication**
   - Click on **Authentication** in the left sidebar
   - You should see the Users page

3. **Go to Sign In / Providers**
   - In the left sidebar under **CONFIGURATION**, click on **"Sign In / Providers"**
   - This is where email confirmation settings are located

4. **Disable Email Confirmation**
   - Look for **"Enable email confirmations"** or **"Confirm email"** setting
   - It might be under the **Email** provider section
   - **Turn it OFF** (toggle to disabled/unchecked)
   - Save the changes

5. **Alternative Locations:**
   - If not in "Sign In / Providers", check **"URL Configuration"** under CONFIGURATION
   - Or check **"Email"** under NOTIFICATIONS (for email template settings)

### After Disabling:

- Users can sign up and immediately sign in without email confirmation
- No confirmation emails will be sent
- Perfect for development and testing

### Re-enable for Production:

Before deploying to production, make sure to:
1. Re-enable email confirmation
2. Customize the confirmation email template
3. Test the email flow

## Alternative: Handle Email Confirmation in App

If you want to keep email confirmation enabled, you can:

1. **Show a message after signup** telling users to check their email
2. **Add a "Resend confirmation email" button**
3. **Handle the confirmation link** when users click it

But for development, disabling it is the simplest solution.

