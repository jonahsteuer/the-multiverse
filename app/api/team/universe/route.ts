import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS entirely (server only, never exposed to client)
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/team/universe
 *
 * Returns the team's galaxy + worlds for the authenticated user.
 * Sharing is at the GALAXY level: the team record stores a galaxy_id.
 *
 * Strategy:
 *  1. If team has galaxy_id → load that galaxy directly (no universe lookup needed)
 *  2. If team only has universe_id → find latest galaxy in that universe (legacy fallback)
 *  3. If universe is deleted → auto-heal by finding creator's current universe
 *
 * Uses the service role key so invited members can read the admin's data
 * without being blocked by RLS on galaxies/worlds.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify the caller's auth token from the Authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate the token and get the user
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Find the team this user belongs to
    const { data: memberRows } = await adminSupabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .limit(1);

    if (!memberRows || memberRows.length === 0) {
      console.log(`[team/universe] user ${user.id} has no team membership`);
      return NextResponse.json({ universe: null, reason: 'no_team' });
    }

    const teamId = memberRows[0].team_id;

    // Get the team record — try with galaxy_id first, fall back if column doesn't exist yet
    let teamRow: any = null;
    const { data: teamRowFull, error: teamRowErr } = await adminSupabase
      .from('teams')
      .select('universe_id, galaxy_id, name, created_by')
      .eq('id', teamId)
      .single();

    if (teamRowErr && (teamRowErr.message?.includes("galaxy_id") || teamRowErr.code === 'PGRST204')) {
      // galaxy_id column doesn't exist yet (SQL migration not run) — fall back to basic select
      console.warn(`[team/universe] galaxy_id column missing — falling back to basic select`);
      const { data: teamRowBasic } = await adminSupabase
        .from('teams')
        .select('universe_id, name, created_by')
        .eq('id', teamId)
        .single();
      teamRow = teamRowBasic;
    } else {
      teamRow = teamRowFull;
    }

    console.log(`[team/universe] team ${teamId} → galaxy_id=${teamRow?.galaxy_id}, universe_id=${teamRow?.universe_id}`);

    // ── STRATEGY 1: Load by galaxy_id (preferred — galaxy-level sharing) ──
    if (teamRow?.galaxy_id) {
      const galaxy = await loadGalaxyById(teamRow.galaxy_id);
      if (galaxy) {
        console.log(`[team/universe] ✅ Loaded via galaxy_id: ${galaxy.name}`);
        // Return a synthetic universe wrapping the single galaxy
        return NextResponse.json({
          universe: {
            id: teamRow.universe_id || 'galaxy-scoped',
            name: galaxy.name,
            galaxies: [galaxy],
          },
          teamId,
          galaxyId: teamRow.galaxy_id,
        });
      }
      console.warn(`[team/universe] galaxy_id ${teamRow.galaxy_id} not found — falling back`);
    }

    // ── STRATEGY 2: Load by universe_id (legacy fallback) ─────────────────
    if (!teamRow?.universe_id) {
      return NextResponse.json({ universe: null, reason: 'no_universe_id' });
    }

    let universeId = teamRow.universe_id;

    // Load universe — if deleted, find creator's current universe and auto-heal
    let { data: universeData } = await adminSupabase
      .from('universes')
      .select('id, name, creator_id, created_at')
      .eq('id', universeId)
      .single();

    if (!universeData) {
      console.warn(`[team/universe] universe ${universeId} not found — attempting auto-heal`);
      if (teamRow?.created_by) {
        const { data: fallbackUniverse } = await adminSupabase
          .from('universes')
          .select('id, name, creator_id, created_at')
          .eq('creator_id', teamRow.created_by)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fallbackUniverse) {
          console.log(`[team/universe] Auto-healing team ${teamId} → universe ${fallbackUniverse.id}`);
          await adminSupabase
            .from('teams')
            .update({ universe_id: fallbackUniverse.id })
            .eq('id', teamId);
          universeData = fallbackUniverse;
          universeId = fallbackUniverse.id;
        }
      }
    }

    if (!universeData) {
      return NextResponse.json({ universe: null, reason: 'universe_not_found' });
    }

    // Load all galaxies + worlds in the universe
    // Use a minimal select first; if optional columns fail, fall back to safe columns
    let galaxiesData: any[] | null = null;
    const { data: gFull, error: gErr } = await adminSupabase
      .from('galaxies')
      .select(`
        id, name, universe_id, release_date, visual_landscape, created_at,
        track_url, brainstorm_location_area,
        worlds(id, name, galaxy_id, release_date, color, visual_landscape, snapshot_strategy, is_public, is_released, song_emotion, song_stage, listening_context, created_at)
      `)
      .eq('universe_id', universeId)
      .order('created_at', { ascending: true });

    if (gErr) {
      console.warn(`[team/universe] Full galaxy select failed (${gErr.code}): ${gErr.message} — trying minimal select`);
      const { data: gMin, error: gMinErr } = await adminSupabase
        .from('galaxies')
        .select(`
          id, name, universe_id, release_date, visual_landscape, created_at,
          worlds(id, name, galaxy_id, release_date, color, is_public, is_released, created_at)
        `)
        .eq('universe_id', universeId)
        .order('created_at', { ascending: true });
      if (gMinErr) {
        console.error(`[team/universe] Minimal galaxy select also failed: ${gMinErr.message}`);
      }
      galaxiesData = gMin;
    } else {
      galaxiesData = gFull;
    }

    console.log(`[team/universe] Loaded ${galaxiesData?.length ?? 0} galaxies for universe ${universeId}`);
    const galaxies = mapGalaxies(galaxiesData || []);

    // If we found galaxies and galaxy_id column exists, update the team to use galaxy_id going forward
    if (galaxies.length > 0 && !teamRow?.galaxy_id && teamRowFull !== undefined && !teamRowErr) {
      const latestGalaxy = galaxies[galaxies.length - 1];
      console.log(`[team/universe] Upgrading team ${teamId} to galaxy_id=${latestGalaxy.id}`);
      await adminSupabase
        .from('teams')
        .update({ galaxy_id: latestGalaxy.id })
        .eq('id', teamId)
        .then(() => {}, (e: Error) => console.warn('[team/universe] galaxy_id update failed:', e.message));
    }

    return NextResponse.json({
      universe: {
        id: universeData.id,
        name: universeData.name,
        creatorId: universeData.creator_id,
        createdAt: universeData.created_at,
        galaxies,
      },
      teamId,
    });
  } catch (err: any) {
    console.error('[team/universe] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function loadGalaxyById(galaxyId: string) {
  const { data, error } = await adminSupabase
    .from('galaxies')
    .select(`
      id, name, universe_id, release_date, visual_landscape, created_at,
      track_url, brainstorm_location_area,
      worlds(id, name, galaxy_id, release_date, color, visual_landscape, snapshot_strategy, is_public, is_released, song_emotion, song_stage, listening_context, created_at)
    `)
    .eq('id', galaxyId)
    .single();

  if (error) {
    console.warn(`[team/universe] loadGalaxyById full select failed (${error.code}): ${error.message} — trying minimal`);
    const { data: min } = await adminSupabase
      .from('galaxies')
      .select(`
        id, name, universe_id, release_date, visual_landscape, created_at,
        worlds(id, name, galaxy_id, release_date, color, is_public, is_released, created_at)
      `)
      .eq('id', galaxyId)
      .single();
    return min ? mapGalaxy(min) : null;
  }

  if (!data) return null;
  return mapGalaxy(data);
}

function mapGalaxies(rows: any[]) {
  return rows.map(mapGalaxy);
}

function mapGalaxy(gd: any) {
  return {
    id: gd.id,
    name: gd.name,
    universeId: gd.universe_id,
    releaseDate: gd.release_date || undefined,
    visualLandscape: gd.visual_landscape,
    createdAt: gd.created_at,
    worlds: (gd.worlds || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      galaxyId: w.galaxy_id,
      releaseDate: w.release_date,
      color: w.color,
      visualLandscape: w.visual_landscape,
      snapshotStrategy: w.snapshot_strategy,
      isPublic: w.is_public,
      isReleased: w.is_released,
      songEmotion: w.song_emotion || undefined,
      songStage: w.song_stage || undefined,
      listeningContext: w.listening_context || undefined,
      createdAt: w.created_at,
    })),
  };
}
