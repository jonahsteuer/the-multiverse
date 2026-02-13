/**
 * Test Data for Development
 * 
 * Pre-populated user data for testing specific flows without going through onboarding
 */

import type { ArtistProfile } from '@/types';

/**
 * Cam Okoro - Test User Profile
 * Completed onboarding on Feb 9, 2026
 */
export const CAM_OKORO_PROFILE: ArtistProfile = {
  // Required fields
  userId: 'cam-okoro-test',
  createdAt: '2026-02-09T00:00:00.000Z',
  updatedAt: '2026-02-09T00:00:00.000Z',
  
  // Basic Info
  genre: ['rock-rap', 'experimental'],
  musicalInspiration: ['Paris Texas', '454', 'bash for the world'],
  visualAesthetic: 'dark and industrial',
  visualStyleDescription: 'raw, gritty vibe with experimental edge',
  
  // Releases
  releases: [
    {
      type: 'ep',
      name: 'Cameleon',
      releaseDate: '2024-09-22',
      isReleased: true,
      songs: ['DND', 'Runaway', 'intergalaktik', 'villain', 'Carhartt']
    },
    {
      type: 'album',
      name: 'Mercurial',
      releaseDate: null, // TBD - not set yet
      isReleased: false,
      songs: []
    }
  ],
  
  // Best Posts
  hasBestPosts: true,
  bestPostDescription: "music video snippet for 'upside down' got 14k views and 200+ comments - worked because good song with cool visuals",
  
  // Platforms & Posting
  platforms: ['instagram', 'tiktok', 'youtube'],
  primaryPlatform: 'instagram',
  currentPostingFrequency: 'less_than_weekly',
  desiredPostingFrequency: '2-3x_week',
  
  // Content Creation
  contentCreationApproach: 'existing_footage',
  enjoyedContentFormats: ['music_video_snippet', 'behind_scenes'],
  contentCreationLevel: 'advanced',
  planningComfort: 'some_planning',
  hasExistingAssets: true,
  existingAssetsDescription: 'studio footage, music videos, performance clips',
  equipment: 'full_setup', // works with videographers who have cameras, gear, lighting
  
  // Time & Schedule
  timeBudgetHoursPerWeek: 6,
  preferredDays: ['saturday', 'sunday'],
  
  // Team
  hasTeam: true,
  teamDescription: 'Hari and Julio help with filming and editing',
  
  // Release Strategy
  releaseStrategy: 'audience_growth', // Base strategy
  releaseStrategyDescription: 'I still want to promote cameleon a bit, but would mostly just like to grow my audience without worrying about a specific release right now. Not focused on building up to mercurial just yet.',
  // This will be parsed as: ~25% Cameleon promo, ~75% audience-builder
};

/**
 * Check if a creator name matches a test user
 */
export function isTestUser(creatorName: string): boolean {
  const normalized = creatorName.trim().toLowerCase();
  return normalized === 'cam okoro' || normalized === 'camokoro';
}

/**
 * Get test profile data for a creator name
 */
export function getTestUserProfile(creatorName: string): ArtistProfile | null {
  const normalized = creatorName.trim().toLowerCase();
  
  if (normalized === 'cam okoro' || normalized === 'camokoro') {
    return CAM_OKORO_PROFILE;
  }
  
  return null;
}

