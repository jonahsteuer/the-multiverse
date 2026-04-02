/**
 * Shared types and helpers for Phase 2 reference finding.
 * Imported by both the API route and the UI page.
 */

export type AccountTier = 'tiny' | 'small' | 'growing' | 'established' | 'large' | 'mega';

export interface MarkReference {
  source: 'training-log' | 'hashtag-discovery';
  url: string | null;
  suggestedHandle?: string | null;    // owner username extracted from scrape
  hashtag?: string;                   // which hashtag surfaced this post
  title: string;
  referenceAccountTier: AccountTier;
  actualAccountTier?: AccountTier;
  tierMatch: boolean;
  tierConfidence: 'high' | 'medium' | 'low';
  matchedDimensions: string[];
  scaleDependency: 'universal' | 'scale-amplified' | 'scale-dependent';
  // Phase 3 fields — empty in Phase 2, populated later
  explanation?: string;
  learnFrom?: string;
  caveat?: string;
  // Discovery metadata
  engagementRate?: number;            // percentage, e.g. 8.5
  viewCount?: number;
  captionSnippet?: string;
}

export function estimateAccountTier(views: number): AccountTier {
  if (views < 500) return 'tiny';
  if (views < 5_000) return 'small';
  if (views < 50_000) return 'growing';
  if (views < 500_000) return 'established';
  if (views < 5_000_000) return 'large';
  return 'mega';
}

export function nextTier(tier: AccountTier): AccountTier {
  const tiers: AccountTier[] = ['tiny', 'small', 'growing', 'established', 'large', 'mega'];
  return tiers[Math.min(tiers.indexOf(tier) + 1, tiers.length - 1)];
}

export function engagementFloor(tier: AccountTier): number {
  const floors: Record<AccountTier, number> = {
    tiny:        0.10,
    small:       0.05,
    growing:     0.03,
    established: 0.015,
    large:       0.005,
    mega:        0.001,
  };
  return floors[tier];
}
