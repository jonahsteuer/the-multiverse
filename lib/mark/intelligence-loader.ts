/**
 * Intelligence Loader
 * Loads Mark's knowledge files and Supabase-stored niche intelligence.
 * Called server-side only (API routes).
 *
 * Knowledge hierarchy:
 *   Tier 1a — Universal Truths (universal-truths.md) — hook psychology, platform science
 *   Tier 1b — Stafford's Playbook (stafford-knowledge.ts) — formats, mindset, artist dev
 *   Tier 1c — Nick Ruffalo's Framework (ruff-music-knowledge.ts) — editing, release strategy
 *   Tier 2  — Live Intelligence (live-intelligence.md) — current trends, scraped weekly
 *   Tier 3  — Artist Niche (artist-niches/[slug].md) — per-artist generated intelligence
 */

import fs from 'fs';
import path from 'path';

export function loadUniversalTruths(): string {
  try {
    const filePath = path.join(process.cwd(), 'lib', 'mark', 'universal-truths.md');
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function loadLiveIntelligence(): string {
  try {
    const filePath = path.join(process.cwd(), 'lib', 'mark', 'live-intelligence.md');
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function loadArtistNiche(artistSlug: string): string {
  try {
    const filePath = path.join(process.cwd(), 'lib', 'mark', 'artist-niches', `${artistSlug}.md`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
  } catch {
    return '';
  }
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
