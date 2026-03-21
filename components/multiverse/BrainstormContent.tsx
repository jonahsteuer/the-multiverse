'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { speakAsMarkVoice, stopMarkSpeech } from '@/lib/mark-tts';
import type {
  ArtistProfile,
  ExistingAssets,
  ContentFormat,
  ContentFormatOption,
  ContentFormatAssignment,
  BrainstormEditDay,
  BrainstormShootDay,
  BrainstormResult,
} from '@/types';
import type { ContentIdea } from '@/app/api/tiktok-insights/route';
import { VoiceInput } from './VoiceInput';
import { SoundbytePicker } from './SoundbytePicker';
import type { SoundbyteDef } from './SoundbytePicker';

// Supabase Storage default max per-file upload size (50 MB).
// Files larger than this will be rejected by the bucket before the upload completes.
const UPLOAD_MAX_MB = 50;
const UPLOAD_SIZE_MSG = `File too large. Please export your song as MP3 first — most songs are 3–8 MB as MP3 vs 80–200 MB as WAV/AIFF.`;

interface BrainstormIntakeData {
  songStory: string;
  artistVibe: string;
  comfortLevel: string;
}

// ============================================================================
// TYPES
// ============================================================================

interface ScheduledPost {
  id: string;
  index: number; // 0-based
  title: string;
  type: 'teaser' | 'promo' | 'audience-builder';
  date: string; // ISO date
  startTime: string;
  endTime: string;
}

interface BrainstormContentProps {
  galaxyId: string;
  galaxyName: string;
  scheduledPosts: ScheduledPost[]; // The 6 (or however many) posts from the calendar
  artistProfile?: Partial<ArtistProfile>;
  preferredDays?: string[];
  releaseDate?: string;
  prefilledIntake?: BrainstormIntakeData; // from Mark's chat — skip intake if provided
  mode?: 'mark_generates' | 'user_idea';  // default: mark_generates
  // Stafford: pre-saved song context from world creation (C, D+)
  songEmotion?: string;      // skip emotion question if already saved
  listeningContext?: string; // seed location suggestions
  // A: persisted location area from previous brainstorm run
  savedLocationArea?: string;
  // World ID for persisting song-specific data (emotion, listening context) directly to the worlds table
  worldId?: string;
  // F: user's home city for pre-filling location
  homeCity?: string;
  // F13: real team member names for crew selection
  teamMembers?: Array<{ id: string; name: string; role?: string }>;
  // F5: whether the world already has a song uploaded (or lyrics saved)
  worldHasSong?: boolean;
  // Pre-saved lyrics text from a completed brainstorm — skips lyrics collection
  savedLyrics?: string;
  // Pre-confirmed soundbytes from a previous session — pre-fills the picker
  savedSoundbytes?: Soundbyte[];
  // When true, skip the initial steps and auto-restore from the saved draft
  autoResume?: boolean;
  onComplete: (result: BrainstormResult) => void;
  onClose: () => void;
}

interface LocationOption {
  name: string;
  address: string;
  type: string;
  whyItFits: string;
  mapsUrl: string;
}

interface Soundbyte {
  id: string;
  section: string;    // e.g. "Chorus only", "Verse 1 → Chorus"
  timeRange: string;  // e.g. "0:28–0:52" (estimated)
  duration: string;   // e.g. "~24s"
  rationale: string;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

type BrainstormStep =
  // L1: Song upload first (if not already uploaded)
  | 'ask_song_upload_first' // L1: Upload track before anything else
  | 'transcribing_lyrics'   // L2: Whisper is running in background
  | 'confirm_lyrics'        // L3: Show/edit transcribed lyrics
  // AI-powered ideas phase (mark_generates mode)
  | 'ask_listening_context' // F2: D+ check — "Where do you imagine someone listening?"
  | 'ask_emotion'           // G/A: ask 1-2 word emotion filter (only when not pre-saved)
  | 'ask_song_story'
  | 'ask_vibe'
  // Location phase (F) — before ideas so scenes are location-specific
  | 'ask_travel_time'     // F3: "How far willing to drive? (minutes/hours)"
  | 'ask_shoot_date_early' // F8: "When do you want to shoot?" — asked before locations so weather can inform
  | 'ask_location_area'   // "What's near you? City/neighborhood?"
  | 'loading_locations'   // Fetching Google Places
  | 'show_locations'      // Pick from 3 real options
  | 'loading_ideas'
  | 'show_ideas'
  | 'ideas_feedback'
  // User-pitched idea mode
  | 'ask_user_idea'
  | 'evaluating_idea'
  | 'show_evaluation'
  // Soundbyte selection (F5) — after 3 scenes are confirmed
  | 'ask_song_upload'     // F5: Prompt to upload track for playback; can skip (legacy — replaced by L1)
  | 'ask_soundbytes'      // F5: Show 5 soundbyte option cards, like/dislike until 5 confirmed
  // Variations phase (kept for user_idea mode / legacy)
  | 'ask_variations'
  | 'show_variations'
  // Phase 2: Shoot day planning inline (E+I)
  | 'shoot_day_date_v2'   // Date picker with recommended date
  | 'shoot_day_time'      // Morning / afternoon / evening
  | 'shoot_day_crew'      // Solo or have help (with real team member names)
  | 'generating_output'   // Building all events
  // Legacy / post assignment
  | 'shoot_day_prompt'
  | 'shoot_day_date'
  | 'intro'
  | 'format_selection'
  | 'post_assignment'
  | 'remaining_posts'
  | 'custom_format_input'
  | 'footage_check'
  | 'summary'
  | 'complete';

// ─── Variation card data ───────────────────────────────────────────────────────
interface PostVariationCard {
  id: string;
  originalIdeaIdx: number;
  variationIndex: number; // 0 = original concept
  title: string;
  hook: string;
  rationale: string;
  isOriginal: boolean;
}

const ENERGY_VARIANTS = [
  {
    label: 'Intimate Cut',
    rationale: 'Close-up, quiet, personal energy. Same location, softer presence — easy to film right after the original.',
  },
  {
    label: 'High Energy Cut',
    rationale: 'More movement, louder presence. Same setup, turned up — different emotional register, same shoot day.',
  },
  {
    label: 'Reflective Cut',
    rationale: 'Wider shot, slower pace, longer pause before the first line. Same concept, different emotional angle.',
  },
];

function generateVariationCards(ideas: ContentIdea[], countPerIdea: number): PostVariationCard[] {
  const cards: PostVariationCard[] = [];
  ideas.forEach((idea, ideaIdx) => {
    // Slot 0 = the original idea itself
    const ideaHook = (idea as any).action || idea.title;
    const ideaRationale = (idea as any).emotionalAngle || 'The original concept from your brainstorm.';
    cards.push({
      id: `${idea.id}-v0`,
      originalIdeaIdx: ideaIdx,
      variationIndex: 0,
      title: idea.title,
      hook: ideaHook,
      rationale: ideaRationale,
      isOriginal: true,
    });
    for (let v = 1; v < countPerIdea; v++) {
      const variant = ENERGY_VARIANTS[(v - 1) % ENERGY_VARIANTS.length];
      cards.push({
        id: `${idea.id}-v${v}`,
        originalIdeaIdx: ideaIdx,
        variationIndex: v,
        title: `${idea.title} — ${variant.label}`,
        hook: ideaHook,
        rationale: variant.rationale,
        isOriginal: false,
      });
    }
  });
  return cards;
}

// ============================================================================
// CONTENT FORMAT DEFINITIONS
// ============================================================================

function getContentFormats(
  artistProfile?: Partial<ArtistProfile>,
  galaxyName?: string
): ContentFormatOption[] {
  const assets = artistProfile?.existingAssets;
  const hasMusicVideo = !!(assets?.musicVideos && assets.musicVideos.length > 0);
  const hasBTS = !!(assets?.behindTheScenes && assets.behindTheScenes.length > 0);
  const hasFootage = !!(assets?.footage && assets.footage.length > 0);

  // Check the description-based assets too (from Cam Okoro style data)
  const assetsDesc = ((artistProfile as any)?.existingAssetsDescription || '').toLowerCase();
  const hasMusicVideoFromDesc = assetsDesc.includes('music video');
  const hasBTSFromDesc = assetsDesc.includes('behind') || assetsDesc.includes('bts');
  const hasFootageFromDesc = assetsDesc.includes('footage') || assetsDesc.includes('clips') || assetsDesc.includes('studio');

  const effectiveHasMusicVideo = hasMusicVideo || hasMusicVideoFromDesc;
  const effectiveHasBTS = hasBTS || hasBTSFromDesc;
  const effectiveHasFootage = hasFootage || hasFootageFromDesc;

  return [
    {
      id: 'music_video_snippet',
      label: 'Music Video Snippet',
      emoji: '🎬',
      description: effectiveHasMusicVideo
        ? `Cut short clips from your existing music video for ${galaxyName || 'this release'}`
        : `Short clips cut from a music video`,
      requiresFootage: true,
      recommended: effectiveHasMusicVideo,
    },
    {
      id: 'bts_performance',
      label: 'BTS Performance Shot',
      emoji: '🎤',
      description: effectiveHasBTS || effectiveHasFootage
        ? 'Behind-the-scenes clips from studio sessions or performances'
        : 'Raw behind-the-scenes clips from studio or performances',
      requiresFootage: true,
      recommended: effectiveHasBTS || effectiveHasFootage,
    },
    {
      id: 'visualizer',
      label: 'Visualizer',
      emoji: '🌀',
      description: 'An animated or stylized visual set to your music',
      requiresFootage: false, // Always needs a shoot/creation day
    },
  ];
}

// Check if footage exists for a given format
function hasFootageForFormat(
  format: ContentFormat,
  artistProfile?: Partial<ArtistProfile>
): boolean {
  const assets = artistProfile?.existingAssets;
  const assetsDesc = ((artistProfile as any)?.existingAssetsDescription || '').toLowerCase();

  switch (format) {
    case 'music_video_snippet': {
      const hasMV = !!(assets?.musicVideos && assets.musicVideos.length > 0);
      const hasMVDesc = assetsDesc.includes('music video');
      return hasMV || hasMVDesc;
    }
    case 'bts_performance': {
      const hasBTS = !!(assets?.behindTheScenes && assets.behindTheScenes.length > 0);
      const hasBTSDesc = assetsDesc.includes('behind') || assetsDesc.includes('bts');
      const hasFootage = !!(assets?.footage && assets.footage.length > 0);
      const hasFootageDesc = assetsDesc.includes('footage') || assetsDesc.includes('studio');
      return hasBTS || hasBTSDesc || hasFootage || hasFootageDesc;
    }
    case 'visualizer':
      return false; // Visualizers always need creation
    case 'custom':
      return false; // Unknown — will ask
    default:
      return false;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   'bg-green-500/20 text-green-300 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  hard:   'bg-red-500/20 text-red-300 border-red-500/30',
};

export function BrainstormContent({
  galaxyId,
  galaxyName,
  scheduledPosts,
  artistProfile,
  preferredDays = ['saturday', 'sunday'],
  releaseDate = '',
  prefilledIntake,
  mode = 'mark_generates',
  songEmotion: songEmotionProp,
  listeningContext: listeningContextProp,
  savedLocationArea,
  worldId,
  homeCity,
  teamMembers = [],
  worldHasSong = false,
  savedLyrics,
  savedSoundbytes,
  autoResume = false,
  onComplete,
  onClose,
}: BrainstormContentProps) {
  // Computes the correct starting step based on available data (no autoResume check)
  const computeNormalStartStep = (): BrainstormStep => {
    if (mode === 'user_idea') return 'ask_user_idea';
    if (prefilledIntake) return 'loading_ideas';
    if (!worldHasSong) return 'ask_song_upload_first';
    if (!listeningContextProp) return 'ask_listening_context';
    if (songEmotionProp && (savedLocationArea || homeCity)) return 'ask_shoot_date_early';
    if (songEmotionProp) return 'ask_travel_time';
    return 'ask_emotion';
  };
  const getInitialStep = (): BrainstormStep => {
    // When resuming, hold at loading_ideas until the draft is fetched
    if (autoResume) return 'loading_ideas';
    return computeNormalStartStep();
  };
  const [step, setStep] = useState<BrainstormStep>(getInitialStep);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Ideas phase state — pre-filled from Mark's chat if available
  const [songStory, setSongStory]       = useState(prefilledIntake?.songStory || '');
  const [artistVibe, setArtistVibe]     = useState(prefilledIntake?.artistVibe || '');
  const [comfortLevel, setComfortLevel] = useState(prefilledIntake?.comfortLevel || '');
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);
  const [likedIdeas, setLikedIdeas]     = useState<Set<string>>(new Set());
  const [dislikedIdeas, setDislikedIdeas] = useState<Set<string>>(new Set());
  const [ideaNotes, setIdeaNotes]       = useState<Record<string, string>>({});
  const [noteOpenForId, setNoteOpenForId] = useState<string | null>(null);
  const [noteMicActiveId, setNoteMicActiveId] = useState<string | null>(null);
  const [locationMicActive, setLocationMicActive] = useState(false);
  const [tiktokCount, setTiktokCount]   = useState(0);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [sceneReferences, setSceneReferences] = useState<Record<string, string[]>>({});
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);

  // L1-L4: Lyrics state (pre-populate from saved data if available)
  const [lyricsText, setLyricsText] = useState(savedLyrics || '');
  const [lyricsSegments, setLyricsSegments] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [lyricsEditValue, setLyricsEditValue] = useState(savedLyrics || '');
  const [lyricsTranscribing, setLyricsTranscribing] = useState(false);
  const [uploadedTrackUrl, setUploadedTrackUrl] = useState('');
  const [suggestedEmotion, setSuggestedEmotion] = useState('');
  const [suggestedEmotionRationale, setSuggestedEmotionRationale] = useState('');
  const [suggestedListeningContext, setSuggestedListeningContext] = useState('');

  // User-idea mode state
  const [userOwnIdea, setUserOwnIdea]   = useState('');
  const [ideaEvalMarkFeedback, setIdeaEvalMarkFeedback] = useState('');

  // F8: Weather context (fetched after shoot date + location area are known)
  const [weatherSummary, setWeatherSummary] = useState('');
  const [weatherFilmNote, setWeatherFilmNote] = useState('');
  const [weatherIsBad, setWeatherIsBad] = useState(false);

  // F2: Pitch-your-own scene (inline on show_ideas step)
  const [pitchInput, setPitchInput] = useState('');
  const [pitchMicActive, setPitchMicActive] = useState(false);
  const [pitchSubmitting, setPitchSubmitting] = useState(false);
  const [userPitchedScene, setUserPitchedScene] = useState(''); // stored for guiding future batches

  // Stafford: emotion filter + location (F, G, A)
  const [songEmotionLocal, setSongEmotionLocal] = useState(songEmotionProp || '');
  const [listeningContextLocal, setListeningContextLocal] = useState(listeningContextProp || '');
  const [travelTime, setTravelTime] = useState('');
  // F: Pre-fill from savedLocationArea (per-galaxy) or homeCity (user profile fallback)
  const [locationAreaInput, setLocationAreaInput] = useState(savedLocationArea || homeCity || '');
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [confirmedLocation, setConfirmedLocation] = useState('');
  const [confirmedLocationUrl, setConfirmedLocationUrl] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(false);

  // F5: Soundbyte selection
  const [soundbyteOptions, setSoundbyteOptions] = useState<Soundbyte[]>([]);
  const [likedSoundbytes, setLikedSoundbytes] = useState<Set<string>>(new Set());
  const [rejectedSoundbytes, setRejectedSoundbytes] = useState<Set<string>>(new Set());
  const [confirmedSoundbytes, setConfirmedSoundbytes] = useState<Soundbyte[]>(savedSoundbytes || []);

  // Phase 2: shoot day planning (E, I)
  const [shootDate, setShootDate] = useState('');
  const [shootTimeOfDay, setShootTimeOfDay] = useState('');
  const [shootCrew, setShootCrew] = useState('');
  const [recommendedShootDate, setRecommendedShootDate] = useState('');

  // Selection state
  const [selectedFormat, setSelectedFormat] = useState<ContentFormat | null>(null);
  const [customFormatName, setCustomFormatName] = useState('');
  const [selectedPostIndices, setSelectedPostIndices] = useState<number[]>([]);
  const [secondFormat, setSecondFormat] = useState<ContentFormat | null>(null);
  const [secondCustomFormatName, setSecondCustomFormatName] = useState('');
  const [needsFootageCheck, setNeedsFootageCheck] = useState(false);
  const [hasFootageForBTS, setHasFootageForBTS] = useState<boolean | null>(null);
  const [hasFootageForCustom, setHasFootageForCustom] = useState<boolean | null>(null);

