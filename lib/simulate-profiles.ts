/**
 * Simulation fixture profiles for testing the calendar and onboarding flows.
 * These represent idealized known states for different artist types.
 * All release dates are computed relative to today so they stay valid.
 */

import type { ArtistProfile, TeamMemberRecord } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────────────

export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── team member fixtures ────────────────────────────────────────────────────

export const RUBY: TeamMemberRecord = {
  id: 'sim-ruby-1',
  teamId: 'sim-team-1',
  userId: 'sim-ruby-user-1',
  role: 'editor',
  permissions: 'member',
  displayName: 'Ruby',
  joinedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

export const CARLOS: TeamMemberRecord = {
  id: 'sim-carlos-1',
  teamId: 'sim-team-2',
  userId: 'sim-carlos-user-1',
  role: 'videographer',
  permissions: 'member',
  displayName: 'Carlos',
  joinedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

// ─── profile factory helpers ─────────────────────────────────────────────────

function base(): Omit<ArtistProfile, 'userId' | 'genre' | 'releases' | 'editedClipCount' | 'rawFootageDescription' | 'hasTeam' | 'teamMembers' | 'timeBudgetHoursPerWeek'> {
  return {
    musicalInspiration: [],
    visualAesthetic: 'cinematic',
    hasBestPosts: false,
    platforms: ['instagram', 'tiktok'],
    primaryPlatform: 'instagram',
    currentPostingFrequency: 'less_than_weekly',
    desiredPostingFrequency: '2-3x_week',
    enjoyedContentFormats: ['behind_the_scenes', 'performance'],
    contentCreationLevel: 'intermediate',
    equipment: 'phone',
    planningComfort: 'some_planning',
    preferredDays: ['thursday', 'friday', 'saturday', 'sunday'],
    releaseStrategy: 'build_to_release',
    releaseStrategyDescription: 'Build audience and promote upcoming release',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── scenario type ───────────────────────────────────────────────────────────

export type ContentTier = 'content-ready' | 'raw-footage' | 'content-light' | 'solo';

export interface SimScenario {
  id: string;
  label: string;
  artistName: string;
  songName: string;
  releaseDaysFromNow: number;
  tier: ContentTier;
  tagline: string;
  artistProfile: ArtistProfile;
  teamMembers: TeamMemberRecord[];
  // What the simulate page checks against
  expectedTodos: string[];
  expectedCalendar: string[];
  watchFor: string[];
}

// ─── scenario definitions ────────────────────────────────────────────────────

export const SCENARIOS: SimScenario[] = [
  // ── A: Kiss Bang — Raw Footage (most common "real" state) ──────────────────
  {
    id: 'kiss-bang-raw',
    label: 'Kiss Bang — Raw Footage',
    artistName: 'Kiss Bang',
    songName: 'Now You Got It',
    releaseDaysFromNow: 18,
    tier: 'raw-footage',
    tagline: '~20 rough clips from MV shoot, editor Ruby, release in 18 days',
    artistProfile: {
      ...base(),
      userId: 'sim-kiss-bang-raw',
      genre: ['glam-rock'],
      musicalInspiration: ['Prince', 'Djo'],
      timeBudgetHoursPerWeek: 8,
      editedClipCount: 0,
      rawFootageDescription: 'about 20 pieces of content that are a little rough but could likely be posted',
      hasTeam: true,
      teamMembers: [{ id: 'sim-ruby-tm', name: 'Ruby', role: 'editor', availability: 'always' }],
      releases: [{ name: 'Now You Got It', releaseDate: daysFromNow(18), type: 'single', isReleased: false, songs: [] }],
    },
    teamMembers: [RUBY],
    expectedTodos: [
      'Invite team members',
      'Review & organize existing footage (est. 45 min)',
      'Send first batch to Ruby for editing (est. 20 min)',
    ],
    expectedCalendar: [
      'Week 1 TODAY: Review footage + Send to Ruby (both tasks start TODAY, not Sunday)',
      'Week 2: Review Ruby\'s edits + Upload & finalize posts',
      'Week 3: 3 × Teaser posts spread across week (Tue / Thu / Sat)',
      'Sun (release day): Now You Got It – RELEASE DAY!',
      'Week 4: Promo posts Mon/Wed/Fri',
    ],
    watchFor: [
      '❌ Tasks piling onto Sunday — should start TODAY',
      '❌ "Film new content" or "Shoot day" in weeks 1-2 (has footage already)',
      '❌ Audience-builder on day BEFORE release — should be Teaser',
      '❌ Only 1 teaser before release — should be 3',
      '❌ Promo posts before release day',
    ],
  },

  // ── B: Kiss Bang — Content Ready ──────────────────────────────────────────
  {
    id: 'kiss-bang-ready',
    label: 'Kiss Bang — Content Ready',
    artistName: 'Kiss Bang',
    songName: 'Now You Got It',
    releaseDaysFromNow: 18,
    tier: 'content-ready',
    tagline: '20 edited clips ready to post, editor Ruby, release in 18 days',
    artistProfile: {
      ...base(),
      userId: 'sim-kiss-bang-ready',
      genre: ['glam-rock'],
      musicalInspiration: ['Prince', 'Djo'],
      timeBudgetHoursPerWeek: 8,
      editedClipCount: 20,
      rawFootageDescription: 'also have some MV behind-the-scenes footage',
      hasTeam: true,
      teamMembers: [{ id: 'sim-ruby-tm', name: 'Ruby', role: 'editor', availability: 'always' }],
      releases: [{ name: 'Now You Got It', releaseDate: daysFromNow(18), type: 'single', isReleased: false, songs: [] }],
    },
    teamMembers: [RUBY],
    expectedTodos: [
      'Invite team members',
      'Upload post edits 1–10 (est. 30 min)',
      'Send edit notes to Ruby (est. 20 min)',
      'Finalize posts (est. 25 min)',
    ],
    expectedCalendar: [
      'Week 1 TODAY: Upload 1-10, Finalize posts 1-10, Upload 11-20, Finalize 11-20',
      'Week 2: Edit MV footage + Brainstorm',
      'Week 3: 3 × Teaser posts + Release Day',
      'Week 4: Promo posts',
    ],
    watchFor: [
      '❌ Upload tasks on Sunday instead of TODAY',
      '❌ Only uploading one batch (should be two: 1-10 and 11-20)',
      '❌ Missing "Edit MV footage" task in week 2',
      '❌ Audience-builder the day before release (should be Teaser)',
    ],
  },

  // ── C: Leon Tax — Content Light ───────────────────────────────────────────
  {
    id: 'leon-tax',
    label: 'Leon Tax — Content Light',
    artistName: 'Leon Tax',
    songName: 'Untitled Single',
    releaseDaysFromNow: 45,
    tier: 'content-light',
    tagline: 'No footage, no edits, videographer Carlos, release in 6 weeks',
    artistProfile: {
      ...base(),
      userId: 'sim-leon-tax',
      genre: ['alt-rnb'],
      musicalInspiration: ['Frank Ocean', 'Steve Lacy'],
      visualAesthetic: 'minimal',
      timeBudgetHoursPerWeek: 6,
      editedClipCount: 0,
      rawFootageDescription: '',
      hasTeam: true,
      teamMembers: [{ id: 'sim-carlos-tm', name: 'Carlos', role: 'videographer', availability: 'sometimes' }],
      releases: [{ name: 'Untitled Single', releaseDate: daysFromNow(45), type: 'single', isReleased: false, songs: [] }],
    },
    teamMembers: [CARLOS],
    expectedTodos: [
      'Invite team members',
      'Brainstorm content ideas (est. 45 min)',
      'Plan shoot day with Carlos (est. 30 min)',
    ],
    expectedCalendar: [
      'Week 1 TODAY: Brainstorm + Plan shoot day with Carlos',
      'Week 2: Shoot day',
      'Week 3-4: Edit batches + Audience builder posts (3/week)',
      'Week 5-6: Teasers shift to 3×/week as release approaches',
      'Release week: Release Day + Promo posts',
    ],
    watchFor: [
      '❌ "Review & organize footage" task (nothing to review yet)',
      '❌ Teasers appearing before week 5 (release is 6 weeks out)',
      '❌ Plan shoot without Carlos name',
      '❌ Lower posting frequency not respected (6 hrs/week)',
    ],
  },

  // ── D: Solo Artist — No Content, No Team ──────────────────────────────────
  {
    id: 'solo-no-content',
    label: 'Alex Solo — No Team, No Content',
    artistName: 'Alex Solo',
    songName: 'First Single',
    releaseDaysFromNow: 30,
    tier: 'solo',
    tagline: 'Debut artist, no team, no footage, phone only, release in 4 weeks',
    artistProfile: {
      ...base(),
      userId: 'sim-alex-solo',
      genre: ['indie-pop'],
      musicalInspiration: ['Phoebe Bridgers'],
      visualAesthetic: 'minimal',
      timeBudgetHoursPerWeek: 4,
      editedClipCount: 0,
      rawFootageDescription: '',
      hasTeam: false,
      teamMembers: [],
      releases: [{ name: 'First Single', releaseDate: daysFromNow(30), type: 'single', isReleased: false, songs: [] }],
      desiredPostingFrequency: 'weekly',
    },
    teamMembers: [],
    expectedTodos: [
      'Invite team members',
      'Brainstorm content ideas (est. 45 min)',
      'Plan shoot day (est. 30 min)',
    ],
    expectedCalendar: [
      'Week 1-2: Brainstorm + Plan shoot + Shoot day (solo, no team names)',
      'Week 3: Edit posts (solo), Audience builders',
      'Week 4: Teasers + Release Day',
    ],
    watchFor: [
      '❌ "Send to editor" tasks (solo artist)',
      '❌ Team member name in "Plan shoot day" (should say just "Plan shoot day")',
      '❌ More than 1 post/day (limited budget: 4 hrs/week)',
      '❌ Missing release day event',
    ],
  },
];
