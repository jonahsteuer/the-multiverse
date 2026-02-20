/**
 * Google OAuth utilities for Calendar integration
 */

/**
 * Get OAuth authorization URL
 */
export function getGoogleCalendarAuthUrl(returnUrl?: string): string {
  // Use the current browser origin so this works on any deployment (localhost, Vercel, custom domain)
  // without needing NEXT_PUBLIC_APP_URL to be set
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  const url = new URL(`${baseUrl}/api/calendar/auth`);
  if (returnUrl) {
    url.searchParams.set('return_url', returnUrl);
  }
  return url.toString();
}

/**
 * Check if user has Google Calendar connected
 * TODO: Check actual token status from server
 */
export async function checkCalendarConnection(): Promise<boolean> {
  try {
    const response = await fetch('/api/calendar/status');
    const data = await response.json();
    return data.connected === true;
  } catch {
    return false;
  }
}

/**
 * Initiate Google Calendar OAuth flow
 */
export function connectGoogleCalendar(): void {
  // Use current page URL as return URL
  const returnUrl = window.location.href;
  
  window.location.href = getGoogleCalendarAuthUrl(returnUrl);
}

/**
 * Disconnect Google Calendar
 */
export async function disconnectGoogleCalendar(): Promise<boolean> {
  try {
    const response = await fetch('/api/calendar/disconnect', {
      method: 'POST',
    });
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

