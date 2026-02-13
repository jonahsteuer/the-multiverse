/**
 * Invite API — /api/team/invite
 * POST: Create invitation
 * GET: Get invitation by token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createInvitation, getInvitationByToken, acceptInvitation, getTeamInvitations } from '@/lib/team';
import type { TeamRole } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const teamId = searchParams.get('teamId');

    if (token) {
      const invitation = await getInvitationByToken(token);
      if (!invitation) {
        return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, invitation });
    }

    if (teamId) {
      const invitations = await getTeamInvitations(teamId);
      return NextResponse.json({ success: true, invitations });
    }

    return NextResponse.json({ error: 'token or teamId required' }, { status: 400 });
  } catch (error) {
    console.error('[API/invite] Error:', error);
    return NextResponse.json({ error: 'Failed to load invitation' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'accept') {
      // Accept an invitation
      const { token, userId, displayName } = body;
      if (!token || !userId || !displayName) {
        return NextResponse.json({ error: 'token, userId, and displayName required' }, { status: 400 });
      }

      const result = await acceptInvitation(token, userId, displayName);
      if (!result.success) {
        return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 400 });
      }

      return NextResponse.json({ success: true, teamId: result.teamId });
    }

    // Create a new invitation
    const { teamId, role, invitedName, invitedEmail } = body;
    if (!teamId || !role) {
      return NextResponse.json({ error: 'teamId and role required' }, { status: 400 });
    }

    const invitation = await createInvitation(teamId, role as TeamRole, invitedName, invitedEmail);
    if (!invitation) {
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, invitation });
  } catch (error) {
    console.error('[API/invite] Error:', error);
    return NextResponse.json({ error: 'Failed to process invitation' }, { status: 500 });
  }
}

