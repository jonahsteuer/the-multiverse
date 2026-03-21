/**
 * Intelligence Loader
 * Loads Mark's knowledge files and Supabase-stored niche intelligence.
 * Called server-side only (API routes).
 */

import fs from 'fs';
import path from 'path';

export function loadUniversalTruths(): string {
  try {
    const filePath = path.join(process.cwd(), 'lib', 'mark', 'universal-truths.md');
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return ''; // Graceful fallback if file missing
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