  // Format assignments built up during the flow
  const [assignments, setAssignments] = useState<ContentFormatAssignment[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // F6: Save brainstorm draft to Supabase (debounced)
  const saveDraftToSupabase = (draft: Record<string, unknown>) => {
    if (!galaxyId) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('galaxies').update({ brainstorm_draft: draft }).eq('id', galaxyId);
      } catch { /* silent — draft save is best-effort */ }
    }, 1500);
  };

  // Fetch Instagram/TikTok reference links for each scene via Tavily
  // Runs once when contentIdeas populate, skips if already loaded from draft
  useEffect(() => {
    if (contentIdeas.length === 0) return;
    if (Object.keys(sceneReferences).length > 0) return; // already loaded from draft
    setIsLoadingReferences(true);
    const fetchAll = async () => {
      const results: Record<string, string[]> = {};
      await Promise.all(contentIdeas.map(async (idea) => {
        try {
          const res = await fetch('/api/references', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sceneTitle: idea.title,
              action: (idea as any).action,
              location: confirmedLocation,
              genre: songEmotionLocal,
            }),
          });
          if (res.ok) {
            const { urls } = await res.json();
            if (urls?.length) results[idea.id] = urls;
          }
        } catch { /* non-blocking */ }
      }));
      setSceneReferences(results);
      setIsLoadingReferences(false);
      // Persist to brainstorm_draft so references survive session resume
      if (galaxyId && Object.keys(results).length > 0) {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: gal } = await supabase.from('galaxies').select('brainstorm_draft').eq('id', galaxyId).single();
          const existing = (gal?.brainstorm_draft as any) || {};
          await supabase.from('galaxies').update({
            brainstorm_draft: { ...existing, contentIdeaReferences: results },
          }).eq('id', galaxyId);
        } catch { /* non-blocking */ }
      }
    };
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentIdeas.length]);

  // F6: Clear draft on complete or start fresh.
  // At completion, preserve song-specific data (lyrics, track_url, soundbytes)
  // since SongDataTab reads them from brainstorm_draft.
  const clearDraft = async (soundbytesToPreserve?: Soundbyte[]) => {
    if (!galaxyId) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      const hasSongData = soundbytesToPreserve?.length || lyricsText || uploadedTrackUrl;
      if (hasSongData) {
        const preserved: Record<string, unknown> = {};
        if (soundbytesToPreserve?.length) preserved.confirmedSoundbytes = soundbytesToPreserve;
        if (lyricsText) preserved.lyrics = lyricsText;
        if (lyricsSegments.length) preserved.lyrics_segments = lyricsSegments;
        if (uploadedTrackUrl) preserved.track_url = uploadedTrackUrl;
        await supabase.from('galaxies').update({ brainstorm_draft: preserved }).eq('id', galaxyId);
      } else {
        await supabase.from('galaxies').update({ brainstorm_draft: null }).eq('id', galaxyId);
      }
    } catch { /* silent */ }
  };

  const formats = useMemo(
    () => getContentFormats(artistProfile, galaxyName),
    [artistProfile, galaxyName]
  );

  // F6: resume state (loaded from Supabase draft on mount)
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<Record<string, unknown> | null>(null);
  // A3: set to true when autoResume=true but no draft found — triggers normal init message
  const [autoResumeFallback, setAutoResumeFallback] = useState(false);

  // Helper: restore all draft fields into component state
  const applyDraft = (draft: Record<string, unknown>) => {
    if (draft.songEmotionLocal) setSongEmotionLocal(draft.songEmotionLocal as string);
    if (draft.listeningContextLocal) setListeningContextLocal(draft.listeningContextLocal as string); // A1
    if (draft.travelTime) setTravelTime(draft.travelTime as string);
    if (draft.shootDate) setShootDate(draft.shootDate as string);
    if (draft.locationAreaInput) setLocationAreaInput(draft.locationAreaInput as string);
    if (draft.confirmedLocation) setConfirmedLocation(draft.confirmedLocation as string);
    if (draft.confirmedLocationUrl) setConfirmedLocationUrl(draft.confirmedLocationUrl as string);
    if (draft.weatherSummary) setWeatherSummary(draft.weatherSummary as string);
    if (draft.weatherFilmNote) setWeatherFilmNote(draft.weatherFilmNote as string);
    if (draft.weatherIsBad) setWeatherIsBad(draft.weatherIsBad as boolean);
    if (Array.isArray(draft.allLikedIdeas)) setAllLikedIdeas(draft.allLikedIdeas as ContentIdea[]);
    if (draft.userPitchedScene) setUserPitchedScene(draft.userPitchedScene as string);
    if (draft.feedbackRound) setFeedbackRound(draft.feedbackRound as number);
    // Restore in-memory API results so show_ideas / show_locations don't render blank
    if (Array.isArray(draft.contentIdeas) && (draft.contentIdeas as ContentIdea[]).length > 0) {
      setContentIdeas(draft.contentIdeas as ContentIdea[]);
    }
    if (Array.isArray(draft.locationOptions) && (draft.locationOptions as LocationOption[]).length > 0) {
      setLocationOptions(draft.locationOptions as LocationOption[]);
    }
    if (draft.contentIdeaReferences && typeof draft.contentIdeaReferences === 'object') {
      setSceneReferences(draft.contentIdeaReferences as Record<string, string[]>);
    }
  };

  // F6: Load draft from Supabase on mount
  useEffect(() => {
    if (!galaxyId) return;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');

        // Try to load both columns; fall back to just brainstorm_draft if liked_scenes column missing
        type GalaxyDraftData = { brainstorm_draft: unknown; brainstorm_liked_scenes?: unknown } | null;
        let draftData: GalaxyDraftData = null;
        const full = await supabase.from('galaxies').select('brainstorm_draft, brainstorm_liked_scenes').eq('id', galaxyId).single();
        if (!full.error) {
          draftData = full.data as GalaxyDraftData;
        } else {
          // Column may not exist yet — retry with just brainstorm_draft
          const slim = await supabase.from('galaxies').select('brainstorm_draft').eq('id', galaxyId).single();
          if (!slim.error) draftData = slim.data as GalaxyDraftData;
        }

        // E: Seed allLikedIdeas from the permanent liked-scenes bank on mount
        if (draftData && Array.isArray((draftData as any)?.brainstorm_liked_scenes) && (draftData as any).brainstorm_liked_scenes.length > 0) {
          setAllLikedIdeas((prev) => {
            const existing = new Set(prev.map((i: ContentIdea) => i.id));
            const banked = ((draftData as any).brainstorm_liked_scenes as ContentIdea[]).filter((i: ContentIdea) => !existing.has(i.id));
            return prev.length === 0 ? banked : [...prev, ...banked];
          });
        }

        if (draftData?.brainstorm_draft && (draftData.brainstorm_draft as any).step) {
          const draft = draftData.brainstorm_draft as Record<string, unknown>;
          if (autoResume) {
            // A4: Auto-apply draft immediately — "Welcome back" message is the only message added
            applyDraft(draft);
            setStep(draft.step as BrainstormStep);
            addBotMessage(`Welcome back! Picking up where you left off${draft.confirmedLocation ? ` at ${draft.confirmedLocation}` : ''}.`, 300);
          } else {
            setResumeDraft(draft);
          }
        } else if (autoResume) {
          // A3: autoResume=true but no draft found — fall back to normal startup
          const fallback = computeNormalStartStep();
          setStep(fallback);
          // Trigger the normal initialization message for this fallback step
          // (we defer to a flag so the existing init useEffect fires on next tick)
          setAutoResumeFallback(true);
        }
      } catch { /* silent */ } finally {
        setDraftLoaded(true);
      }
    })();
  }, [galaxyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Post-resume safety net: detect and recover from steps that need in-memory data
  // that may not have been persisted (e.g. locationOptions, contentIdeas).
  // Runs once after the draft has been loaded and applied.
  useEffect(() => {
    if (!draftLoaded) return;

    // show_locations with no options → re-run location fetch using saved area
    if (step === 'show_locations' && locationOptions.length === 0) {
      if (locationAreaInput) {
        addBotMessage(`Welcome back! Let me reload location options for "${locationAreaInput}"…`, 300);
        fetchLocations(locationAreaInput);
      } else {
        setStep('ask_location_area');
        addBotMessage(`Welcome back! Let's pick up the location search — where are you based?`, 300);
      }
      return;
    }

    // loading_locations stuck (draft was somehow saved at this transient step)
    if (step === 'loading_locations') {
      if (locationAreaInput) {
        fetchLocations(locationAreaInput);
      } else {
        setStep('ask_location_area');
      }
      return;
    }

    // show_ideas with no ideas → re-fetch, or advance if enough are already liked
    if (step === 'show_ideas' && contentIdeas.length === 0) {
      if (allLikedIdeas.length >= 3) {
        // Enough liked already — skip straight to soundbytes
        addBotMessage(`Welcome back! You already locked ${allLikedIdeas.length} scenes — let's move to soundbytes.`, 400);
        enterSoundbytes();
      } else {
        addBotMessage(`Welcome back! Let me regenerate your content ideas…`, 400);
        setStep('loading_ideas');
        fetchIdeas(songStory, artistVibe, comfortLevel);
      }
      return;
    }

    // loading_ideas stuck (shouldn't persist but guard anyway)
    if (step === 'loading_ideas' && !loadingIdeas) {
      if (allLikedIdeas.length >= 3) {
        addBotMessage(`Welcome back! You already locked ${allLikedIdeas.length} scenes — let's move to soundbytes.`, 400);
        enterSoundbytes();
      } else {
        fetchIdeas(songStory, artistVibe, comfortLevel);
      }
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  // Add a chatbot message with typing delay, then speak it
  const addBotMessage = (content: string, delay = 600) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content,
          timestamp: new Date(),
        },
      ]);
      setIsTyping(false);
      // Speak the message as Mark's voice
      speakAsMarkVoice(content, () => setIsSpeaking(true), () => setIsSpeaking(false));
    }, delay);
  };

  // Stop speech on unmount
  useEffect(() => {
    return () => { stopMarkSpeech(); };
  }, []);

  const addUserMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content,
        timestamp: new Date(),
      },
    ]);
  };

  // ── Initialize ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // A4: When auto-resuming, suppress all setup messages — the "Welcome back" message
    // is added after the draft loads; nothing should appear here.
    if (autoResume) return;
    if (mode === 'user_idea') {
      addBotMessage(
        `Let's hear it. What's the idea? Give me the concept, how you'd film it, and what you want people to feel when they watch it.`,
        300
      );
    } else if (prefilledIntake) {
      addBotMessage(
        `Great — I have your context from Mark. Pulling real TikTok data for your genre and generating ideas now...`,
        300
      );
      fetchIdeas(prefilledIntake.songStory, prefilledIntake.artistVibe, prefilledIntake.comfortLevel);
    } else if (!worldHasSong) {
      // L1: Song not uploaded — ask first so Whisper can extract lyrics
      addBotMessage(
        `Let's build your content plan for **${galaxyName}**.\n\nFirst — upload your track (MP3). I'll pull the lyrics from it so I can suggest scenes that match exactly what you're saying, not just the vibe.`,
        300
      );
    } else if (!listeningContextProp) {
      // F2: D+ missing — ask it first before anything else
      addBotMessage(
        `Let's build your content plan for **${galaxyName}**.\n\nQuick one first — where do you imagine someone listening to this song? (e.g. late-night drive, gym, bedroom, party, nature walk)`,
        300
      );
    } else if (songEmotionProp && (savedLocationArea || homeCity)) {
      // A: all context saved — skip straight to shoot date
      const locationLabel = savedLocationArea || homeCity;
      const lyricsNote = savedLyrics ? ' Lyrics locked in too.' : '';
      addBotMessage(
        `Let's build your next batch for **${galaxyName}**.\n\nGot the vibe (**${songEmotionProp}**) and your area (**${locationLabel}**) saved from last time.${lyricsNote} When are you thinking of shooting? I'll check the weather and find the best spots.`,
        300
      );
    } else if (songEmotionProp) {
      // G: emotion already saved — skip to travel time
      const lyricsNote = savedLyrics ? ' Lyrics locked in.' : '';
      addBotMessage(
        `Let's build your content plan for **${galaxyName}**.\n\nI've got the vibe: **${songEmotionProp}**.${lyricsNote} Before I pull locations — how far are you willing to drive to shoot? (e.g. 10 minutes, 30 minutes, 1 hour)`,
        300
      );
    } else {
      // A: ask emotion first (first snapshot starter for this song)
      addBotMessage(
        `Let's build your content plan for **${galaxyName}**.\n\nFirst — in 1-2 words, what does this song feel like? (e.g. heartbreak, confidence, nostalgia, rage)`,
        300
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A3: When autoResume=true but no draft was found, run normal init messages
  useEffect(() => {
    if (!autoResumeFallback) return;
    // Mirrors the init useEffect but fires after the fallback step is set
    if (mode === 'user_idea') {
      addBotMessage(`Let's hear it. What's the idea? Give me the concept, how you'd film it, and what you want people to feel when they watch it.`, 300);
    } else if (prefilledIntake) {
      addBotMessage(`Great — I have your context from Mark. Pulling real TikTok data for your genre and generating ideas now...`, 300);
      fetchIdeas(prefilledIntake.songStory, prefilledIntake.artistVibe, '');
    } else if (!worldHasSong) {
      addBotMessage(`Let's build your content plan for **${galaxyName}**.\n\nFirst — upload your track (MP3). I'll pull the lyrics from it so I can suggest scenes that match exactly what you're saying, not just the vibe.`, 300);
    } else if (!listeningContextProp) {
      addBotMessage(`Let's build your content plan for **${galaxyName}**.\n\nQuick one first — where do you imagine someone listening to this song? (e.g. late-night drive, gym, bedroom, party, nature walk)`, 300);
    } else if (songEmotionProp && (savedLocationArea || homeCity)) {
      const locationLabel = savedLocationArea || homeCity;
      const lyricsNote2 = savedLyrics ? ' Lyrics locked in too.' : '';
      addBotMessage(`Let's build your next batch for **${galaxyName}**.\n\nGot the vibe (**${songEmotionProp}**) and your area (**${locationLabel}**) saved from last time.${lyricsNote2} When are you thinking of shooting? I'll check the weather and find the best spots.`, 300);
    } else if (songEmotionProp) {
      const lyricsNote2 = savedLyrics ? ' Lyrics locked in.' : '';
      addBotMessage(`Let's build your content plan for **${galaxyName}**.\n\nI've got the vibe: **${songEmotionProp}**.${lyricsNote2} Before I pull locations — how far are you willing to drive to shoot?`, 300);
    } else {
      addBotMessage(`Let's build your content plan for **${galaxyName}**.\n\nFirst — in 1-2 words, what does this song feel like? (e.g. heartbreak, confidence, nostalgia, rage)`, 300);
    }
  }, [autoResumeFallback]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared fetch function ─────────────────────────────────────────────────────
  // emotion + location params used to generate scene-based ideas (H, F)
  const fetchIdeas = async (story: string, vibe: string, comfort: string) => {
    setLoadingIdeas(true);
    try {
      const genres: string[] = (artistProfile as any)?.genre || ['indie'];
      const emotion = songEmotionLocal || songEmotionProp || story;
      const location = confirmedLocation || '';
      const res = await fetch('/api/tiktok-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres,
          songName: galaxyName,
          songStory: story,
          artistVibe: vibe || (artistProfile as any)?.visualAesthetic || '',
          comfortLevel: comfort,
          releaseDate,
          // Stafford: pass emotion + location so Claude returns scene-based ideas
          songEmotion: emotion,
          shootLocation: location,
          listeningContext: listeningContextLocal || listeningContextProp || '',
          weatherContext: weatherSummary || undefined, // F8: real weather for shoot day
          lyricsContext: lyricsText || undefined,     // L5/L6: ground scenes in real lyrics
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setContentIdeas(data.ideas || []);
      const count = data.tiktokPostsAnalyzed || 0;
      setTiktokCount(count);
      setStep('show_ideas');
      const locationNote = location ? ` at ${location}` : '';
      const dataNote = count > 0 ? ` based on ${count} real TikTok posts` : '';
      addBotMessage(
        `Here are 5 scene ideas${locationNote}${dataNote}. Rate every card — 👍 to lock it in, 👎 to reject it and leave a note. Your feedback shapes the next batch. You need 3 to move forward.`,
        800
      );
    } catch {
      setContentIdeas([]);
      setStep('show_ideas');
      addBotMessage(`Here are 5 scene ideas for **${galaxyName}**. Rate every card — 👍 to lock it in, 👎 to reject it and leave a note. You need 3 to move forward.`, 800);
    } finally {
      setLoadingIdeas(false);
    }
  };

  // ── User-idea mode: evaluate the pitch ───────────────────────────────────────

  const fetchUserIdeaEvaluation = async (idea: string) => {
    setLoadingIdeas(true);
    setStep('evaluating_idea');
    try {
      const genres: string[] = (artistProfile as any)?.genre || ['indie'];
      const res = await fetch('/api/tiktok-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres,
          songName: galaxyName,
          artistVibe: (artistProfile as any)?.vibe || (artistProfile as any)?.visualAesthetic || '',
          comfortLevel: '',
          releaseDate,
          userIdea: idea,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const evaluatedIdea: ContentIdea = data.ideas?.[0];
      const feedback: string = data.markFeedback || "I like the direction — let's refine it and get it scheduled.";
      if (evaluatedIdea) {
        setContentIdeas([evaluatedIdea]);
        setIdeaEvalMarkFeedback(feedback);
        setTiktokCount(data.tiktokPostsAnalyzed || 0);
        // Auto-like the idea (it's the user's own concept, already curated)
        setLikedIdeas(new Set([evaluatedIdea.id]));
        setStep('show_evaluation');
        addBotMessage(feedback, 400);
      } else {
        throw new Error('No idea returned');
      }
    } catch {
      setStep('ask_variations');
      addBotMessage(`Alright, let's work with what you've got. Do you want variations — multiple versions you can shoot on the same day? If so, how many?`, 500);
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handleUserIdeaSubmit = (text: string) => {
    if (!text.trim()) return;
    setUserOwnIdea(text.trim());
    addUserMessage(text.trim());
    fetchUserIdeaEvaluation(text.trim());
  };

  // ── L2/L3/L4: Song upload → transcription → lyrics confirm → emotion suggest ──

  const transcribeAndContinue = async (trackUrl: string) => {
    setStep('transcribing_lyrics');
    setLyricsTranscribing(true);
    addBotMessage(`Track uploaded! 🎵 Pulling lyrics now — this takes about 10 seconds...`, 400);
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: trackUrl }),
      });
      const data = await res.json();
      console.log('[Transcribe] API response:', data);
      if (data.success && data.transcript) {
        setLyricsText(data.transcript);
        setLyricsEditValue(data.transcript);
        if (data.segments) setLyricsSegments(data.segments);
        setStep('confirm_lyrics');
        addBotMessage(
          `Got the lyrics. Take a quick look — fix anything that's off, then hit confirm.\n\nOnce confirmed I'll use these to suggest scenes where you're lip syncing to specific lines.`,
          500
        );
      } else if (data.tooLarge) {
        setLyricsEditValue('');
        setStep('confirm_lyrics');
        addBotMessage(
          `That file was a bit too large for the transcription tool even after compression. Paste your lyrics below — I'll use them the same way.`,
          500
        );
      } else if (data.missingKey) {
        setLyricsEditValue('');
        setStep('confirm_lyrics');
        addBotMessage(
          `Lyrics transcription isn't set up yet (missing API key). Paste your lyrics below — I'll use them exactly the same way.`,
          500
        );
      } else {
        console.warn('[Transcribe] Failed:', data.error);
        setLyricsEditValue('');
        setStep('confirm_lyrics');
        addBotMessage(
          `I couldn't pull the lyrics automatically — sometimes happens with dense production. Paste them in below and I'll work from those.`,
          500
        );
      }
    } catch {
      setLyricsEditValue('');
      setStep('confirm_lyrics');
      addBotMessage(`Lyrics extraction hit a snag. Paste them below and we'll keep going.`, 400);
    } finally {
      setLyricsTranscribing(false);
    }
  };

  const handleLyricsConfirmed = async (confirmedLyrics: string) => {
    setLyricsText(confirmedLyrics);
    addUserMessage('Lyrics confirmed ✓');

    // Persist lyrics into brainstorm_draft (dedicated columns don't exist in schema)
    if (galaxyId && confirmedLyrics.trim()) {
      (async () => {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: gal } = await supabase.from('galaxies').select('brainstorm_draft').eq('id', galaxyId).single();
          const existing = (gal?.brainstorm_draft as Record<string, unknown>) || {};
          await supabase.from('galaxies').update({
            brainstorm_draft: {
              ...existing,
              lyrics: confirmedLyrics,
              ...(lyricsSegments.length ? { lyrics_segments: lyricsSegments } : {}),
            },
          }).eq('id', galaxyId);
        } catch { /* best-effort */ }
      })();
    }

    // L4: Run emotion + listening context suggestion in background
    (async () => {
      try {
        const res = await fetch('/api/suggest-emotion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lyrics: confirmedLyrics, songName: galaxyName }),
        });
        const data = await res.json();
        if (data.emotion) {
          setSuggestedEmotion(data.emotion);
          setSuggestedEmotionRationale(data.emotionRationale || '');
        }
        if (data.listeningContext) setSuggestedListeningContext(data.listeningContext);
      } catch { /* silent */ }
    })();

    if (!listeningContextProp) {
      setStep('ask_listening_context');
      addBotMessage(
        `Where do you imagine someone listening to this song? (e.g. late-night drive, bedroom, nature walk, gym)`,
        600
      );
    } else if (songEmotionProp && savedLocationArea) {
      setStep('ask_shoot_date_early');
      addBotMessage(
        `Lyrics locked. Got your vibe (**${songEmotionProp}**) and area (**${savedLocationArea}**) — when are you thinking of shooting?`,
        600
      );
    } else if (songEmotionProp) {
      setStep('ask_travel_time');
      addBotMessage(
        `Lyrics locked. How far are you willing to drive to shoot? (e.g. 10 minutes, 30 minutes, 1 hour)`,
        600
      );
    } else {
      // L4: Show auto-suggested emotion (handled in ask_emotion UI)
      setStep('ask_emotion');
      addBotMessage(
        `Lyrics locked. In 1-2 words, what does this song feel like? (e.g. heartbreak, confidence, nostalgia, rage)`,
        600
      );
    }
  };

  // ── F2: Listening context (D+) ───────────────────────────────────────────────

  // A: persist listening context + emotion for skip-on-next-run.
  // We update the galaxy's worlds[0] songEmotion / listeningContext fields directly
  // so GalaxyView picks them up without needing to re-read brainstorm_draft.
  // B: Persist song-specific data to the worlds table directly so it survives draft clears
  const persistSongContext = async (updates: { listening_context?: string; song_emotion?: string }) => {
    if (!worldId) return;
    try {
      const { supabase: sb } = await import('@/lib/supabase');
      await sb.from('worlds').update(updates).eq('id', worldId);
    } catch { /* silent */ }
  };

  const handleListeningContextSubmit = (text: string) => {
    if (!text.trim()) return;
    setListeningContextLocal(text.trim());
    addUserMessage(text.trim());
    persistSongContext({ listening_context: text.trim() }); // A: save immediately
    if (songEmotionProp) {
      // Emotion already saved — skip to travel time
      setStep('ask_travel_time');
      addBotMessage(
        `Got it — **${text.trim()}**. That shapes the location perfectly.\n\nI've got the vibe: **${songEmotionProp}**. Before I pull locations — how far are you willing to drive to shoot? (e.g. 10 minutes, 30 minutes, 1 hour)`,
        500
      );
    } else {
      setStep('ask_emotion');
      addBotMessage(
        `Got it — **${text.trim()}**. That shapes the location perfectly.\n\nNow in 1-2 words, what does this song feel like? (e.g. heartbreak, confidence, nostalgia, rage)`,
        500
      );
    }
  };

  // ── Emotion + Location handlers (G, A, F, F3) ─────────────────────────────────

  const handleEmotionSubmit = (text: string) => {
    if (!text.trim()) return;
    setSongEmotionLocal(text.trim());
    addUserMessage(text.trim());
    persistSongContext({ song_emotion: text.trim() }); // A: save immediately
    // F3: ask travel time before location area
    setStep('ask_travel_time');
    addBotMessage(
      `**${text.trim()}** — got it. That's the filter for everything we shoot.\n\nBefore I pull locations — how far are you willing to drive to shoot? (e.g. 10 minutes, 30 minutes, 1 hour)`,
      500
    );
  };

  // F3: Travel time → F8: now ask shoot date before location (so weather can inform locations)
  const handleTravelTimeSubmit = (text: string) => {
    if (!text.trim()) return;
    setTravelTime(text.trim());
    addUserMessage(text.trim());
    setStep('ask_shoot_date_early');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setRecommendedShootDate(tomorrow);
    addBotMessage(
      `Got it — **${text.trim()}** radius. One more thing before I find locations — when are you thinking of shooting? I'll check the weather and use it to find the best spots and scenes for that day.`,
      400
    );
  };

  // F8: Fetch weather for shoot date + location area, then proceed directly to location fetch
  const fetchWeatherAndProceed = async (date: string, area?: string) => {
    const locationToCheck = area || locationAreaInput;
    if (!locationToCheck) {
      // No location yet — ask for it
      setStep('ask_location_area');
      addBotMessage(`What's your zip code? I'll use that to find spots close to you.`, 400);
      return;
    }
    try {
      const res = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationArea: locationToCheck, shootDate: date }),
      });
      const data = await res.json();
      if (data.weatherSummary) {
        setWeatherSummary(data.weatherSummary);
        setWeatherFilmNote(data.filmNote || '');
        setWeatherIsBad(data.isBad || false);
        if (data.isBad) {
          // Bad weather — warn and let them pick a different date
          addBotMessage(
            `⚠️ Heads up — **${data.weatherSummary}** on that day. ${data.filmNote}. Want to pick a different date, or push forward anyway?`,
            500
          );
          setStep('ask_shoot_date_early');
        } else {
          // Good weather — show note then go straight to location suggestions
          addBotMessage(
            `Weather looks like **${data.weatherSummary}**. ${data.filmNote}. Finding the best spots now...`,
            500
          );
          fetchLocations(locationToCheck);
        }
      } else {
        // Weather unavailable — skip straight to locations silently
        fetchLocations(locationToCheck);
      }
    } catch {
      // On error just proceed to locations
      fetchLocations(locationToCheck);
    }
  };

  const handleShootDateEarlySubmit = (date: string) => {
    setShootDate(date);
    addUserMessage(date);
    // If we already have a location area, fetch weather immediately
    if (locationAreaInput) {
      fetchWeatherAndProceed(date, locationAreaInput);
    } else {
      setStep('ask_location_area');
      addBotMessage(`What's your zip code? I'll use that to find spots close to you.`, 400);
    }
  };

  // Estimate search radius in meters from travel time string
  const travelTimeToRadius = (tt: string): number => {
    const lower = tt.toLowerCase();
    if (lower.includes('hour') || lower.includes('60')) return 50000;
    if (lower.includes('45')) return 35000;
    if (lower.includes('30')) return 25000;
    if (lower.includes('20')) return 15000;
    if (lower.includes('10')) return 8000;
    return 20000; // default 20km
  };

  const [locationFetchCount, setLocationFetchCount] = useState(0);

  const fetchLocations = async (area: string, expandRadius = false) => {
    setLoadingLocations(true);
    setStep('loading_locations');
    const fetchNum = locationFetchCount + 1;
    setLocationFetchCount(fetchNum);

    // Each re-fetch expands the radius to push further out
    const baseRadius = travelTimeToRadius(travelTime);
    const expandedRadius = expandRadius ? Math.min(baseRadius * (1 + fetchNum * 0.5), 80000) : baseRadius;

    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationArea: area,
          emotion: songEmotionLocal || songEmotionProp || '',
          listeningContext: listeningContextLocal || listeningContextProp || '',
          radius: expandedRadius,
          weatherContext: weatherSummary || undefined, // F8: inform location suggestions
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setLocationOptions(data.locations || []);
      setStep('show_locations');
      const emotion = songEmotionLocal || songEmotionProp || 'the song';
      const distNote = expandedRadius > baseRadius ? ` (searching further out now)` : '';
      addBotMessage(`Here are 3 spots that fit the **${emotion}** vibe${distNote}. Pick one, or let me know if you'd like me to look further.`, 600);
    } catch {
      setStep('ask_location_area');
      addBotMessage(`Couldn't load location suggestions — just type the spot you have in mind and we'll go with that.`, 500);
    } finally {
      setLoadingLocations(false);
    }
  };

  // A: Persist location area + emotion + listeningContext to galaxy so they're skipped next time
  const persistBrainstormContext = async (area: string) => {
    if (!galaxyId || !area) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('galaxies').update({ brainstorm_location_area: area }).eq('id', galaxyId);
    } catch { /* silent */ }
  };

  const handleLocationAreaSubmit = (text: string) => {
    if (!text.trim()) return;
    setLocationAreaInput(text.trim());
    addUserMessage(text.trim());
    persistBrainstormContext(text.trim()); // A: save for next run
    // F8: if we have a shoot date and haven't fetched weather yet, do it now before locations
    // Otherwise go straight to locations (weather already fetched or no date set)
    if (shootDate && !weatherSummary) {
      fetchWeatherAndProceed(shootDate, text.trim());
    } else {
      fetchLocations(text.trim());
    }
  };

  // B: Location text input ALWAYS triggers a new location search — never confirms as a place name.
  // The only way to confirm a location is by tapping one of the 3 location cards.
  const handleLocationTextInput = (text: string) => {
    if (!text.trim()) return;
    addUserMessage(text.trim());
    setUserInput('');
    addBotMessage(`Got it — searching for better spots based on that...`, 400);
    // Pass user's text as additional search context alongside the base area
    const searchQuery = locationAreaInput ? `${locationAreaInput} ${text.trim()}` : text.trim();
    fetchLocations(searchQuery, true);
  };

  const handleLocationConfirm = (name: string, mapsUrl: string) => {
    setConfirmedLocation(name);
    setConfirmedLocationUrl(mapsUrl);
    addUserMessage(name);
    // Now load ideas — pass location + emotion to shape scene-based ideas
    setStep('loading_ideas');
    addBotMessage(`Shooting at **${name}** — perfect. Pulling real TikTok data and building scene ideas now...`, 500);
    fetchIdeas(songEmotionLocal || songEmotionProp || '', listeningContextLocal || listeningContextProp || '', name);
  };

  // ── F5: Soundbyte selection ───────────────────────────────────────────────────

  const ALL_SOUNDBYTES: Soundbyte[] = [
    { id: 'sb1', section: 'Chorus only', timeRange: '0:28–0:52', duration: '~24s', rationale: 'Catchiest hook — highest replay probability and skimmability.' },
    { id: 'sb2', section: 'Verse 1 → Chorus', timeRange: '0:10–0:52', duration: '~42s', rationale: 'Builds context before the hook hits — great for emotional content.' },
    { id: 'sb3', section: 'Intro → Verse 1', timeRange: '0:00–0:28', duration: '~28s', rationale: 'Cold open — grabs attention from the very first beat.' },
    { id: 'sb4', section: 'Bridge → Chorus', timeRange: '1:05–1:35', duration: '~30s', rationale: 'Emotional peak + resolution — high retention format.' },
    { id: 'sb5', section: 'Chorus → Verse 2', timeRange: '0:28–0:58', duration: '~30s', rationale: 'Extended hook with fresh momentum — tests hook fatigue.' },
    { id: 'sb6', section: 'Pre-Chorus → Chorus', timeRange: '0:20–0:52', duration: '~32s', rationale: 'The buildup before the drop — teases the hook effectively.' },
    { id: 'sb7', section: 'Outro only', timeRange: '2:45–3:00', duration: '~15s', rationale: 'Emotional ending — great for nostalgia or bittersweet vibes.' },
    { id: 'sb8', section: 'Second Chorus', timeRange: '1:40–2:05', duration: '~25s', rationale: 'More emotional weight than the first — peak engagement zone.' },
    { id: 'sb9', section: 'Verse 2 → Bridge', timeRange: '0:58–1:30', duration: '~32s', rationale: 'Deep cut — rewards listeners who already know the song.' },
    { id: 'sb10', section: 'Intro only', timeRange: '0:00–0:14', duration: '~14s', rationale: 'Ultra-short cold open — great for algorithm-boosting loops.' },
  ];

  // L7: Build lyrics-aware soundbyte options from Whisper segments
  const buildLyricsSoundbytes = (): Soundbyte[] => {
    if (!lyricsSegments.length) return ALL_SOUNDBYTES;
    const totalDuration = lyricsSegments[lyricsSegments.length - 1]?.end || 180;
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    // Find natural section boundaries: intro (0-15%), verse1 (~15-35%), chorus (~35-55%), verse2 (~55-70%), bridge (~70-85%), outro (~85-100%)
    const pct = (p: number) => Math.round(totalDuration * p);
    const segAtTime = (t: number) => lyricsSegments.find(s => s.start <= t && s.end >= t)?.text?.trim() || '';
    return [
      { id: 'sb1', section: 'Chorus', timeRange: `${fmtTime(pct(0.35))}–${fmtTime(pct(0.55))}`, duration: `~${Math.round((pct(0.55) - pct(0.35)))}s`, rationale: `"${segAtTime(pct(0.40)).slice(0, 60) || 'Hook section'}" — catchiest hook, highest replay probability.` },
      { id: 'sb2', section: 'Verse 1 → Chorus', timeRange: `${fmtTime(pct(0.10))}–${fmtTime(pct(0.55))}`, duration: `~${Math.round((pct(0.55) - pct(0.10)))}s`, rationale: `"${segAtTime(pct(0.15)).slice(0, 60) || 'Opens verse'}" — builds into the hook.` },
      { id: 'sb3', section: 'Intro → Verse 1', timeRange: `${fmtTime(0)}–${fmtTime(pct(0.30))}`, duration: `~${pct(0.30)}s`, rationale: `"${segAtTime(pct(0.05)).slice(0, 60) || 'Cold open'}" — cold open from the very first line.` },
      { id: 'sb4', section: 'Bridge → Chorus', timeRange: `${fmtTime(pct(0.70))}–${fmtTime(pct(0.90))}`, duration: `~${Math.round((pct(0.90) - pct(0.70)))}s`, rationale: `"${segAtTime(pct(0.72)).slice(0, 60) || 'Bridge build'}" — emotional peak into resolution.` },
      { id: 'sb5', section: 'Chorus → Verse 2', timeRange: `${fmtTime(pct(0.35))}–${fmtTime(pct(0.65))}`, duration: `~${Math.round((pct(0.65) - pct(0.35)))}s`, rationale: `"${segAtTime(pct(0.58)).slice(0, 60) || 'Extended hook'}" — hook + fresh momentum.` },
      { id: 'sb6', section: 'Pre-Chorus → Chorus', timeRange: `${fmtTime(pct(0.25))}–${fmtTime(pct(0.55))}`, duration: `~${Math.round((pct(0.55) - pct(0.25)))}s`, rationale: `"${segAtTime(pct(0.28)).slice(0, 60) || 'Builds to hook'}" — tease before the drop.` },
      { id: 'sb7', section: 'Outro', timeRange: `${fmtTime(pct(0.85))}–${fmtTime(totalDuration)}`, duration: `~${Math.round(totalDuration - pct(0.85))}s`, rationale: `"${segAtTime(pct(0.90)).slice(0, 60) || 'Closing lines'}" — emotional ending.` },
      ...ALL_SOUNDBYTES.slice(7),
    ];
  };

  const enterSoundbytes = () => {
    setStep('ask_soundbytes');
    if (confirmedSoundbytes.length > 0) {
      addBotMessage(
        `I've got your soundbytes from last session saved. Take a look — keep them as-is or start fresh with a new upload.`,
        400
      );
    } else {
      addBotMessage(
        `Now let's pick your soundbytes — the sections of your song each post will be cut to. ${lyricsSegments.length ? "I've pre-selected 5 regions based on your lyrics structure." : "I've pre-selected 5 regions across the track."} Drag the edges to resize, rename any section, and hit Confirm when you're happy.`,
        400
      );
    }
  };

  // Handles confirmation from the new SoundbytePicker component
  const handleSoundbytePickerConfirm = async (picked: SoundbyteDef[]) => {
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const confirmed: Soundbyte[] = picked.map(sb => ({
      id: sb.id,
      section: sb.label,
      timeRange: `${fmtTime(sb.startSec)}–${fmtTime(sb.endSec)}`,
      duration: `~${Math.round(sb.endSec - sb.startSec)}s`,
      rationale: '',
    }));
    setConfirmedSoundbytes(confirmed);
    addUserMessage(`Confirmed ${confirmed.length} soundbytes`);

    // Persist soundbytes immediately — they must survive clearDraft() at completion
    if (galaxyId) {
      (async () => {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: gal } = await supabase.from('galaxies').select('brainstorm_draft').eq('id', galaxyId).single();
          const existing = (gal?.brainstorm_draft as Record<string, unknown>) || {};
          await supabase.from('galaxies').update({
            brainstorm_draft: { ...existing, confirmedSoundbytes: confirmed },
          }).eq('id', galaxyId);
        } catch { /* best-effort */ }
      })();
    }

    enterPhase2();
  };

  // Legacy helpers kept for backward compat (no longer used in main flow)
  const handleSoundbyteToggle = (id: string, accept: boolean) => {
    if (accept) {
      setLikedSoundbytes(prev => { const n = new Set(prev); n.add(id); return n; });
      setRejectedSoundbytes(prev => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      setRejectedSoundbytes(prev => { const n = new Set(prev); n.add(id); return n; });
      setLikedSoundbytes(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleSoundbytesConfirm = () => {
    const confirmed = soundbyteOptions.filter(s => !rejectedSoundbytes.has(s.id));
    setConfirmedSoundbytes(confirmed);
    addUserMessage(`Confirmed ${confirmed.length} soundbytes`);
    enterPhase2();
  };

  // ── Phase 2: Shoot Day inline handlers (E, I) ─────────────────────────────────

  const enterPhase2 = () => {
    // F10: recommend a specific date based on existing schedule
    const today = new Date();
    // Recommend next Saturday or Sunday, whichever is closer
    const daysUntilSat = (6 - today.getDay() + 7) % 7 || 7;
    const daysUntilSun = (0 - today.getDay() + 7) % 7 || 7;
    const daysUntilRec = Math.min(daysUntilSat, daysUntilSun);
    const recDate = new Date(today);
    recDate.setDate(today.getDate() + daysUntilRec);
    const recDateStr = recDate.toISOString().split('T')[0];
    const recDateLabel = recDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    setRecommendedShootDate(recDateStr);
    setShootDate(recDateStr);
    setStep('shoot_day_date_v2');
    addBotMessage(
      `Now let's lock in the shoot. I'd suggest **${recDateLabel}** — it's the closest weekend day. Lock it in or pick another day.`,
      500
    );
  };

  const handleShootDateV2 = (date: string, time?: string) => {
    setShootDate(date);
    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (time) {
      // Date + time selected together (F8)
      setShootTimeOfDay(time);
      addUserMessage(`${dateLabel}, ${time}`);
      setStep('shoot_day_crew');
      const crewPrompt = buildCrewPrompt();
      addBotMessage(crewPrompt, 400);
    } else {
      addUserMessage(dateLabel);
      setStep('shoot_day_time');
      addBotMessage(`What time of day works best?`, 400);
    }
  };

  const handleShootTimeSelect = (time: string) => {
    setShootTimeOfDay(time);
    addUserMessage(time);
    setStep('shoot_day_crew');
    const crewPrompt = buildCrewPrompt();
    addBotMessage(crewPrompt, 400);
  };

  // F13: Build crew prompt using real team member names
  const buildCrewPrompt = (): string => {
    if (teamMembers && teamMembers.length > 0) {
      return `Got it. Who's helping you film?`;
    }
    return `Got it. Are you shooting solo, or do you have someone helping you film?`;
  };

  const handleShootCrewSelect = (crew: string) => {
    setShootCrew(crew);
    addUserMessage(crew);
    // Nudge for solo (F13)
    if (crew === 'Just me' || crew.toLowerCase().includes('solo')) {
      setStep('shoot_day_crew');
      addBotMessage(
        `Heads up — even one extra person to hold the camera makes this way more manageable. Want to invite someone? (**Yes** to invite, **No** to continue solo)`,
        400
      );
      return;
    }
    setStep('generating_output');
    addBotMessage(`Perfect — building your shoot day, edit days, and post schedule now...`, 400);
    setTimeout(() => buildAndComplete(), 800);
  };

  // Auto-generate looks — accepts either a count or an array length (J: shot list)
  const generateLooks = (countOrArray: number | ContentFormatAssignment[]): import('@/types').ShootLook[] => {
    const count = Math.max(typeof countOrArray === 'number' ? countOrArray : (countOrArray.length + 2), 4);
    const lookTemplates = [
      { angle: 'wide', energy: 'mid-energy', descTpl: 'Wide, front-facing, standing' },
      { angle: 'close-up', energy: 'high-energy', descTpl: 'Close-up, front-facing, intense' },
      { angle: 'medium', energy: 'calm', descTpl: 'Medium, slight side angle, relaxed' },
      { angle: 'wide', energy: 'high-energy', descTpl: 'Wide, side profile, dynamic' },
      { angle: 'close-up', energy: 'calm', descTpl: 'Close-up, looking away from camera' },
      { angle: 'medium', energy: 'mid-energy', descTpl: 'Medium, overhead angle' },
      { angle: 'wide', energy: 'calm', descTpl: 'Wide, back-of-subject facing away' },
      { angle: 'close-up', energy: 'high-energy', descTpl: 'Close-up, handheld movement' },
    ];
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      description: `${lookTemplates[i % lookTemplates.length].descTpl}${confirmedLocation ? ` — ${confirmedLocation}` : ''}`,
      angle: lookTemplates[i % lookTemplates.length].angle,
      energy: lookTemplates[i % lookTemplates.length].energy,
    }));
  };

  // Build expected edits from assignments (K: soundbyte distribution)
  const buildExpectedEdits = (assignments: ContentFormatAssignment[], looks: import('@/types').ShootLook[]): import('@/types').ExpectedEdit[] => {
    const soundbytes = ['intro', 'verse', 'pre-chorus', 'chorus', 'second chorus', 'bridge', 'outro'];
    return assignments.map((a, i) => {
      const look = looks[i % looks.length];
      const soundbyte = soundbytes[i % soundbytes.length];
      const targetLength = i % 3 === 0 ? '7s' : i % 3 === 1 ? '15s' : '30s';
      // Edit day: find first free day after shoot, spaced ~1 per day
      const shootDateObj = shootDate ? new Date(shootDate + 'T12:00:00') : new Date();
      const editDayOffset = Math.floor(i / 2) + 1; // batch 2 per day
      const editDayObj = new Date(shootDateObj.getTime() + editDayOffset * 24 * 60 * 60 * 1000);
      return {
        postIndex: a.postIndex,
        postDate: a.date,
        postTitle: a.ideaTitle || `Post ${i + 1}`,
        lookNumber: look.number,
        soundbyte,
        targetLength,
        textOverlaySuggestion: a.ideaHook || `${songEmotionLocal || songEmotionProp || ''} energy — no caption needed`,
        editDayDate: editDayObj.toISOString().split('T')[0],
      };
    });
  };

  // Decorate assignments with soundbyte + look info
  const decorateAssignmentsWithStafford = (
    rawAssignments: ContentFormatAssignment[],
    looks: import('@/types').ShootLook[],
    expectedEdits: import('@/types').ExpectedEdit[],
    relDate: string
  ): ContentFormatAssignment[] => {
    const soundbytes = ['intro', 'verse', 'pre-chorus', 'chorus', 'second chorus', 'bridge', 'outro'];
    return rawAssignments.map((a, i) => {
      const look = looks[i % looks.length];
      const soundbyte = soundbytes[i % soundbytes.length];
      // rollout zone
      let rolloutZone: 'pre-release' | 'release-week' | 'post-release' = 'post-release';
      if (relDate && a.date) {
        const postD = new Date(a.date);
        const relD = new Date(relDate);
        const diff = (postD.getTime() - relD.getTime()) / (1000 * 60 * 60 * 24);
        if (diff < -1) rolloutZone = 'pre-release';
        else if (diff <= 7) rolloutZone = 'release-week';
        else rolloutZone = 'post-release';
      }
      return { ...a, soundbyte, shootLook: look.description, rolloutZone };
    });
  };

  // Helper: add N days to a date string
  const addDays = (dateStr: string, n: number): string => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };

  // Helper: format date for label
  const fmtDate = (dateStr: string): string =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const buildAndComplete = () => {
    // F6: Stafford scientific schedule
    // Use confirmed soundbytes (5) and confirmed scenes (up to 3)
    const scenes = allLikedIdeas.slice(0, 3);
    const soundbytes = confirmedSoundbytes.length >= 3 ? confirmedSoundbytes : ALL_SOUNDBYTES.slice(0, 5);
    // Generate 5 looks — one per scene + 2 extra camera angles
    const looks = generateLooks(Math.max(scenes.length * 3, 9));

    // Shoot day
    const shootDay: BrainstormShootDay = {
      id: `shoot-${Date.now()}`,
      format: 'custom',
      customFormatName: confirmedLocation || `${galaxyName} Shoot`,
      reason: `${songEmotionLocal || songEmotionProp || 'Content'} shoot for ${galaxyName}`,
      duration: 120,
      date: shootDate,
      startTime: shootTimeOfDay === 'morning' ? '09:00' : shootTimeOfDay === 'afternoon' ? '13:00' : '18:00',
      endTime: shootTimeOfDay === 'morning' ? '11:00' : shootTimeOfDay === 'afternoon' ? '15:00' : '20:00',
      timeOfDay: shootTimeOfDay,
      crew: shootCrew,
      location: confirmedLocation,
      locationUrl: confirmedLocationUrl,
      looks,
      sharedWith: [],
    };

    // F6: Content starts 4 days after shoot (editing buffer)
    const contentStart = addDays(shootDate, 4);

    // Batch 1: 5 skeleton posts using X.YZ naming convention
    // Schedule: POST POST POST _ POST POST _ (days 0,1,2,4,5 from contentStart)
    // Shoot number = 1 (increments per shoot), batch number = 1 (first edit day)
    const shootNum = 1;
    const batchNum = 1;
    const BATCH_POST_DAYS = [0, 1, 2, 4, 5]; // day offsets for 5 posts within the batch week
    const filledAssignments: ContentFormatAssignment[] = BATCH_POST_DAYS.map((dayOffset, i) => {
      const postNum = i + 1; // 1-5
      const postId = `${shootNum}.${batchNum}${postNum}`; // e.g. "1.11", "1.12"
      const scene = scenes[i % Math.max(scenes.length, 1)];
      const look = looks[i % looks.length];
      const postDate = addDays(contentStart, dayOffset);
      let rolloutZone = `skeleton-${shootNum}.${batchNum}${postNum}`;
      return {
        postId: `fa-w1-${i}-${Date.now()}`,
        postIndex: i,
        date: postDate,
        postType: 'promo' as const,
        format: 'custom' as const,
        ideaTitle: `Post ${postId}`,
        ideaHook: (scene as any)?.action || scene?.title || '',
        soundbyte: soundbytes[i % soundbytes.length]?.section || '',
        shootLook: look.description,
        rolloutZone,
        trialReelDate: addDays(postDate, -1),
      };
    });

    // Trial reels: 2 per post (each gets its own slot the day before the post)
    // Trial N for Post 1.11 → posted day-1, then Post 1.11 is posted the next day
    // One of the 2 trials becomes the actual post — so 5 posts × 2 trials = 10 extra edits
    const trialReels = filledAssignments.map((a, idx) => ({
      postIndex: idx,
      postDate: a.date,
      trialDate: a.trialReelDate!,
      postTitle: a.ideaTitle || `Post ${idx + 1}`,
    }));

    // Weeks 2–6: 25 AMBIGUOUS post slots (5/week × 5 weeks)
    // Each labeled: "Promo Post — Edit instructions after Weekly Check-in on [date]"
    const ambiguousAssignments: ContentFormatAssignment[] = [];
    for (let week = 1; week <= 5; week++) {
      // Weekly check-in is Sunday of each week (day 6 of each 7-day week after contentStart+8)
      const weekStartOffset = 10 + (week - 1) * 7; // week 2 starts at contentStart+10
      const checkInDate = addDays(contentStart, weekStartOffset + 6); // Sunday
      for (let day = 0; day < 5; day++) {
        const postDate = addDays(contentStart, weekStartOffset + day * 1.4); // ~5 posts spread across 7 days
        let rolloutZone: 'pre-release' | 'release-week' | 'post-release' = 'post-release';
        if (releaseDate) {
          const diff = (new Date(postDate).getTime() - new Date(releaseDate).getTime()) / 86400000;
          rolloutZone = diff < -1 ? 'pre-release' : diff <= 7 ? 'release-week' : 'post-release';
        }
        ambiguousAssignments.push({
          postId: `fa-w${week + 1}-${day}-${Date.now()}`,
          postIndex: 5 + (week - 1) * 5 + day,
          date: postDate,
          postType: 'promo' as const,
          format: 'custom' as const,
          ideaTitle: `Promo Post`,
          ideaHook: `Edit instructions will be filled after Weekly Check-in on ${fmtDate(checkInDate)}`,
          rolloutZone,
        });
      }
    }

    const allAssignments = [...filledAssignments, ...ambiguousAssignments];

    // F9: Edit days — 2 explicit for week 1, 1 ambiguous per week for weeks 2-6
    const editDays: BrainstormEditDay[] = [];

    // Week 1 explicit edit days: days 1 and 3 after contentStart
    const w1EditDates = [
      addDays(contentStart, 1),
      addDays(contentStart, 5),
    ];
    w1EditDates.forEach((date, i) => {
      const postsForDay = filledAssignments.slice(i * 2, i * 2 + 3); // ~2-3 posts per edit day
      const instructions = postsForDay.map(p => {
        const look = looks[p.postIndex % looks.length];
        const sb = soundbytes[p.postIndex] || soundbytes[0];
        return `Post "${p.ideaTitle}" (${fmtDate(p.date)}): Pull ${look.description} footage. Soundbyte: **${sb.section}** (${sb.timeRange}). Target: ${i === 0 ? '15s' : '30s'}. Text: "${p.ideaHook || 'no caption needed'}"`;
      }).join('\n');
      editDays.push({
        id: `edit-w1-${i}`,
        format: 'custom',
        customFormatName: `Edit Day ${i + 1} — Week 1`,
        postsCovered: postsForDay.map(p => p.postIndex),
        duration: postsForDay.length * 45,
        date,
        startTime: '10:00',
        endTime: `${10 + postsForDay.length}:00`,
        editorInstructions: instructions,
        footageRef: `Footage from ${confirmedLocation || 'shoot day'} — Looks ${looks.slice(0, 3).map(l => l.number).join(', ')}`,
      });
    });

    // Weeks 2-6 ambiguous edit days
    for (let week = 1; week <= 5; week++) {
      const weekStartOffset = 10 + (week - 1) * 7;
      const checkInDate = addDays(contentStart, weekStartOffset + 6);
      const editDate = addDays(contentStart, weekStartOffset + 2);
      editDays.push({
        id: `edit-w${week + 1}`,
        format: 'custom',
        customFormatName: `Edit Day — Week ${week + 1}`,
        postsCovered: [],
        duration: 120,
        date: editDate,
        startTime: '10:00',
        endTime: '12:00',
        editorInstructions: `Edit instructions will be filled after Weekly Check-in on ${fmtDate(checkInDate)}`,
        footageRef: '',
      });
    }

    const expectedEdits = buildExpectedEdits(filledAssignments, looks);

    // Pass liked scenes (E1-E3: timed schedule uses these for ordering and per-scene breakdown)
    const confirmedScenes = allLikedIdeas.slice(0, 3).map(idea => ({
      title: idea.title,
      setting: (idea as any).setting,
      action: (idea as any).action,
      emotionalAngle: (idea as any).emotionalAngle,
      timeOfDay: (idea as any).timeOfDay,
      difficulty: idea.difficulty,
      practicalRequirements: (idea as any).practicalRequirements,
    }));

    const result: BrainstormResult = {
      id: `brainstorm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      galaxyId,
      galaxyName,
      formatAssignments: allAssignments,
      editDays,
      shootDays: [shootDay],
      shootDayAction: 'plan_now',
      shootDayDate: shootDate,
      confirmedLocation,
      confirmedLocationUrl,
      shootTimeOfDay,
      shootCrew,
      looks,
      expectedEdits,
      trialReels,
      confirmedScenes,
      completedAt: new Date().toISOString(),
      status: 'completed',
    };

    setStep('complete');
    // Preserve confirmed soundbytes in the draft so SongDataTab can load them
    clearDraft(confirmedSoundbytes.length ? confirmedSoundbytes : undefined);
    addBotMessage(
      `Done! 🎬\n\n**3 scenes × 5 looks = 15 full takes** on shoot day.\n\n**Week 1:** 5 posts lined up with explicit soundbytes + edit instructions.\n**Weeks 2–6:** 25 ambiguous post slots that fill in after each Weekly Check-in.\n\nShoot day locked: **${fmtDate(shootDate)}** at **${confirmedLocation || 'your location'}**.\n\nCheck your calendar — everything is on there.`,
      600
    );
    onComplete(result);
  };

  // ── Ideas phase handlers ─────────────────────────────────────────────────────

  const handleSongStorySubmitWithText = (text: string) => {
    if (!text.trim()) return;
    addUserMessage(text.trim());
    setStep('ask_vibe');
    addBotMessage(`Got it. How would you describe your visual aesthetic — the vibe you want people to feel?`, 500);
  };

  const handleVibeSubmitWithText = (text: string) => {
    if (!text.trim()) return;
    addUserMessage(text.trim());
    setStep('loading_ideas');
    addBotMessage(`Pulling real TikTok data from similar artists and generating your ideas... 🔍`, 500);
    fetchIdeas(songStory, text.trim(), '');
  };

  // Keep these for backward compat if called without text arg
  const handleSongStorySubmit = () => handleSongStorySubmitWithText(userInput);
  const handleVibeSubmit = () => handleVibeSubmitWithText(userInput);


  // Accumulated liked ideas across all feedback rounds
  const [allLikedIdeas, setAllLikedIdeas] = useState<ContentIdea[]>([]);
  const [feedbackRound, setFeedbackRound] = useState(0);

  // E: Persist the growing liked-scenes bank to galaxies.brainstorm_liked_scenes whenever it grows
  useEffect(() => {
    if (!galaxyId || allLikedIdeas.length === 0) return;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('galaxies').update({ brainstorm_liked_scenes: allLikedIdeas }).eq('id', galaxyId);
      } catch { /* silent */ }
    })();
  }, [allLikedIdeas]); // eslint-disable-line react-hooks/exhaustive-deps

  // F6: Auto-save draft on meaningful state changes (placed here so all deps are declared)
  useEffect(() => {
    // Save from any meaningful step — skip initial and transient steps
    // A2: ask_song_upload_first excluded so initial mount never overwrites a real draft
    const skipSteps: BrainstormStep[] = ['complete', 'ask_emotion', 'ask_listening_context', 'ask_user_idea', 'loading_ideas', 'ask_song_upload_first'];
    if (skipSteps.includes(step)) return;
    saveDraftToSupabase({
      step,
      songEmotionLocal,
      listeningContextLocal,
      travelTime,
      shootDate,
      locationAreaInput,
      confirmedLocation,
      confirmedLocationUrl,
      weatherSummary,
      weatherFilmNote,
      weatherIsBad,
      allLikedIdeas: [...allLikedIdeas], // ensure serializable
      userPitchedScene,
      feedbackRound,
      // Persist in-memory API results so resume can restore them without re-fetching
      contentIdeas: [...contentIdeas],
      locationOptions: [...locationOptions],
      // Persist lyrics + soundbytes so they survive a mid-session refresh
      ...(lyricsText ? { lyrics: lyricsText } : {}),
      ...(confirmedSoundbytes.length ? { confirmedSoundbytes } : {}),
      savedAt: new Date().toISOString(),
    });
  }, [step, confirmedLocation, allLikedIdeas, likedIdeas.size, contentIdeas.length, locationOptions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Variations state
  const [ideasForVariationPrompt, setIdeasForVariationPrompt] = useState<ContentIdea[]>([]);
  const [variationsPerPost, setVariationsPerPost] = useState(1);
  const [variationCards, setVariationCards] = useState<PostVariationCard[]>([]);
  const [variationsInput, setVariationsInput] = useState('');

  const toggleLike = (id: string) => {
    setLikedIdeas(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setDislikedIdeas(prev => { const next = new Set(prev); next.delete(id); return next; });
    // Close any open note field when switching to like
    if (noteOpenForId === id) setNoteOpenForId(null);
  };

  const toggleDislike = (id: string) => {
    setDislikedIdeas(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setLikedIdeas(prev => { const next = new Set(prev); next.delete(id); return next; });
    // Auto-open notes field when disliking
    setNoteOpenForId(id);
  };

  // Save scene feedback to localStorage for in-session use and cross-user learning
  const saveSceneFeedback = (idea: ContentIdea, rating: 'like' | 'dislike', note: string) => {
    try {
      const key = `scene_feedback_${galaxyName || 'unknown'}`;
      const existing: unknown[] = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({
        ideaId: idea.id,
        title: idea.title,
        action: (idea as any).action || '',
        rating,
        note,
        location: confirmedLocation,
        emotion: songEmotionLocal,
        songName: galaxyName,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(existing.slice(-50))); // keep last 50
    } catch { /* silent */ }
  };

  // Called when all 5 ideas have been rated — auto-proceed or auto-generate new batch
  const handleAllRated = async (liked: Set<string>, disliked: Set<string>, notes: Record<string, string>) => {
    const likedIdeasList = contentIdeas.filter(i => liked.has(i.id));
    const dislikedIdeasList = contentIdeas.filter(i => disliked.has(i.id));

    // Save feedback for all rated ideas
    likedIdeasList.forEach(i => saveSceneFeedback(i, 'like', notes[i.id] || ''));
    dislikedIdeasList.forEach(i => saveSceneFeedback(i, 'dislike', notes[i.id] || ''));

    // Merge newly liked into accumulated list
    const merged = [
      ...allLikedIdeas,
      ...likedIdeasList.filter(l => !allLikedIdeas.find(a => a.id === l.id)),
    ];
    setAllLikedIdeas(merged);

    const TARGET = 3;
    if (merged.length >= TARGET) {
      // F7: Scene variety check — flag if all 3 locked scenes feel too similar
      const scenes = merged.slice(0, TARGET);
      const angles = scenes.map(s => ((s as any).emotionalAngle || s.title).toLowerCase());
      const actions = scenes.map(s => ((s as any).action || '').toLowerCase());
      // Similarity heuristic: check overlap in key words across emotional angles
      const allWords = angles.join(' ') + ' ' + actions.join(' ');
      const similarityKeywords = ['walk', 'stand', 'sit', 'still', 'slow', 'lone', 'alone', 'quiet', 'solitary'];
      const dominantKeyword = similarityKeywords.find(kw => (allWords.match(new RegExp(kw, 'g')) || []).length >= 2);
      if (dominantKeyword) {
        setIdeasForVariationPrompt(scenes);
        addBotMessage(
          `These 3 scenes have a similar feel — they all lean toward a "${dominantKeyword}" energy. You'll get more variety in the edit if one of them has a contrasting vibe.\n\nWant me to suggest a contrasting option to swap one out, or are you happy with these 3?`,
          600
        );
        setStep('ideas_feedback'); // reuse feedback step to catch their response
        return;
      }

      setIdeasForVariationPrompt(scenes);
      addBotMessage(
        `3 scenes confirmed × 5 looks each = 15 full takes on shoot day. From those, your editor can cut ~45 posts.\n\nNow let's pick 5 soundbytes — the song sections each reel will use.`,
        500
      );
      enterSoundbytes();
    } else {
      // Not enough liked — auto-generate a fresh batch using rejection notes
      const round = feedbackRound + 1;
      setFeedbackRound(round);
      setStep('loading_ideas');
      const remaining = TARGET - merged.length;
      addBotMessage(
        `${merged.length > 0 ? `${merged.length} scene${merged.length !== 1 ? 's' : ''} locked in` : 'Got it'} — generating 5 fresh options based on your feedback...`,
        400
      );
      setLoadingIdeas(true);
      try {
        const genres: string[] = (artistProfile as any)?.genre || ['indie'];
        const rejectedWithNotes = dislikedIdeasList.map(i => ({
          title: i.title,
          hook: (i as any).action || i.title,
          userNote: notes[i.id] || '',
        }));
        const res = await fetch('/api/tiktok-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            genres,
            songName: galaxyName,
            songStory,
            artistVibe,
            comfortLevel,
            releaseDate,
            previousIdeas: contentIdeas,
            rejectedWithNotes,
            songEmotion: songEmotionLocal || songEmotionProp || '',
            shootLocation: confirmedLocation || '',
            listeningContext: listeningContextProp || '',
            // F2: artist's pitched concept shapes next batch
            artistPitchedConcept: userPitchedScene || undefined,
            weatherContext: weatherSummary || undefined,
            lyricsContext: lyricsText || undefined, // L5/L6
          }),
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const newIdeas: ContentIdea[] = (data.ideas || []).map((idea: ContentIdea, idx: number) => ({
          ...idea,
          id: `round${round}_idea_${idx + 1}`,
        }));
        setContentIdeas(newIdeas);
        setLikedIdeas(new Set());
        setDislikedIdeas(new Set());
        setIdeaNotes({});
        setNoteOpenForId(null);
        const likedSoFar = merged.length;
        const locationNote = confirmedLocation ? ` at ${confirmedLocation}` : '';
        addBotMessage(
          `Here are 5 fresh scenes${locationNote}. ${likedSoFar > 0 ? `You have ${likedSoFar} locked — rate all 5 and pick ${TARGET - likedSoFar} more:` : 'Rate every card — 👍 to lock in, 👎 to leave a note. Need 3 total.'}`,
          800
        );
        setStep('show_ideas');
      } catch {
        addBotMessage(`Trouble generating new ideas. Let's work with what you have.`, 600);
        proceedToPostAssignment(merged.length > 0 ? merged : contentIdeas);
      } finally {
        setLoadingIdeas(false);
      }
    }
  };

  // Called when user manually confirms 3 scenes via the button
  const handleIdeasConfirmed = () => {
    handleAllRated(likedIdeas, dislikedIdeas, ideaNotes);
  };

  // Positive sentiment phrases that mean "move on" (no real feedback)
  const isPositiveOrEmpty = (text: string): boolean => {
    if (!text.trim()) return true;
    const t = text.toLowerCase().trim();
    const positives = [
      'looks good', 'sounds good', 'good', 'great', 'perfect', 'love it', 'love them',
      'move on', "let's go", 'lets go', 'yes', 'yeah', 'yep', 'no notes', 'no feedback',
      'none', 'nothing', 'all good', 'ok', 'okay', "that's fine", 'go ahead', 'proceed',
      "i'm good", 'im good', "i'm happy", 'im happy', "those are good", 'these are good',
    ];
    return positives.some(p => t === p || t.startsWith(p + ' ') || t.includes(p));
  };

  const handleFeedbackSubmit = async (text: string) => {
    if (!text.trim() && allLikedIdeas.length === 0) return; // need at least something

    addUserMessage(text.trim() || 'Looks good, let\'s move on');

    // F7: "yes swap" response to variety check
    const wantsSwap = ['yes', 'yeah', 'swap', 'sure', 'replace', 'change', 'swap one', 'yes swap'].some(w => text.toLowerCase().includes(w));
    const wantsKeep = ['no', 'keep', 'good', 'fine', 'happy', 'proceed', 'move on', 'continue'].some(w => text.toLowerCase().includes(w));

    if (wantsSwap && allLikedIdeas.length >= 3) {
      addBotMessage(`Generating 3 contrasting options — pick one to replace whichever scene feels too similar.`, 400);
      setStep('loading_ideas');
      try {
        const genres: string[] = (artistProfile as any)?.genre || ['indie'];
        const res = await fetch('/api/tiktok-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            genres,
            songName: galaxyName,
            releaseDate,
            previousIdeas: allLikedIdeas,
            songEmotion: songEmotionLocal || songEmotionProp || '',
            shootLocation: confirmedLocation || '',
            weatherContext: weatherSummary || undefined,
            feedback: 'The current scenes are too similar in energy. Generate 3 contrasting scenes with different energy, angle, or physical action.',
          }),
        });
        const data = await res.json();
        const swapOptions: ContentIdea[] = (data.ideas || []).slice(0, 3).map((idea: ContentIdea, idx: number) => ({
          ...idea,
          id: `swap_${idx + 1}`,
        }));
        setContentIdeas(swapOptions);
        setLikedIdeas(new Set());
        setDislikedIdeas(new Set());
        setIdeaNotes({});
        setStep('show_ideas');
        addBotMessage(`Here are 3 contrasting options. 👍 one to replace a scene, or rate all 3 if you want fresh alternatives.`, 600);
      } catch {
        // If fails, just proceed
        enterSoundbytes();
      }
      return;
    }

    // F4: TARGET is 3 scenes; F6: skip variations step, go directly to soundbytes
    if (isPositiveOrEmpty(text) || wantsKeep || allLikedIdeas.length >= 3) {
      const ideas = allLikedIdeas.length > 0 ? allLikedIdeas : contentIdeas;
      const sceneCount = Math.min(ideas.length, 3);
      setIdeasForVariationPrompt(ideas.slice(0, sceneCount));
      addBotMessage(
        `3 scenes confirmed × 5 looks each = 15 full takes on shoot day. From those, your editor can cut ~45 posts.\n\nNow let's pick 5 soundbytes — the song sections each reel will use.`,
        500
      );
      enterSoundbytes();
      return;
    }

    // Has real feedback — generate a new round of ideas
    const round = feedbackRound + 1;
    setFeedbackRound(round);
    setStep('loading_ideas');
    addBotMessage(`Got it — adjusting the ideas based on your notes...`, 400);

    setLoadingIdeas(true);
    try {
      const genres: string[] = (artistProfile as any)?.genre || ['indie'];
      const allShownIds = new Set(contentIdeas.map(i => i.id));
      const previousIdeasForAPI = contentIdeas; // pass all shown ideas to avoid repeats

      const res = await fetch('/api/tiktok-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres,
          songName: galaxyName,
          songStory,
          artistVibe,
          comfortLevel,
          releaseDate,
          feedback: text.trim(),
          previousIdeas: previousIdeasForAPI,
          songEmotion: songEmotionLocal || songEmotionProp || '',
          shootLocation: confirmedLocation || '',
          listeningContext: listeningContextProp || '',
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const newIdeas: ContentIdea[] = (data.ideas || []).map((idea: ContentIdea, idx: number) => ({
        ...idea,
        id: `round${round}_idea_${idx + 1}`, // ensure unique IDs across rounds
      }));

      // Replace content ideas with new batch — liked state for previous ideas is preserved in allLikedIdeas
      setContentIdeas(newIdeas);
      setLikedIdeas(new Set());
      setDislikedIdeas(new Set());
      setIdeaNotes({});
      setNoteOpenForId(null);

      const likedSoFar = allLikedIdeas.length;
      const remaining = Math.max(0, 3 - likedSoFar);
      addBotMessage(
        `Here are 5 fresh ideas. ${likedSoFar > 0 ? `You have ${likedSoFar} locked in — pick ${remaining} more to reach 3 scenes:` : 'Tap 👍 on the ones that fit (aiming for 3):'}`,
        800
      );
      setStep('show_ideas');
    } catch {
      addBotMessage(`Had trouble generating new ideas. Let's move on with what you have.`, 600);
      proceedToPostAssignment(allLikedIdeas.length > 0 ? allLikedIdeas : contentIdeas);
    } finally {
      setLoadingIdeas(false);
    }
  };

  // ── Variations handlers ────────────────────────────────────────────────────────

  const handleVariationsResponse = (text: string) => {
    const lower = text.toLowerCase().trim();
    const noMatch = ['no', 'skip', 'no variations', 'no thanks', 'just the originals', 'nope', 'none'].some(
      p => lower === p || lower.startsWith(p)
    );

    addUserMessage(text.trim());

    if (noMatch) {
      // Skip variations — go straight to summary
      proceedToPostAssignment(ideasForVariationPrompt);
      return;
    }

    // Extract a number from the text (e.g., "3 variations", "2", "yes, 3")
    const numMatch = text.match(/\d+/);
    const count = numMatch ? Math.min(parseInt(numMatch[0], 10), 5) : 2;

    if (count <= 1) {
      proceedToPostAssignment(ideasForVariationPrompt);
      return;
    }

    setVariationsPerPost(count);
    const cards = generateVariationCards(ideasForVariationPrompt, count);
    setVariationCards(cards);
    setStep('show_variations');

    const total = ideasForVariationPrompt.length * count;
    addBotMessage(
      `Here's what I'm thinking — **${total} posts** total (${ideasForVariationPrompt.length} ideas × ${count} variations). ` +
      `All variations can be filmed on the same shoot day. Review them below and edit any titles:`,
      600
    );
  };

  const handleVariationTitleChange = (cardId: string, newTitle: string) => {
    setVariationCards(prev => prev.map(c => c.id === cardId ? { ...c, title: newTitle } : c));
  };

  const handleVariationsConfirmed = () => {
    addUserMessage(`Looks good — let's go with ${variationCards.length} posts`);

    // Build expanded ideas list from confirmed variation cards
    // Inherit all fields from the original idea, then override title/hook/whyItWorks
    const expandedIdeas: ContentIdea[] = variationCards.map(card => {
      const orig = ideasForVariationPrompt[card.originalIdeaIdx];
      return {
        ...orig,
        id: card.id,
        title: card.title,
        hook: card.hook,
        whyItWorks: card.rationale,
        // extra metadata stored as loose fields (not on ContentIdea interface, but benign)
      } as ContentIdea;
    });

    proceedToPostAssignment(expandedIdeas);
  };

  // Map a ContentIdea format string to a ContentFormat for scheduling purposes
  const ideaFormatToContentFormat = (formatStr: string): ContentFormat => {
    const f = formatStr.toLowerCase();
    if (f.includes('music video')) return 'music_video_snippet';
    if (f.includes('bts') || f.includes('behind') || f.includes('performance')) return 'bts_performance';
    return 'custom';
  };

  // Auto-assign liked ideas to scheduled posts and proceed to summary
  const proceedToPostAssignment = (ideas: ContentIdea[]) => {
    // For ideas beyond the scheduled post count, generate additional fallback slots
    // placed 3 days apart after the last scheduled post
    const basePosts = scheduledPosts.length > 0 ? scheduledPosts : generateFallbackPosts(Math.min(ideas.length, 5));
    const extraNeeded = Math.max(0, ideas.length - basePosts.length);

    let lastDate = basePosts.length > 0
      ? new Date(basePosts[basePosts.length - 1].date)
      : new Date();

    const extraPosts = Array.from({ length: extraNeeded }, (_, i) => {
      lastDate = new Date(lastDate.getTime() + 3 * 24 * 60 * 60 * 1000);
      return {
        id: `extra-post-${i}`,
        index: basePosts.length + i,
        title: `Post ${basePosts.length + i + 1}`,
        type: 'promo' as const,
        date: lastDate.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '10:30',
      };
    });

    const allPosts = [...basePosts, ...extraPosts].slice(0, ideas.length);

    const newAssignments: ContentFormatAssignment[] = allPosts.map((post, idx) => {
      const idea = ideas[idx];
      const extIdea = idea as any;

      // Compute trial reel date: day before the post
      const postDateObj = new Date(post.date + 'T12:00:00');
      postDateObj.setDate(postDateObj.getDate() - 1);
      const trialReelDate = postDateObj.toISOString().split('T')[0];

      return {
        postIndex: idx,
        postId: post.id,
        format: ideaFormatToContentFormat((idea as any).format || 'performance'),
        customFormatName: idea.title,
        ideaTitle: idea.title,
        ideaHook: (idea as any).action || idea.title,
        postType: post.type,
        date: post.date,
        // Variation metadata
        variationIndex: extIdea.variationIndex ?? 0,
        variationOf: extIdea.variationOf,
        variationRationale: (idea as any).emotionalAngle,
        // Trial reels (Instagram — day before)
        trialReelDate,
      };
    });

    setAssignments(newAssignments);
    generateSummary(newAssignments, ideas);
  };

  // Generate fallback post slots when none exist yet (evenly spread over next 4 weeks)
  const generateFallbackPosts = (count: number) => {
    const today = new Date();
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(today.getTime() + (7 + i * 3) * 24 * 60 * 60 * 1000);
      return {
        id: `brainstorm-post-${i}`,
        index: i,
        title: `Post ${i + 1}`,
        type: (i === 0 ? 'teaser' : i < count - 1 ? 'promo' : 'audience-builder') as 'teaser' | 'promo' | 'audience-builder',
        date: date.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '10:30',
      };
    });
  };

  // ============================================================================
  // STEP HANDLERS
  // ============================================================================

  const handleFormatSelect = (format: ContentFormat) => {
    setSelectedFormat(format);
    const formatOption = formats.find((f) => f.id === format);
    addUserMessage(`I'll go with ${formatOption?.emoji || '🎬'} ${formatOption?.label || format}`);

    if (format === 'custom') {
      setStep('custom_format_input');
      addBotMessage("Nice, what's your content format idea? Describe it and I'll help set it up.");
      return;
    }

    // If BTS and we don't know about footage, ask
    if (format === 'bts_performance' && !hasFootageForFormat(format, artistProfile)) {
      setStep('footage_check');
      addBotMessage("Do you have any BTS footage to edit from, or would we need to schedule a shoot day?");
      return;
    }

    // Move to post assignment
    showPostAssignment(format);
  };

  const handleCustomFormatSubmit = () => {
    if (!customFormatName.trim()) return;
    addUserMessage(customFormatName.trim());
    setStep('footage_check');
    addBotMessage(
      `"${customFormatName.trim()}" — love it! Do you already have footage for this, or do we need to schedule a shoot day?`
    );
  };

  const handleFootageCheck = (hasFootage: boolean) => {
    addUserMessage(hasFootage ? 'Yes, I have footage for this' : "No, we'll need to shoot");

    if (selectedFormat === 'bts_performance') {
      setHasFootageForBTS(hasFootage);
    } else {
      setHasFootageForCustom(hasFootage);
    }

    showPostAssignment(selectedFormat!);
  };

  const showPostAssignment = (format: ContentFormat) => {
    setStep('post_assignment');
    const formatLabel = format === 'custom'
      ? customFormatName
      : formats.find((f) => f.id === format)?.label || format;

    let msg = `Great choice! Now, which of your **${scheduledPosts.length} scheduled posts** do you want to use **${formatLabel}** for?\n\n`;
    msg += `Select the posts below — you can pick as many as you want:`;

    addBotMessage(msg);
  };

  const handlePostSelection = () => {
    if (selectedPostIndices.length === 0) return;

    const formatLabel = selectedFormat === 'custom'
      ? customFormatName
      : formats.find((f) => f.id === selectedFormat)?.label || selectedFormat;

    addUserMessage(
      `I'll use ${formatLabel} for ${selectedPostIndices.length === scheduledPosts.length ? 'all' : selectedPostIndices.length} post${selectedPostIndices.length > 1 ? 's' : ''}`
    );

    // Build assignments for selected posts
    const newAssignments: ContentFormatAssignment[] = selectedPostIndices.map((idx) => ({
      postIndex: idx,
      postId: scheduledPosts[idx].id,
      format: selectedFormat!,
      customFormatName: selectedFormat === 'custom' ? customFormatName : undefined,
      postType: scheduledPosts[idx].type,
      date: scheduledPosts[idx].date,
    }));

    setAssignments(newAssignments);

    // Check if there are remaining posts
    const remainingIndices = scheduledPosts
      .map((_, i) => i)
      .filter((i) => !selectedPostIndices.includes(i));

    if (remainingIndices.length > 0) {
      setStep('remaining_posts');
      addBotMessage(
        `What about the other **${remainingIndices.length} post${remainingIndices.length > 1 ? 's' : ''}**? Pick a format for ${remainingIndices.length === 1 ? 'it' : 'them'}:`
      );
    } else {
      // All posts assigned — go to summary
      generateSummary(newAssignments);
    }
  };

  const handleSecondFormatSelect = (format: ContentFormat) => {
    setSecondFormat(format);
    const formatOption = formats.find((f) => f.id === format);

    if (format === 'custom') {
      addUserMessage("I have another idea");
      // For simplicity, use a prompt
      const name = prompt("What's the format name?");
      if (name) {
        setSecondCustomFormatName(name);
        applySecondFormat(format, name);
      }
      return;
    }

    addUserMessage(`${formatOption?.emoji || '🎬'} ${formatOption?.label || format}`);

    // If it's a format that needs footage check
    if (format === 'bts_performance' && !hasFootageForFormat(format, artistProfile)) {
      addBotMessage("Do you have BTS footage for this, or do we need a shoot day?");
      setNeedsFootageCheck(true);
      return;
    }

    applySecondFormat(format);
  };

  const handleSecondFootageCheck = (hasFootage: boolean) => {
    addUserMessage(hasFootage ? 'Yes, I have footage' : "No, need to shoot");
    if (secondFormat === 'bts_performance') {
      setHasFootageForBTS(hasFootage);
    }
    setNeedsFootageCheck(false);
    applySecondFormat(secondFormat!);
  };

  const applySecondFormat = (format: ContentFormat, customName?: string) => {
    const remainingIndices = scheduledPosts
      .map((_, i) => i)
      .filter((i) => !selectedPostIndices.includes(i));

    const secondAssignments: ContentFormatAssignment[] = remainingIndices.map((idx) => ({
      postIndex: idx,
      postId: scheduledPosts[idx].id,
      format,
      customFormatName: customName || (format === 'custom' ? secondCustomFormatName : undefined),
      postType: scheduledPosts[idx].type,
      date: scheduledPosts[idx].date,
    }));

    const allAssignments = [...assignments, ...secondAssignments];
    setAssignments(allAssignments);
    generateSummary(allAssignments);
  };

  // ============================================================================
  // SUMMARY & SCHEDULE GENERATION
  // ============================================================================

  const [summaryIdeas, setSummaryIdeas] = useState<ContentIdea[]>([]);

  const generateSummary = (allAssignments: ContentFormatAssignment[], ideas?: ContentIdea[]) => {
    setStep('summary');
    if (ideas) setSummaryIdeas(ideas);

    // Group assignments by format for edit/shoot day calculation
    const byFormat = allAssignments.reduce(
      (acc, a) => {
        const key = a.format === 'custom' ? (a.customFormatName || 'Custom') : a.format;
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
      },
      {} as Record<string, ContentFormatAssignment[]>
    );

    const editDays: BrainstormEditDay[] = [];
    const shootDays: BrainstormShootDay[] = [];

    for (const [, fAssignments] of Object.entries(byFormat)) {
      const format = fAssignments[0].format;
      const needsShoot = !doesFormatHaveFootage(format);

      if (needsShoot) {
        const earliestPostDate = fAssignments.map(a => a.date).sort()[0];
        const shootDate = calculateShootDate(earliestPostDate, preferredDays);
        shootDays.push({
          id: `shoot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          format,
          customFormatName: format === 'custom' ? fAssignments[0].customFormatName : undefined,
          reason: `${getFormatLabel(format, fAssignments[0].customFormatName)} footage needed`,
          duration: 180,
          date: shootDate,
          startTime: '10:00',
          endTime: '13:00',
          sharedWith: [],
        });
      }

      const postsPerEditDay = 2;
      const numEditDays = Math.ceil(fAssignments.length / postsPerEditDay);
      for (let i = 0; i < numEditDays; i++) {
        const coveredPosts = fAssignments.slice(i * postsPerEditDay, (i + 1) * postsPerEditDay);
        const latestPostDate = coveredPosts.map(a => a.date).sort().reverse()[0];
        const shootDay = shootDays.find(s => s.format === format);
        const editDate = needsShoot && shootDay
          ? calculateEditDate(latestPostDate, i, numEditDays, shootDay.date)
          : calculateEditDate(latestPostDate, i, numEditDays);

        editDays.push({
          id: `edit-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          format,
          customFormatName: format === 'custom' ? coveredPosts[0].customFormatName : undefined,
          postsCovered: coveredPosts.map(p => p.postIndex),
          duration: 120,
          date: editDate,
          startTime: '10:00',
          endTime: '12:00',
        });
      }
    }

    // Short bot message — cards do the heavy lifting
    const shootNote = shootDays.length > 0
      ? ` We'll also need a shoot day — I'll ask about that next.`
      : '';
    addBotMessage(
      `Here's your content plan for **${galaxyName}**. ${allAssignments.length} posts scheduled.${shootNote}`,
      600
    );

    setGeneratedEditDays(editDays);
    setGeneratedShootDays(shootDays);
  };

  const [generatedEditDays, setGeneratedEditDays] = useState<BrainstormEditDay[]>([]);
  const [generatedShootDays, setGeneratedShootDays] = useState<BrainstormShootDay[]>([]);

  const [shootDayAction, setShootDayAction] = useState<'plan_now' | 'schedule_task' | 'skip' | null>(null);
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
  const [shootDayDate, setShootDayDate] = useState<string>(tomorrow);

  const handleConfirm = () => {
    addUserMessage("Looks great, let's do it! ✅");
    // Phase 2: always go to inline shoot day planning (E, I)
    enterPhase2();
  };

  const finalizeAndComplete = (action: 'plan_now' | 'schedule_task' | 'skip', chosenShootDate?: string) => {
    setShootDayAction(action);
    setStep('complete');

    // Build trial reel entries from assignments
    const trialReels = assignments
      .filter(a => a.trialReelDate)
      .map((a, idx) => ({
        postIndex: a.postIndex,
        postDate: a.date,
        trialDate: a.trialReelDate!,
        postTitle: a.ideaTitle || `Post ${idx + 1}`,
      }));

    const result: BrainstormResult = {
      id: `brainstorm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      galaxyId,
      galaxyName,
      formatAssignments: assignments,
      editDays: generatedEditDays,
      shootDays: generatedShootDays,
      shootDayAction: action,
      shootDayDate: action === 'plan_now' ? (chosenShootDate || shootDayDate) : undefined,
      trialReels: trialReels.length > 0 ? trialReels : undefined,
      completedAt: new Date().toISOString(),
      status: 'completed',
    };

    const shootMsg = action === 'plan_now'
      ? ` Shoot day scheduled for ${chosenShootDate || shootDayDate} — check your calendar.`
      : action === 'schedule_task'
      ? ' A "Plan shoot day" task has been added to your calendar.'
      : '';

    addBotMessage(
      `Done! 🎉 **${assignments.length} posts** added to your schedule for **${galaxyName}**.${shootMsg}`,
      500
    );

    setTimeout(() => {
      onComplete(result);
    }, 2000);
  };

  // ============================================================================
  // SCHEDULING HELPERS
  // ============================================================================

  const doesFormatHaveFootage = (format: ContentFormat): boolean => {
    if (format === 'bts_performance' && hasFootageForBTS !== null) {
      return hasFootageForBTS;
    }
    if (format === 'custom' && hasFootageForCustom !== null) {
      return hasFootageForCustom;
    }
    return hasFootageForFormat(format, artistProfile);
  };

  // Place shoot day ~1 week before the earliest post, on a preferred day
  const calculateShootDate = (
    earliestPostDate: string,
    prefDays: string[]
  ): string => {
    const postDate = new Date(earliestPostDate);
    const targetDate = new Date(postDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week before

    // Find the nearest preferred day on or before targetDate
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Look within 3 days before and 3 days after the target
    let bestDate = targetDate;
    let bestDistance = Infinity;

    for (let offset = -3; offset <= 3; offset++) {
      const candidate = new Date(targetDate.getTime() + offset * 24 * 60 * 60 * 1000);
      const dayName = dayNames[candidate.getDay()];
      if (prefDays.includes(dayName)) {
        const distance = Math.abs(offset);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestDate = candidate;
        }
      }
    }

    // Make sure shoot day is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bestDate <= today) {
      // Push to the next preferred day after today
      for (let i = 1; i <= 14; i++) {
        const candidate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        const dayName = dayNames[candidate.getDay()];
        if (prefDays.includes(dayName) && candidate < postDate) {
          bestDate = candidate;
          break;
        }
      }
    }

    return bestDate.toISOString().split('T')[0];
  };

  // Place edit day a reasonable time before the post date, after any shoot day
  const calculateEditDate = (
    latestPostDate: string,
    editDayIndex: number,
    totalEditDays: number,
    afterDate?: string // Must be after this date (e.g., shoot day)
  ): string => {
    const postDate = new Date(latestPostDate);
    // Space edit days 2-3 days before the post
    const daysBeforePost = 2 + editDayIndex;
    let editDate = new Date(postDate.getTime() - daysBeforePost * 24 * 60 * 60 * 1000);

    // Ensure it's after the shoot day
    if (afterDate) {
      const shootDate = new Date(afterDate);
      const dayAfterShoot = new Date(shootDate.getTime() + (editDayIndex + 1) * 24 * 60 * 60 * 1000);
      if (editDate <= shootDate) {
        editDate = dayAfterShoot;
      }
    }

    // Ensure it's in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (editDate <= today) {
      editDate = new Date(today.getTime() + (editDayIndex + 1) * 24 * 60 * 60 * 1000);
    }

    return editDate.toISOString().split('T')[0];
  };

  const getFormatLabel = (format: ContentFormat, customName?: string): string => {
    if (format === 'custom') return customName || 'Custom Format';
    const found = formats.find((f) => f.id === format);
    return found?.label || format;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const remainingIndices = scheduledPosts
    .map((_, i) => i)
    .filter((i) => !selectedPostIndices.includes(i));

  // Determine which formats are available for the second selection (exclude already chosen)
  const availableFormatsForSecond = formats.filter(
    (f) => f.id !== selectedFormat || selectedFormat === 'custom'
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95"
        onClick={onClose}
      />

      {/* Main Container */}
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-gray-950 border border-purple-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 to-blue-900/30">
          <div>
            <h2 className="text-lg font-star-wars text-purple-300">
              🧠 Brainstorm Content
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {galaxyName} • {scheduledPosts.length} posts to plan
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none px-2"
          >
            ✕
          </button>
        </div>

        {/* F6: Resume banner — shown if a saved draft exists and session hasn't started yet */}
        {draftLoaded && resumeDraft && step === 'loading_ideas' && messages.length <= 1 && (
          <div className="mx-6 mt-3 rounded-xl border border-purple-500/40 bg-purple-900/20 p-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-purple-300">Resume last session?</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {resumeDraft.confirmedLocation ? `📍 ${resumeDraft.confirmedLocation} · ` : ''}
                {Array.isArray(resumeDraft.allLikedIdeas) && (resumeDraft.allLikedIdeas as unknown[]).length > 0 ? `${(resumeDraft.allLikedIdeas as unknown[]).length} scene${(resumeDraft.allLikedIdeas as unknown[]).length !== 1 ? 's' : ''} locked` : 'location selected'}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  // A1: Restore all draft fields including listeningContextLocal
                  applyDraft(resumeDraft);
                  setResumeDraft(null);
                  const resumeStep = resumeDraft.step as BrainstormStep;
                  setStep(resumeStep);
                  addBotMessage(`Welcome back! Picking up where you left off${resumeDraft.confirmedLocation ? ` at ${resumeDraft.confirmedLocation}` : ''}.`, 300);
                }}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg"
              >
                Resume
              </button>
              <button
                onClick={() => { setResumeDraft(null); clearDraft(); }}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg"
              >
                Start Fresh
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-purple-600/40 border border-purple-500/30 text-purple-100'
                    : 'bg-gray-800/80 border border-gray-700/50 text-gray-200'
                }`}
              >
                {msg.content.split('\n').map((line, i) => {
                  // Basic markdown bold support
                  const parts = line.split(/(\*\*[^*]+\*\*)/g);
                  return (
                    <div key={i} className={line === '' ? 'h-2' : ''}>
                      {parts.map((part, j) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return (
                            <strong key={j} className="font-bold text-white">
                              {part.slice(2, -2)}
                            </strong>
                          );
                        }
                        return <span key={j}>{part}</span>;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Interactive Area */}
        <div className="border-t border-purple-500/20 bg-gray-900/80 px-6 py-4">

          {/* L1: ASK SONG UPLOAD FIRST — before anything else if song not uploaded */}
          {step === 'ask_song_upload_first' && !isTyping && (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                <p className="text-xs text-blue-300">
                  MP3, WAV, or M4A. I'll transcribe the lyrics and use them to suggest scenes where you're lip syncing to specific lines.
                </p>
              </div>
              <label className="block w-full cursor-pointer">
                <div className="w-full rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/20 transition-all p-5 text-center">
                  <p className="text-blue-300 text-sm font-semibold">Click to upload track</p>
                  <p className="text-gray-500 text-xs mt-1">MP3 · WAV · M4A — drag and drop or click</p>
                </div>
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ext = file.name.split('.').pop()?.toLowerCase() || '';
                    if (!['mp3', 'wav', 'm4a'].includes(ext)) {
                      addBotMessage(`Please upload an MP3, WAV, or M4A file.`, 300);
                      return;
                    }
                    const fileSizeMBRaw = file.size / (1024 * 1024);
                    const needsConvert = ext !== 'mp3';
                    addUserMessage(needsConvert
                      ? `Converting ${file.name} (${fileSizeMBRaw.toFixed(0)} MB) to MP3…`
                      : `Uploading ${file.name} (${fileSizeMBRaw.toFixed(1)} MB)…`);

                    let mp3File: File;
                    try {
                      const { convertToMp3 } = await import('@/lib/audio-convert');
                      mp3File = await convertToMp3(file);
                    } catch (convErr) {
                      console.warn('[L1] Audio conversion failed, falling back to lyrics paste:', convErr);
                      setStep('confirm_lyrics');
                      setLyricsEditValue('');
                      addBotMessage(
                        `Couldn't convert your file automatically — no problem. Paste your lyrics below and I'll use those instead. You can upload an MP3 from World Settings later.`,
                        500
                      );
                      return;
                    }

                    try {
                      const { supabase: sb } = await import('@/lib/supabase');
                      const filePath = `galaxies/${galaxyId}/track.mp3`;
                      const { error: uploadErr } = await sb.storage
                        .from('uploads')
                        .upload(filePath, mp3File, { upsert: true, contentType: 'audio/mpeg' });
                      if (uploadErr) throw uploadErr;
                      const { data: urlData } = sb.storage.from('uploads').getPublicUrl(filePath);
                      const trackUrl = urlData.publicUrl;
                      setUploadedTrackUrl(trackUrl);
                      const { data: galD } = await sb.from('galaxies').select('brainstorm_draft').eq('id', galaxyId).single();
                      const existingD = (galD?.brainstorm_draft as Record<string, unknown>) || {};
                      await sb.from('galaxies').update({ brainstorm_draft: { ...existingD, track_url: trackUrl } }).eq('id', galaxyId);
                      const mp3MB = mp3File.size / (1024 * 1024);
                      if (needsConvert) addBotMessage(`Converted to MP3 (${mp3MB.toFixed(1)} MB) ✓`, 200);
                      await transcribeAndContinue(trackUrl);
                    } catch (err: any) {
                      console.error('[L1] Track upload error:', err);
                      setStep('confirm_lyrics');
                      setLyricsEditValue('');
                      addBotMessage(`Upload failed — no problem. Paste your lyrics below and I'll work from those.`, 400);
                    }
                  }}
                />
              </label>
              <button
                onClick={() => {
                  addUserMessage("Skip — I'll paste lyrics manually");
                  setStep('confirm_lyrics');
                  setLyricsEditValue('');
                  addBotMessage(`No problem — paste your lyrics below. I'll use them to suggest scenes where you're lip syncing to specific lines.`, 400);
                }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 py-2 transition-colors"
              >
                Skip — I&apos;ll paste them manually
              </button>
            </div>
          )}

          {/* L2: TRANSCRIBING — loading state */}
          {step === 'transcribing_lyrics' && (
            <div className="flex items-center gap-3 px-2 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-gray-400">Pulling lyrics from your track...</p>
            </div>
          )}

          {/* L3: CONFIRM LYRICS — show/edit transcribed lyrics */}
          {step === 'confirm_lyrics' && !isTyping && (
            <div className="space-y-3">
              <textarea
                value={lyricsEditValue}
                onChange={(e) => setLyricsEditValue(e.target.value)}
                placeholder="Paste your lyrics here..."
                rows={8}
                className="w-full bg-gray-800/70 border border-gray-600/60 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleLyricsConfirmed(lyricsEditValue)}
                  disabled={!lyricsEditValue.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
                >
                  Confirm lyrics →
                </Button>
                <button
                  onClick={() => handleLyricsConfirmed('')}
                  className="px-4 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* F2: ASK LISTENING CONTEXT (D+) — if missing for returning user */}
          {step === 'ask_listening_context' && !isTyping && (
            <div className="space-y-2">
              <div className="relative flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && userInput.trim()) { handleListeningContextSubmit(userInput.trim()); setUserInput(''); } }}
                  placeholder="e.g. late-night drive, gym, bedroom, party..."
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <Button
                  onClick={() => { if (userInput.trim()) { handleListeningContextSubmit(userInput.trim()); setUserInput(''); } }}
                  disabled={!userInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                >
                  Set Context
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['late-night drive', 'gym / workout', 'bedroom', 'party', 'nature walk', 'study / focus', 'coffee shop', 'commute'].map(ctx => (
                  <button
                    key={ctx}
                    onClick={() => { handleListeningContextSubmit(ctx); setUserInput(''); }}
                    className="px-2.5 py-1 text-[11px] rounded-full border border-gray-700 text-gray-400 hover:border-purple-500 hover:text-purple-300 transition-all"
                  >
                    {ctx}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ASK EMOTION — first snapshot starter for this song (G, A) */}
          {step === 'ask_emotion' && !isTyping && (
            <div className="space-y-2">
              {/* L4: Auto-suggested emotion from lyrics */}
              {suggestedEmotion && (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-2">
                  <p className="text-xs text-yellow-300 font-medium">From your lyrics, this sounds like:</p>
                  <button
                    onClick={() => { handleEmotionSubmit(suggestedEmotion); setUserInput(''); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 transition-all text-left"
                  >
                    <span className="text-white font-semibold">{suggestedEmotion}</span>
                    <span className="text-yellow-400 text-xs">Use this →</span>
                  </button>
                  {suggestedEmotionRationale && (
                    <p className="text-[11px] text-gray-400 italic">{suggestedEmotionRationale}</p>
                  )}
                </div>
              )}
              <div className="relative flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && userInput.trim()) { handleEmotionSubmit(userInput.trim()); setUserInput(''); } }}
                  placeholder="e.g. heartbreak, confidence, nostalgia, rage..."
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <Button
                  onClick={() => { if (userInput.trim()) { handleEmotionSubmit(userInput.trim()); setUserInput(''); } }}
                  disabled={!userInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                >
                  Set Filter
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['heartbreak', 'confidence', 'nostalgia', 'rage', 'longing', 'euphoria', 'melancholy', 'hope'].map(e => (
                  <button
                    key={e}
                    onClick={() => { handleEmotionSubmit(e); setUserInput(''); }}
                    className="px-2.5 py-1 text-[11px] rounded-full border border-gray-700 text-gray-400 hover:border-purple-500 hover:text-purple-300 transition-all"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* F3: ASK TRAVEL TIME — before location area */}
          {step === 'ask_travel_time' && !isTyping && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {['10 minutes', '20 minutes', '30 minutes', '45 minutes', '1 hour', '1.5 hours'].map(t => (
                  <button
                    key={t}
                    onClick={() => { handleTravelTimeSubmit(t); }}
                    className="px-3 py-1.5 text-sm rounded-xl border border-gray-700 bg-gray-800/40 hover:border-purple-500/60 hover:bg-purple-500/10 text-gray-300 transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && userInput.trim()) { handleTravelTimeSubmit(userInput.trim()); setUserInput(''); } }}
                  placeholder="Or type custom amount..."
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <Button
                  onClick={() => { if (userInput.trim()) { handleTravelTimeSubmit(userInput.trim()); setUserInput(''); } }}
                  disabled={!userInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                >
                  Set
                </Button>
              </div>
            </div>
          )}

          {/* F8: ASK SHOOT DATE EARLY — before locations so weather informs everything */}
          {step === 'ask_shoot_date_early' && !isTyping && (
            <div className="space-y-2">
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                defaultValue={recommendedShootDate}
                onChange={e => setShootDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
              />
              <Button
                onClick={() => { if (shootDate) handleShootDateEarlySubmit(shootDate); }}
                disabled={!shootDate}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
              >
                Check Weather & Find Locations →
              </Button>
              <button
                onClick={() => { setStep('ask_location_area'); addBotMessage(`What's your zip code? I'll use that to find spots close to you.`, 300); }}
                className="w-full text-xs text-gray-500 hover:text-gray-400 py-1"
              >
                Skip — I'll decide the date later
              </button>
            </div>
          )}

          {/* ASK LOCATION AREA (F) */}
          {step === 'ask_location_area' && !isTyping && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && userInput.trim()) { handleLocationAreaSubmit(userInput.trim()); setUserInput(''); } }}
                placeholder="Zip code (e.g. 90019)"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <Button
                onClick={() => { if (userInput.trim()) { handleLocationAreaSubmit(userInput.trim()); setUserInput(''); } }}
                disabled={!userInput.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
              >
                Find Spots
              </Button>
            </div>
          )}

          {/* LOADING LOCATIONS */}
          {step === 'loading_locations' && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Finding real locations near you...
            </div>
          )}

          {/* SHOW LOCATIONS (F) */}
          {step === 'show_locations' && !isTyping && locationOptions.length > 0 && (
            <div className="space-y-2">
              {/* F8: Weather banner */}
              {weatherSummary && (
                <div className={`rounded-xl px-3 py-2 text-xs ${weatherIsBad ? 'bg-red-900/20 border border-red-700/40 text-red-300' : 'bg-blue-900/20 border border-blue-700/30 text-blue-200'}`}>
                  <span className="font-medium">{weatherIsBad ? '⚠️ ' : '🌤 '}</span>
                  {weatherSummary}{weatherFilmNote ? ` — ${weatherFilmNote}` : ''}
                </div>
              )}
              {locationOptions.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => handleLocationConfirm(loc.name, loc.mapsUrl)}
                  className="w-full text-left p-3 rounded-xl border border-gray-700 bg-gray-800/40 hover:border-purple-500/60 hover:bg-purple-500/10 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{loc.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{loc.address}</p>
                      <p className="text-[11px] text-purple-300 mt-0.5 italic">{loc.whyItFits}</p>
                    </div>
                    <a
                      href={loc.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-blue-400 hover:text-blue-300 underline flex-shrink-0 mt-0.5"
                    >
                      Maps ↗
                    </a>
                  </div>
                </button>
              ))}
              {/* Conversational input — default is to fetch new locations; only confirm as custom if it looks like a place name */}
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && userInput.trim()) {
                      handleLocationTextInput(userInput.trim());
                    }
                  }}
                  placeholder="Tell me what you're looking for — I'll find better spots..."
                  className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
                <button
                  onClick={() => setLocationMicActive(v => !v)}
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${locationMicActive ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                  title="Speak your response"
                >
                  🎤
                </button>
                <Button
                  size="sm"
                  onClick={() => { if (userInput.trim()) handleLocationTextInput(userInput.trim()); }}
                  disabled={!userInput.trim()}
                  className="bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
                >
                  →
                </Button>
              </div>
              {locationMicActive && (
                <div className="mt-2">
                  <VoiceInput
                    onTranscript={(text) => {
                      setLocationMicActive(false);
                      handleLocationTextInput(text.trim());
                    }}
                    autoSubmit={true}
                    autoStartAfterDisabled={false}
                    placeholder="Speak your response..."
                  />
                </div>
              )}
            </div>
          )}

          {/* F5: ASK SONG UPLOAD — prompt before soundbytes if no song */}
          {step === 'ask_song_upload' && !isTyping && (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                  <p className="text-xs text-blue-300">
                  Upload your track — MP3, WAV, M4A, or AIFF all work. Large files are auto-converted to MP3 before uploading.
                </p>
              </div>
              {/* F5: Inline MP3 upload */}
              <label className="block w-full cursor-pointer">
                <div className="w-full rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/20 transition-all p-4 text-center">
                  <p className="text-blue-300 text-sm font-medium">Click to upload MP3</p>
                  <p className="text-gray-500 text-xs mt-0.5">or drag and drop</p>
                </div>
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ext = file.name.split('.').pop()?.toLowerCase() || '';
                    if (!['mp3', 'wav', 'm4a'].includes(ext)) {
                      addBotMessage(`Please upload an MP3, WAV, or M4A file.`, 300);
                      return;
                    }
                    const fileSizeMBRaw = file.size / (1024 * 1024);
                    const needsConvert = (file.name.split('.').pop()?.toLowerCase() || '') !== 'mp3';
                    if (!needsConvert && fileSizeMBRaw > UPLOAD_MAX_MB) {
                      addBotMessage(`${UPLOAD_SIZE_MSG} (your file is ${fileSizeMBRaw.toFixed(0)} MB)`, 300);
                      return;
                    }
                    addUserMessage(needsConvert
                      ? `Converting ${file.name} (${fileSizeMBRaw.toFixed(0)} MB) to MP3…`
                      : `Uploading ${file.name} (${fileSizeMBRaw.toFixed(1)} MB)…`);
                    try {
                      const { convertToMp3 } = await import('@/lib/audio-convert');
                      const mp3File = await convertToMp3(file);
                      const { supabase } = await import('@/lib/supabase');
                      const filePath = `galaxies/${galaxyId}/track.mp3`;
                      const { error: uploadErr } = await supabase.storage
                        .from('uploads')
                        .upload(filePath, mp3File, { upsert: true, contentType: 'audio/mpeg' });
                      if (uploadErr) throw uploadErr;
                      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filePath);
                      const { data: galF5 } = await supabase.from('galaxies').select('brainstorm_draft').eq('id', galaxyId).single();
                      const existingF5 = (galF5?.brainstorm_draft as Record<string, unknown>) || {};
                      await supabase.from('galaxies').update({ brainstorm_draft: { ...existingF5, track_url: urlData.publicUrl } }).eq('id', galaxyId);
                      const mp3MB = mp3File.size / (1024 * 1024);
                      addBotMessage(`Track uploaded! 🎵 ${needsConvert ? `Converted to MP3 (${mp3MB.toFixed(1)} MB). ` : ''}Play buttons are now active.`, 400);
                      setStep('ask_soundbytes');
                    } catch (err: any) {
                      console.error('[F5] Track upload error:', err);
                      addBotMessage(`Upload failed — let's select soundbytes by name instead. You can upload the track from World Settings later.`, 400);
                      setStep('ask_soundbytes');
                    }
                  }}
                />
              </label>
              <Button
                onClick={() => {
                  addUserMessage('Skip — show soundbytes');
                  setStep('ask_soundbytes');
                  addBotMessage(`Here are 5 soundbyte options. Tap ❌ on any you want to swap out — I'll replace them.`, 400);
                }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
              >
                Skip for Now
              </Button>
            </div>
          )}

          {/* F5: SOUNDBYTE SELECTION — waveform timeline editor */}
          {step === 'ask_soundbytes' && !isTyping && (
            <div>
              {/* Pre-saved soundbytes from a previous session — show locked-in view */}
              {confirmedSoundbytes.length > 0 && !uploadedTrackUrl ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {confirmedSoundbytes.map((sb, i) => (
                      <div key={sb.id} className="flex items-center justify-between rounded-xl bg-gray-800/60 border border-gray-700/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-400">{i + 1}</span>
                          <span className="text-sm text-white font-medium">{sb.section}</span>
                        </div>
                        <span className="text-xs text-gray-400">{sb.timeRange} · {sb.duration}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      addUserMessage('Keep these soundbytes');
                      enterPhase2();
                    }}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
                  >
                    Keep these soundbytes →
                  </button>
                  <button
                    onClick={() => {
                      setConfirmedSoundbytes([]);
                      addUserMessage('Start fresh — re-pick soundbytes');
                      addBotMessage('No problem — upload your track and we\'ll re-select your soundbytes.', 300);
                    }}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Start fresh
                  </button>
                </div>
              ) : uploadedTrackUrl ? (
                <SoundbytePicker
                  trackUrl={uploadedTrackUrl}
                  lyricsSegments={lyricsSegments}
                  onConfirm={handleSoundbytePickerConfirm}
                />
              ) : (
                /* No track uploaded yet — prompt upload then show picker */
                <div className="space-y-3">
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                    <p className="text-xs text-blue-300">Upload your track — MP3, WAV, M4A, or AIFF. Any format is auto-converted to MP3 before storing.</p>
                  </div>
                  <label className="block w-full cursor-pointer">
                    <div className="w-full rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/20 transition-all p-5 text-center">
                      <p className="text-blue-300 text-sm font-semibold">Click to upload track</p>
                      <p className="text-gray-500 text-xs mt-1">MP3 · WAV · M4A</p>
                    </div>
                    <input
                      type="file"
                      accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fileSizeMBRaw = file.size / (1024 * 1024);
                        const needsConvert = (file.name.split('.').pop()?.toLowerCase() || '') !== 'mp3';
                        addUserMessage(needsConvert
                          ? `Converting ${file.name} (${fileSizeMBRaw.toFixed(0)} MB) to MP3…`
                          : `Uploading ${file.name} (${fileSizeMBRaw.toFixed(1)} MB)…`);
                        try {
                          const { convertToMp3 } = await import('@/lib/audio-convert');
                          const mp3File = await convertToMp3(file);
                          const { supabase } = await import('@/lib/supabase');
                          const filePath = `galaxies/${galaxyId}/track.mp3`;
                          const { error: uploadErr } = await supabase.storage.from('uploads').upload(filePath, mp3File, { upsert: true, contentType: 'audio/mpeg' });
                          if (uploadErr) throw uploadErr;
                          const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filePath);
                          const { data: galSb } = await supabase.from('galaxies').select('brainstorm_draft').eq('id', galaxyId).single();
                          const existingSb = (galSb?.brainstorm_draft as Record<string, unknown>) || {};
                          await supabase.from('galaxies').update({ brainstorm_draft: { ...existingSb, track_url: urlData.publicUrl } }).eq('id', galaxyId);
                          setUploadedTrackUrl(urlData.publicUrl);
                        } catch (err: unknown) {
                          console.error('[ask_soundbytes] upload error:', err);
                          addBotMessage('Conversion or upload failed — try again or continue without a track.', 300);
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={() => handleSoundbytePickerConfirm([
                      { id: 'sb1', label: 'Chorus', startSec: 35, endSec: 55 },
                      { id: 'sb2', label: 'Verse 1', startSec: 10, endSec: 35 },
                      { id: 'sb3', label: 'Intro', startSec: 0, endSec: 15 },
                      { id: 'sb4', label: 'Bridge', startSec: 65, endSec: 85 },
                      { id: 'sb5', label: 'Outro', startSec: 145, endSec: 180 },
                    ])}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Continue with default soundbytes (no upload)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PHASE 2: SHOOT DATE (F10 — recommended date + mini calendar fallback) */}
          {step === 'shoot_day_date_v2' && !isTyping && (
            <div className="space-y-3">
              {/* Recommended date — big lock-in button */}
              {recommendedShootDate && (
                <div className="grid grid-cols-2 gap-2">
                  {/* Morning / Afternoon / Evening inline */}
                  {['🌅 Morning', '☀️ Afternoon', '🌇 Evening'].map((label, i) => {
                    const vals = ['morning', 'afternoon', 'evening'];
                    return (
                      <button
                        key={i}
                        onClick={() => handleShootDateV2(recommendedShootDate, vals[i])}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                          i === 0 ? 'col-span-2 border-purple-500 bg-purple-600/30 hover:bg-purple-600/50 text-white' :
                          'border-gray-700 bg-gray-800/40 hover:border-purple-500/60 hover:bg-purple-500/10 text-gray-300'
                        }`}
                      >
                        {i === 0 ? `Lock in ${new Date(recommendedShootDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} — ` : ''}{label}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* "Pick another day" — compact inline calendar */}
              <details className="group">
                <summary className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer transition-colors">
                  Pick another day ↓
                </summary>
                <div className="mt-2 flex gap-2">
                  <input
                    type="date"
                    value={shootDate}
                    onChange={e => setShootDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                    style={{ colorScheme: 'dark' }}
                  />
                  <Button
                    onClick={() => { if (shootDate) handleShootDateV2(shootDate); }}
                    disabled={!shootDate}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                  >
                    Select
                  </Button>
                </div>
              </details>
            </div>
          )}

          {/* PHASE 2: TIME OF DAY */}
          {step === 'shoot_day_time' && !isTyping && (
            <div className="flex gap-2">
              {[['🌅 Morning', 'morning'], ['☀️ Afternoon', 'afternoon'], ['🌇 Evening', 'evening']].map(([label, val]) => (
                <button
                  key={val}
                  onClick={() => handleShootTimeSelect(val)}
                  className="flex-1 py-2 rounded-xl border border-gray-700 bg-gray-800/40 hover:border-purple-500/60 hover:bg-purple-500/10 transition-all text-sm text-gray-300"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* PHASE 2: CREW (F13 — real team member names) */}
          {step === 'shoot_day_crew' && !isTyping && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2">
                {/* Just me */}
                <button
                  onClick={() => handleShootCrewSelect('Just me')}
                  className="py-2.5 rounded-xl border border-gray-700 bg-gray-800/40 hover:border-orange-500/60 hover:bg-orange-500/10 transition-all text-sm text-gray-300 text-left px-4"
                >
                  🎤 Just me
                </button>
                {/* Team member combos (F13) */}
                {teamMembers && teamMembers.length > 0 ? (
                  teamMembers.slice(0, 3).map(member => (
                    <button
                      key={member.id}
                      onClick={() => handleShootCrewSelect(`Me + ${member.name}`)}
                      className="py-2.5 rounded-xl border border-purple-500/40 bg-purple-600/20 hover:bg-purple-600/40 transition-all text-sm text-white text-left px-4"
                    >
                      🎬 Me + {member.name}{member.role ? ` (${member.role})` : ''}
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => handleShootCrewSelect('Me + someone else')}
                    className="py-2.5 rounded-xl border border-purple-500/40 bg-purple-600/20 hover:bg-purple-600/40 transition-all text-sm text-white text-left px-4"
                  >
                    🎬 Me + someone else
                  </button>
                )}
                {/* Invite option if no team members */}
                {(!teamMembers || teamMembers.length === 0) && (
                  <button
                    onClick={() => {
                      addUserMessage('Invite a team member');
                      addBotMessage(`Sounds good — you can invite team members from the galaxy view. After you invite someone, they'll be added here automatically. Continuing solo for now.`, 400);
                      setTimeout(() => {
                        setShootCrew('Just me');
                        setStep('generating_output');
                        addBotMessage(`Building your shoot day and schedule...`, 400);
                        setTimeout(() => buildAndComplete(), 800);
                      }, 1200);
                    }}
                    className="py-2 rounded-xl border border-dashed border-gray-600 bg-gray-800/20 hover:bg-gray-700/40 transition-all text-xs text-gray-500 text-center"
                  >
                    + Invite team members
                  </button>
                )}
              </div>
              {/* Continue solo after nudge */}
              {shootCrew === 'Just me' && (
                <button
                  onClick={() => {
                    setStep('generating_output');
                    addBotMessage(`Building your shoot day and schedule...`, 400);
                    setTimeout(() => buildAndComplete(), 800);
                  }}
                  className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Continue solo →
                </button>
              )}
            </div>
          )}

          {/* GENERATING OUTPUT */}
          {step === 'generating_output' && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Building your shoot day, edit days, and post schedule...
            </div>
          )}

          {/* ASK USER IDEA — user pitches their own concept */}
          {step === 'ask_user_idea' && !isTyping && (
            <div className="space-y-2">
              <VoiceInput
                onTranscript={(text) => handleUserIdeaSubmit(text)}
                autoSubmit={true}
                autoStartAfterDisabled={false}
                placeholder="Tap the mic or type your idea..."
              />
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && userInput.trim()) {
                      handleUserIdeaSubmit(userInput.trim());
                      setUserInput('');
                    }
                  }}
                  placeholder="Or type your idea here..."
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60"
                />
                {userInput.trim() && (
                  <button
                    onClick={() => { handleUserIdeaSubmit(userInput.trim()); setUserInput(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                  >
                    Send →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* EVALUATING IDEA — loading state */}
          {step === 'evaluating_idea' && (
            <div className="flex items-center gap-3 py-2 text-gray-400 text-sm">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <span>Mark is reading your idea and checking the data...</span>
            </div>
          )}

          {/* SHOW EVALUATION — Mark's feedback on the user's idea, then proceed to variations */}
          {step === 'show_evaluation' && !isTyping && contentIdeas.length > 0 && (
            <div className="space-y-3">
              {/* Show the refined idea card */}
              {contentIdeas.map((idea) => (
                <div key={idea.id} className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-600/10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{idea.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${DIFFICULTY_COLOR[idea.difficulty]}`}>
                      {idea.difficulty}
                    </span>
                  </div>
                  {(idea as any).setting && <p className="text-xs text-gray-300"><span className="text-gray-500 text-[10px] uppercase">Where </span>{(idea as any).setting}</p>}
                  {(idea as any).action && <p className="text-xs text-purple-300 italic">{(idea as any).action}</p>}
                  {(idea as any).emotionalAngle && <p className="text-xs text-gray-400">{(idea as any).emotionalAngle}</p>}
                  {(idea as any).timeOfDay && <p className="text-[10px] text-gray-500">🕐 {(idea as any).timeOfDay}</p>}
                </div>
              ))}
              <button
                onClick={() => {
                  setIdeasForVariationPrompt(contentIdeas);
                  setStep('ask_variations');
                  addBotMessage(
                    `Do you want variations of this? Shooting multiple versions on the same day is a great way to multiply your output. For example, say **"3 variations"** and I'll plan 3 posts total — all filmable in one session. Or say **"no"** to keep it as one post.`,
                    400
                  );
                }}
                className="w-full py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-sm font-medium transition-all"
              >
                This looks good — what about variations? →
              </button>
              <button
                onClick={() => {
                  setIdeasForVariationPrompt(contentIdeas);
                  proceedToPostAssignment(contentIdeas);
                }}
                className="w-full py-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                No variations — schedule it →
              </button>
            </div>
          )}

          {/* ASK SONG STORY — voice input + skip shortcut */}
          {step === 'ask_song_story' && !isTyping && (
            <div className="space-y-2">
              <VoiceInput
                onTranscript={(text) => { setSongStory(text); handleSongStorySubmitWithText(text); }}
                autoSubmit={true}
                autoStartAfterDisabled={false}
                placeholder="Tap the mic to answer..."
              />
              <button
                onClick={() => {
                  setSongStory('not provided');
                  setArtistVibe('not provided');
                  setStep('loading_ideas');
                  addBotMessage(`Pulling real TikTok data from similar artists and generating your ideas... 🔍`, 300);
                  fetchIdeas('not provided', 'not provided', '');
                }}
                className="w-full text-[11px] text-gray-600 hover:text-gray-400 py-1 transition-colors"
              >
                Already know your vibe? Skip the questions →
              </button>
            </div>
          )}

          {/* ASK VIBE — voice input */}
          {step === 'ask_vibe' && !isTyping && (
            <VoiceInput
              onTranscript={(text) => { setArtistVibe(text); handleVibeSubmitWithText(text); }}
              autoSubmit={true}
              autoStartAfterDisabled={false}
              placeholder="Tap the mic to answer..."
            />
          )}


          {/* LOADING IDEAS */}
          {step === 'loading_ideas' && (
            <div className="flex items-center gap-3 py-2 text-gray-400 text-sm">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <span>Analyzing TikTok trends for your genre...</span>
            </div>
          )}

          {/* SHOW IDEAS — cards with thumbs up/down, inline notes, progress gate */}
          {step === 'show_ideas' && !isTyping && contentIdeas.length > 0 && (() => {
            const totalLocked = allLikedIdeas.length + likedIdeas.size;
            const allRated = contentIdeas.every(i => likedIdeas.has(i.id) || dislikedIdeas.has(i.id));
            // F4: can confirm as soon as 3 scenes are liked (don't need to rate all 5)
            const canProceed = totalLocked >= 3;

            return (
              <div className="space-y-3">
                {/* Progress indicator */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${i < totalLocked ? 'bg-green-400' : 'bg-gray-600'}`}
                      />
                    ))}
                    <span className="text-xs text-gray-400 ml-1">{totalLocked}/3 scenes locked</span>
                  </div>
                  {!canProceed && (
                    <span className="text-[10px] text-gray-500">
                      {allRated ? 'Like more scenes or get new ideas' : `Rate all 5 or lock 3 to continue`}
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {/* F11: Solo mode — sort easy/phone-only first */}
                  {[...contentIdeas].sort((a, b) => {
                    if (shootCrew === 'solo') {
                      const aNeeds = (a as any).needsCameraOperator ? 1 : 0;
                      const bNeeds = (b as any).needsCameraOperator ? 1 : 0;
                      if (aNeeds !== bNeeds) return aNeeds - bNeeds;
                    }
                    return 0;
                  }).map(idea => {
                    const liked    = likedIdeas.has(idea.id);
                    const disliked = dislikedIdeas.has(idea.id);
                    const noteOpen = noteOpenForId === idea.id;
                    const hasNote  = !!ideaNotes[idea.id];
                    return (
                      <div
                        key={idea.id}
                        className={`rounded-xl border transition-all ${
                          liked    ? 'border-green-500/60 bg-green-500/10' :
                          disliked ? 'border-red-900/40 bg-red-900/10' :
                                     'border-gray-700 bg-gray-800/50'
                        }`}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* Scene title + difficulty */}
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-white font-semibold text-sm">{idea.title}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${DIFFICULTY_COLOR[idea.difficulty]}`}>
                                  {(idea as any).practicalRequirements || idea.difficulty}
                                </span>
                                {shootCrew === 'solo' && (idea as any).needsCameraOperator && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-yellow-600/60 bg-yellow-900/20 text-yellow-400">
                                    ⚠️ needs camera operator
                                  </span>
                                )}
                              </div>
                              {/* Setting — where exactly */}
                              <p className="text-xs text-gray-300 mb-1.5 leading-snug">
                                <span className="text-gray-500 text-[10px] uppercase tracking-wide">Where </span>
                                {(idea as any).setting}
                              </p>
                              {/* Action — what artist is doing */}
                              <p className="text-xs text-purple-300 mb-1.5 leading-snug">
                                <span className="text-gray-500 text-[10px] uppercase tracking-wide">What </span>
                                {(idea as any).action}
                              </p>
                              {/* Emotional angle */}
                              <p className="text-xs text-yellow-200/70 mb-1.5 leading-snug italic">
                                {(idea as any).emotionalAngle}
                              </p>
                              {/* First 3 seconds (F9 — Stafford method) */}
                              {(idea as any).firstFrame && (
                                <div className="flex items-start gap-1 mb-1.5 bg-gray-900/40 rounded-lg px-2 py-1.5">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wide flex-shrink-0 mt-0.5">▶ 0:00</span>
                                  <p className="text-[11px] text-gray-400 leading-snug">{(idea as any).firstFrame}</p>
                                </div>
                              )}
                             {/* Time of day + location pin */}
                             <div className="flex items-center gap-3 mt-1">
                               <span className="text-[10px] text-gray-500">
                                 🕐 {(idea as any).timeOfDay || 'Flexible timing'}
                               </span>
                               {confirmedLocation && (
                                 <span className="text-[10px] text-gray-600">
                                   📍 {confirmedLocation}
                                 </span>
                               )}
                             </div>

                             {/* Reference links (Tavily) */}
                             {isLoadingReferences && !sceneReferences[idea.id] ? (
                               <p className="text-[10px] text-gray-600 mt-1.5 animate-pulse">finding references...</p>
                             ) : sceneReferences[idea.id]?.length > 0 ? (
                               <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                 <span className="text-[10px] text-gray-500 uppercase tracking-wide flex-shrink-0">Refs</span>
                                 {sceneReferences[idea.id].map((url, ri) => (
                                   <a
                                     key={ri}
                                     href={url}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     onClick={e => e.stopPropagation()}
                                     className="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center gap-0.5"
                                   >
                                     {url.includes('instagram') ? '📸' : '🎵'} {ri + 1}
                                   </a>
                                 ))}
                               </div>
                             ) : null}
                            </div>
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <button
                                onClick={() => toggleLike(idea.id)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${liked ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-green-500/30 text-gray-400'}`}
                                title="I like this scene"
                              >
                                👍
                              </button>
                              <button
                                onClick={() => toggleDislike(idea.id)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${disliked ? 'bg-red-500/60 text-white' : 'bg-gray-700 hover:bg-red-500/20 text-gray-400'}`}
                                title="Not for me"
                              >
                                👎
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Inline notes field — opens on dislike (B1 fix: also trigger on disliked state directly) */}
                        {(noteOpen || hasNote || disliked) && (
                          <div className="border-t border-gray-700/50 px-3 pb-3 pt-2">
                            <p className="text-[10px] text-gray-500 mb-1.5">
                              {disliked ? 'What didn\'t work? (optional — helps improve future ideas)' : 'Add a note (optional)'}
                            </p>
                            <div className="flex gap-2 items-start">
                              <textarea
                                value={ideaNotes[idea.id] || ''}
                                onChange={e => setIdeaNotes(prev => ({ ...prev, [idea.id]: e.target.value }))}
                                placeholder="Too complex, wrong vibe, doesn't fit location..."
                                rows={2}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500"
                              />
                              <button
                                onClick={() => setNoteMicActiveId(noteMicActiveId === idea.id ? null : idea.id)}
                                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${noteMicActiveId === idea.id ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                title="Speak your note"
                              >
                                🎤
                              </button>
                            </div>
                            {noteMicActiveId === idea.id && (
                              <div className="mt-2">
                                <VoiceInput
                                  onTranscript={(text) => {
                                    setIdeaNotes(prev => ({ ...prev, [idea.id]: (prev[idea.id] ? prev[idea.id] + ' ' : '') + text }));
                                    setNoteMicActiveId(null);
                                  }}
                                  autoSubmit={true}
                                  autoStartAfterDisabled={false}
                                  placeholder="Speak your note..."
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Show "add note" link for unrated or liked ideas without note field open */}
                        {!noteOpen && !hasNote && (liked || disliked) && (
                          <button
                            onClick={() => setNoteOpenForId(idea.id)}
                            className="w-full text-[10px] text-gray-600 hover:text-gray-400 pb-2 transition-colors"
                          >
                            + add note
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* F2: 6th card — pitch your own scene idea */}
                  <div className="rounded-xl border border-dashed border-gray-600 bg-gray-800/20 p-3 mt-1">
                    <p className="text-xs text-gray-500 mb-2">
                      Have your own idea{confirmedLocation ? ` for ${confirmedLocation}` : ''}? Pitch it and I'll work it in.
                    </p>
                    <div className="flex gap-2 items-start">
                      <textarea
                        value={pitchInput}
                        onChange={e => setPitchInput(e.target.value)}
                        placeholder="e.g. Walking through the grove at golden hour with dramatic shadows..."
                        rows={2}
                        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => setPitchMicActive(v => !v)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${pitchMicActive ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                          title="Speak your idea"
                        >
                          🎤
                        </button>
                        <button
                          onClick={async () => {
                            if (!pitchInput.trim() || pitchSubmitting) return;
                            setPitchSubmitting(true);
                            setUserPitchedScene(pitchInput.trim());
                            try {
                              const genres: string[] = (artistProfile as any)?.genre || ['indie'];
                              const res = await fetch('/api/tiktok-insights', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  genres,
                                  songName: galaxyName,
                                  artistVibe: (artistProfile as any)?.visualAesthetic || '',
                                  releaseDate,
                                  userIdea: pitchInput.trim(),
                                  songEmotion: songEmotionLocal || songEmotionProp || '',
                                  shootLocation: confirmedLocation,
                                }),
                              });
                              const data = await res.json();
                              if (data.idea) {
                                const pitched: ContentIdea = { ...data.idea, id: `pitched-${Date.now()}` };
                                setContentIdeas(prev => [...prev, pitched]);
                                setPitchInput('');
                                if (data.markFeedback) addBotMessage(data.markFeedback, 300);
                              }
                            } catch { /* silent */ } finally {
                              setPitchSubmitting(false);
                            }
                          }}
                          disabled={!pitchInput.trim() || pitchSubmitting}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-bold"
                          title="Submit your idea"
                        >
                          {pitchSubmitting ? '…' : '→'}
                        </button>
                      </div>
                    </div>
                    {pitchMicActive && (
                      <div className="mt-2">
                        <VoiceInput
                          onTranscript={(text) => {
                            setPitchInput(prev => (prev ? prev + ' ' : '') + text);
                            setPitchMicActive(false);
                          }}
                          autoSubmit={true}
                          autoStartAfterDisabled={false}
                          placeholder="Speak your scene idea..."
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleIdeasConfirmed}
                  disabled={!canProceed && !allRated}
                  className={`w-full rounded-xl font-semibold transition-all ${
                    canProceed
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : allRated
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {canProceed
                    ? 'Confirm 3 scenes — move to scheduling →'
                    : allRated
                      ? `Give me new ideas → (${totalLocked}/3 locked)`
                      : `Lock 3 scenes to continue (${totalLocked}/3)`}
                </Button>
              </div>
            );
          })()}

          {/* F7: VARIETY CHECK RESPONSE — ideas_feedback step needs an input */}
          {step === 'ideas_feedback' && !isTyping && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && userInput.trim()) {
                      handleFeedbackSubmit(userInput.trim());
                      setUserInput('');
                    }
                  }}
                  placeholder="yes swap / happy with these 3..."
                  className="flex-1 bg-gray-800/60 border border-gray-600/50 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => { if (userInput.trim()) { handleFeedbackSubmit(userInput.trim()); setUserInput(''); } }}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { handleFeedbackSubmit('yes, swap one for something more contrasting'); }}
                  className="flex-1 py-2 rounded-xl border border-purple-500/40 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-medium transition-colors"
                >
                  Yes, swap one out
                </button>
                <button
                  onClick={() => { handleFeedbackSubmit('happy with these 3'); }}
                  className="flex-1 py-2 rounded-xl border border-gray-600 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 text-xs font-medium transition-colors"
                >
                  Happy with these 3
                </button>
              </div>
            </div>
          )}

          {/* FORMAT SELECTION */}
          {step === 'format_selection' && !isTyping && (
            <div className="space-y-3">
              <div className="grid gap-2">
                {formats.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => handleFormatSelect(format.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                      format.recommended
                        ? 'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20'
                        : 'border-gray-700 bg-gray-800/50 hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="text-2xl mt-0.5">{format.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">
                          {format.label}
                        </span>
                        {format.recommended && (
                          <span className="text-[10px] px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-medium">
                            ⭐ Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format.description}
                      </p>
                    </div>
                  </button>
                ))}
                {/* Something else option */}
                <button
                  onClick={() => handleFormatSelect('custom')}
                  className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-600 bg-gray-800/30 hover:bg-gray-700/40 transition-all text-left"
                >
                  <span className="text-2xl">💡</span>
                  <div>
                    <span className="font-semibold text-white text-sm">
                      Something else
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Have your own idea? Tell me about it
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* CUSTOM FORMAT INPUT */}
          {step === 'custom_format_input' && !isTyping && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={customFormatName}
                onChange={(e) => setCustomFormatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomFormatSubmit()}
                placeholder="Describe your content format..."
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <Button
                onClick={handleCustomFormatSubmit}
                disabled={!customFormatName.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
              >
                Send
              </Button>
            </div>
          )}

          {/* FOOTAGE CHECK */}
          {step === 'footage_check' && !isTyping && !needsFootageCheck && (
            <div className="flex gap-3">
              <Button
                onClick={() => handleFootageCheck(true)}
                className="flex-1 bg-green-600/30 border border-green-500/50 hover:bg-green-600/50 text-green-300 rounded-xl"
              >
                ✅ Yes, I have footage
              </Button>
              <Button
                onClick={() => handleFootageCheck(false)}
                className="flex-1 bg-orange-600/30 border border-orange-500/50 hover:bg-orange-600/50 text-orange-300 rounded-xl"
              >
                📸 No, need to shoot
              </Button>
            </div>
          )}

          {/* POST ASSIGNMENT */}
          {step === 'post_assignment' && !isTyping && (
            <div className="space-y-3">
              <div className="grid gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                {scheduledPosts.map((post, idx) => {
                  const isSelected = selectedPostIndices.includes(idx);
                  const dateLabel = new Date(post.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  const typeLabel = post.type.charAt(0).toUpperCase() + post.type.slice(1).replace('-', ' ');

                  return (
                    <button
                      key={post.id}
                      onClick={() => {
                        setSelectedPostIndices((prev) =>
                          isSelected
                            ? prev.filter((i) => i !== idx)
                            : [...prev, idx]
                        );
                      }}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left text-sm ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-600'
                        }`}
                      >
                        {isSelected && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span>
                          Post {idx + 1} — {typeLabel}
                        </span>
                        <span className="text-xs text-gray-500">
                          {dateLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={handlePostSelection}
                disabled={selectedPostIndices.length === 0}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50"
              >
                Confirm Selection ({selectedPostIndices.length} post{selectedPostIndices.length !== 1 ? 's' : ''})
              </Button>
            </div>
          )}

          {/* REMAINING POSTS — pick second format */}
          {step === 'remaining_posts' && !isTyping && !needsFootageCheck && (
            <div className="space-y-3">
              <div className="grid gap-2">
                {availableFormatsForSecond.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => handleSecondFormatSelect(format.id)}
                    className="flex items-start gap-3 p-3 rounded-xl border border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 transition-all text-left"
                  >
                    <span className="text-xl">{format.emoji}</span>
                    <div>
                      <span className="font-semibold text-white text-sm">
                        {format.label}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format.description}
                      </p>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => handleSecondFormatSelect('custom')}
                  className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-600 bg-gray-800/30 hover:bg-gray-700/40 transition-all text-left"
                >
                  <span className="text-xl">💡</span>
                  <span className="font-semibold text-white text-sm">
                    Something else
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* SECOND FOOTAGE CHECK */}
          {needsFootageCheck && step === 'remaining_posts' && !isTyping && (
            <div className="flex gap-3">
              <Button
                onClick={() => handleSecondFootageCheck(true)}
                className="flex-1 bg-green-600/30 border border-green-500/50 hover:bg-green-600/50 text-green-300 rounded-xl"
              >
                ✅ Yes, I have footage
              </Button>
              <Button
                onClick={() => handleSecondFootageCheck(false)}
                className="flex-1 bg-orange-600/30 border border-orange-500/50 hover:bg-orange-600/50 text-orange-300 rounded-xl"
              >
                📸 No, need to shoot
              </Button>
            </div>
          )}

          {/* SUMMARY — visual idea cards + confirm */}
          {step === 'summary' && !isTyping && (
            <div className="space-y-3">
              {/* Idea-to-post cards */}
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {assignments.map((a, idx) => {
                  const idea = summaryIdeas[idx % Math.max(summaryIdeas.length, 1)];
                  const dateLabel = new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                  });
                  const typeLabel = a.postType.charAt(0).toUpperCase() + a.postType.slice(1).replace('-', ' ');
                  const isVariation = (a.variationIndex ?? 0) > 0;
                  const trialDateLabel = a.trialReelDate
                    ? new Date(a.trialReelDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : null;
                  return (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/80 border border-gray-700/60">
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${isVariation ? 'bg-blue-400' : 'bg-purple-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {a.ideaTitle || a.customFormatName || typeLabel}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {typeLabel} · {dateLabel}
                          {trialDateLabel && <span className="text-gray-500"> · trial reels {trialDateLabel}</span>}
                        </p>
                      </div>
                      {isVariation && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 flex-shrink-0">
                          Var {a.variationIndex}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                        {idea?.difficulty || ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Edit days compact display */}
              {generatedEditDays.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {generatedEditDays.map((ed, i) => {
                    const d = new Date(ed.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300">
                        ✂️ Edit day · {d}
                      </span>
                    );
                  })}
                </div>
              )}
              <Button
                onClick={handleConfirm}
                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold"
              >
                ✅ Add {assignments.length} posts to my schedule
              </Button>
              <button
                onClick={() => {
                  setStep('show_ideas');
                  setAssignments([]);
                  setSummaryIdeas([]);
                  addBotMessage(`Back to ideas — adjust your likes and we'll regenerate the plan.`, 300);
                }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
              >
                ↩ Go back and change ideas
              </button>
            </div>
          )}

          {/* ASK VARIATIONS */}
          {step === 'ask_variations' && !isTyping && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={variationsInput}
                  onChange={(e) => setVariationsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && variationsInput.trim()) {
                      handleVariationsResponse(variationsInput);
                      setVariationsInput('');
                    }
                  }}
                  placeholder='Try "3 variations" or "no"'
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <Button
                  onClick={() => { if (variationsInput.trim()) { handleVariationsResponse(variationsInput); setVariationsInput(''); } }}
                  disabled={!variationsInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                >
                  Send
                </Button>
              </div>
              <div className="flex gap-2">
                {[2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => { handleVariationsResponse(`${n} variations`); setVariationsInput(''); }}
                    className="flex-1 py-2 text-xs rounded-xl border border-purple-500/40 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 transition-colors"
                  >
                    {n} variations per post
                  </button>
                ))}
                <button
                  onClick={() => { handleVariationsResponse('no'); setVariationsInput(''); }}
                  className="flex-1 py-2 text-xs rounded-xl border border-gray-600 bg-gray-800/40 hover:bg-gray-700/40 text-gray-400 transition-colors"
                >
                  No variations
                </button>
              </div>
            </div>
          )}

          {/* SHOW VARIATIONS */}
          {step === 'show_variations' && !isTyping && (
            <div className="space-y-3">
              {/* Group by original idea */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {ideasForVariationPrompt.map((idea, ideaIdx) => {
                  const ideaCards = variationCards.filter(c => c.originalIdeaIdx === ideaIdx);
                  return (
                    <div key={ideaIdx} className="rounded-xl border border-gray-700/50 overflow-hidden">
                      {/* Idea group header */}
                      <div className="px-3 py-2 bg-gray-800/80 border-b border-gray-700/50">
                        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Idea {ideaIdx + 1}: {idea.title}
                        </p>
                      </div>
                      {/* Variation cards */}
                      {ideaCards.map(card => (
                        <div key={card.id} className="flex items-start gap-3 px-3 py-2.5 bg-gray-800/30 border-b border-gray-700/30 last:border-b-0">
                          <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 mt-1 ${card.isOriginal ? 'bg-purple-500' : 'bg-blue-400'}`} />
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={card.title}
                              onChange={(e) => handleVariationTitleChange(card.id, e.target.value)}
                              className="w-full bg-transparent text-sm font-medium text-white focus:outline-none focus:bg-gray-700/30 rounded px-1 py-0.5"
                            />
                            <p className="text-[11px] text-gray-500 mt-0.5 px-1">{card.rationale}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${card.isOriginal ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {card.isOriginal ? 'Original' : `Var ${card.variationIndex}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-gray-500 text-center">
                Edit any title above, then confirm. All {variationCards.length} posts can be filmed on the same day.
              </p>

              <Button
                onClick={handleVariationsConfirmed}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold"
              >
                ✅ Confirm {variationCards.length} posts
              </Button>
              <button
                onClick={() => {
                  setStep('ask_variations');
                  setVariationCards([]);
                  addBotMessage('Want a different number of variations?', 200);
                }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
              >
                ↩ Change number of variations
              </button>
            </div>
          )}

          {/* SHOOT DAY PROMPT */}
          {step === 'shoot_day_prompt' && !isTyping && (
            <div className="space-y-2">
              <button
                onClick={() => {
                  addUserMessage("Let's plan it now 📅");
                  setStep('shoot_day_date');
                  addBotMessage(`When do you want to shoot? I've suggested tomorrow — change it if you prefer a different day.`, 400);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-purple-500/40 bg-purple-600/20 hover:bg-purple-600/40 text-left transition-all"
              >
                <span className="text-xl">📅</span>
                <div>
                  <p className="text-sm font-semibold text-white">Plan it now</p>
                  <p className="text-[11px] text-gray-400">Pick a shoot date and add it to your schedule</p>
                </div>
              </button>
              <button
                onClick={() => { addUserMessage("Add it to my calendar 🗓"); finalizeAndComplete('schedule_task'); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-600 bg-gray-800/50 hover:bg-gray-700/50 text-left transition-all"
              >
                <span className="text-xl">🗓</span>
                <div>
                  <p className="text-sm font-semibold text-white">Add "Plan shoot day" to my calendar</p>
                  <p className="text-[11px] text-gray-400">I'll schedule the task before your first post</p>
                </div>
              </button>
              <button
                onClick={() => { addUserMessage("I already have footage — skip"); finalizeAndComplete('skip'); }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 py-2 transition-colors"
              >
                I already have footage — skip this
              </button>
            </div>
          )}

          {/* SHOOT DAY DATE PICKER */}
          {step === 'shoot_day_date' && !isTyping && (
            <div className="space-y-3">
              <div className="bg-gray-800/60 rounded-xl p-3 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Shoot date</p>
                <input
                  type="date"
                  value={shootDayDate}
                  min={tomorrow}
                  onChange={(e) => setShootDayDate(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={() => {
                  const formatted = new Date(shootDayDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  addUserMessage(`Let's shoot on ${formatted}`);
                  finalizeAndComplete('plan_now', shootDayDate);
                }}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
              >
                Confirm shoot date →
              </button>
            </div>
          )}

          {/* COMPLETE */}
          {step === 'complete' && !isTyping && (
            <div className="text-center py-2">
              <p className="text-green-400 text-sm font-medium">
                ✅ Content plan finalized! Updating your schedule...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

