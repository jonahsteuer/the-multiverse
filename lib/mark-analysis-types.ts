// ─── Phase 1 analysis schema ─────────────────────────────────────────────────

export interface MarkPostAnalysis {
  postSuccess: { verdict: boolean; reason: string };
  hookType:
    | 'action-cold-open'
    | 'talking-head'
    | 'text-only'
    | 'fan-comment-overlay'
    | 'performance-mid-action'
    | 'reveal'
    | 'question'
    | 'b-roll-montage'
    | 'unknown';
  hookDuration: number;
  hookEffectiveness: string;
  videoFormat:
    | 'vertical-performance'
    | 'music-video-excerpt'
    | 'talking-head'
    | 'studio-session'
    | 'live-clip'
    | 'montage'
    | 'BTS'
    | 'lyric-video'
    | 'text-overlay'
    | 'animation'
    | 'unknown';
  videoDescription: string;
  cutRhythm: string;
  musicSync: { synced: boolean; note: string };
  soundStrategy: 'original-audio' | 'trending-audio' | 'original-music-release';
  captionStrategy: string | null;
  captionVerdict: string;
  visualVerdict: string;
  midVideoPatternInterrupt: boolean;
  commentSentiment: string;
  isFanAccount: boolean;
  genre?: string;
}

// ─── Phase 2 analysis schema (richer, Stafford-structured) ───────────────────

export interface Phase2Analysis {
  // Identity
  postUrl?: string;
  artistName?: string;
  genre?: string;
  accountTier?: string;
  postDate?: string;
  // Raw metrics (Mark echoes these back)
  duration?: number;
  views?: number;
  likes?: number;
  comments?: number;
  engagementRate?: string;
  // Structural
  hookType?: string;
  videoFormat?: string;
  soundStrategy?: string;
  captionText?: string;
  hashtagStrategy?: string;
  // Rich verdicts
  hookAnalysis?: string;
  visualAnalysis?: string;
  editingAnalysis?: string;
  captionVerdict?: string;
  visualVerdict?: string;
  // Outcome
  postSuccess?: { verdict: string; reason: string };
  tierContext?: string;
  // Stafford framework applied
  staffordPrinciples?: Array<{ principle: string; application: string }>;
  // Action items (either format Mark returns)
  topActionItems?: string[];
  suggestions?: string[];
}
