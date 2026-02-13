/**
 * Notifications API — /api/team/notifications
 * GET: Get notifications for current user
 * PATCH: Mark notification(s) as read
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/team';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get('countOnly');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (countOnly === 'true') {
      const count = await getUnreadNotificationCount();
      return NextResponse.json({ success: true, count });
    }

    const notifications = await getMyNotifications(limit);
    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error('[API/notifications] Error:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, notificationId } = body;

    if (action === 'mark_all_read') {
      const success = await markAllNotificationsRead();
      return NextResponse.json({ success });
    }

    if (notificationId) {
      const success = await markNotificationRead(notificationId);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: 'notificationId or action required' }, { status: 400 });
  } catch (error) {
    console.error('[API/notifications] Error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

