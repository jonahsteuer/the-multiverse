/**
 * Team API — /api/team
 * GET: Get team for universe
 * POST: Create team for universe
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTeam, getTeamForUniverse, getMyTeams } from '@/lib/team';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const universeId = searchParams.get('universeId');

    if (universeId) {
      const team = await getTeamForUniverse(universeId);
      return NextResponse.json({ success: true, team });
    }

    // Get all teams for current user
    const teams = await getMyTeams();
    return NextResponse.json({ success: true, teams });
  } catch (error) {
    console.error('[API/team] Error:', error);
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { universeId, name } = await request.json();
    if (!universeId || !name) {
      return NextResponse.json({ error: 'universeId and name required' }, { status: 400 });
    }

    const team = await createTeam(universeId, name);
    if (!team) {
      return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }

    return NextResponse.json({ success: true, team });
  } catch (error) {
    console.error('[API/team] Error:', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}

