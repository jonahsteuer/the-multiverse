'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
  onComplete: (result: BrainstormResult) => void;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

type BrainstormStep =
  // AI-powered ideas phase
  | 'ask_song_story'
  | 'ask_vibe'
  | 'ask_comfort'
  | 'loading_ideas'
  | 'show_ideas'
  | 'ideas_feedback'
  // Post assignment & confirmation
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
  onComplete,
  onClose,
}: BrainstormContentProps) {
  // If intake data came from Mark's chat, skip directly to loading ideas
  const [step, setStep] = useState<BrainstormStep>(
    prefilledIntake ? 'loading_ideas' : 'ask_song_story'
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Ideas phase state — pre-filled from Mark's chat if available
  const [songStory, setSongStory]       = useState(prefilledIntake?.songStory || '');
  const [artistVibe, setArtistVibe]     = useState(prefilledIntake?.artistVibe || '');
  const [comfortLevel, setComfortLevel] = useState(prefilledIntake?.comfortLevel || '');
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([]);
  const [likedIdeas, setLikedIdeas]     = useState<Set<string>>(new Set());
  const [dislikedIdeas, setDislikedIdeas] = useState<Set<string>>(new Set());
  const [tiktokCount, setTiktokCount]   = useState(0);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

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

  const formats = useMemo(
    () => getContentFormats(artistProfile, galaxyName),
    [artistProfile, galaxyName]
  );

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

  // Add a chatbot message with typing delay
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
    }, delay);
  };

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
    if (prefilledIntake) {
      // Mark already collected the intake — jump straight to loading
      addBotMessage(
        `Great — I have your context from Mark. Pulling real TikTok data for your genre and generating ideas now...`,
        300
      );
      fetchIdeas(prefilledIntake.songStory, prefilledIntake.artistVibe, prefilledIntake.comfortLevel);
    } else {
      addBotMessage(
        `Let's brainstorm content for **${galaxyName}**.\n\nFirst — what's the story behind this song? What were you going through when you wrote it?`,
        300
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared fetch function ─────────────────────────────────────────────────────
  const fetchIdeas = async (story: string, vibe: string, comfort: string) => {
    setLoadingIdeas(true);
    try {
      const genres: string[] = (artistProfile as any)?.genre || ['indie'];
      const res = await fetch('/api/tiktok-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres,
          songName: galaxyName,
          songStory: story,
          artistVibe: vibe,
          comfortLevel: comfort,
          releaseDate,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setContentIdeas(data.ideas || []);
      const count = data.tiktokPostsAnalyzed || 0;
      setTiktokCount(count);
      setStep('show_ideas');
      addBotMessage(
        count > 0
          ? `Here are 5 ideas based on ${count} real TikTok posts from artists in your space. Tap 👍 on the ones you like:`
          : `Here are 5 content ideas tailored to your song and vibe. Tap 👍 on the ones you like:`,
        800
      );
    } catch {
      setContentIdeas([]);
      setStep('show_ideas');
      addBotMessage(`Here are some content ideas for your song. Tap 👍 on the ones you like:`, 800);
    } finally {
      setLoadingIdeas(false);
    }
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
    setStep('ask_comfort');
    addBotMessage(`Perfect. Last one — how do you like to show up on camera? 👇`, 500);
  };

  // Keep these for backward compat if called without text arg
  const handleSongStorySubmit = () => handleSongStorySubmitWithText(userInput);
  const handleVibeSubmit = () => handleVibeSubmitWithText(userInput);

  const handleComfortSelect = (level: string) => {
    setComfortLevel(level);
    addUserMessage(level);
    setStep('loading_ideas');
    addBotMessage(`Pulling real TikTok data from similar artists and generating your ideas... 🔍`, 400);
    fetchIdeas(songStory, artistVibe, level);
  };

  // Accumulated liked ideas across all feedback rounds
  const [allLikedIdeas, setAllLikedIdeas] = useState<ContentIdea[]>([]);
  const [feedbackRound, setFeedbackRound] = useState(0);

  const toggleLike = (id: string) => {
    setLikedIdeas(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setDislikedIdeas(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleDislike = (id: string) => {
    setDislikedIdeas(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setLikedIdeas(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  // Called when user hits "Continue" on the ideas screen
  const handleIdeasConfirmed = () => {
    const liked = contentIdeas.filter(i => likedIdeas.has(i.id));

    // Merge newly liked ideas into the accumulated list (avoid duplicates)
    const merged = [
      ...allLikedIdeas,
      ...liked.filter(l => !allLikedIdeas.find(a => a.id === l.id)),
    ];
    setAllLikedIdeas(merged);

    const likedCount = merged.length;
    addUserMessage(`I like ${liked.length > 0 ? `${liked.length} of these ideas` : 'the ideas, let\'s move on'}`);

    const TARGET = 5;
    if (likedCount >= TARGET) {
      // Have enough — ask if they want to refine or move on
      addBotMessage(
        `You've got ${likedCount} ideas you like — that's enough to cover your posts. Any final notes, or should we move on to scheduling them?`,
        500
      );
    } else {
      addBotMessage(
        `${likedCount > 0 ? `Nice — ${likedCount} idea${likedCount > 1 ? 's' : ''} locked in.` : ''} Any notes on these, or want to pitch a different angle? I'll generate fresh ideas based on your feedback.`,
        500
      );
    }
    setStep('ideas_feedback');
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

    if (isPositiveOrEmpty(text) || allLikedIdeas.length >= 5) {
      // Move to post assignment
      proceedToPostAssignment(allLikedIdeas.length > 0 ? allLikedIdeas : contentIdeas);
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

      const likedSoFar = allLikedIdeas.length;
      const remaining = Math.max(0, 5 - likedSoFar);
      addBotMessage(
        `Here are 5 fresh ideas. ${likedSoFar > 0 ? `You have ${likedSoFar} locked in already — pick ${remaining} more you like:` : 'Tap 👍 on the ones that fit:'}`,
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

  // Map a ContentIdea format string to a ContentFormat for scheduling purposes
  const ideaFormatToContentFormat = (formatStr: string): ContentFormat => {
    const f = formatStr.toLowerCase();
    if (f.includes('music video')) return 'music_video_snippet';
    if (f.includes('bts') || f.includes('behind') || f.includes('performance')) return 'bts_performance';
    return 'custom';
  };

  // Auto-assign liked ideas to scheduled posts and proceed to summary
  const proceedToPostAssignment = (ideas: ContentIdea[]) => {
    const allPosts = scheduledPosts.length > 0 ? scheduledPosts : generateFallbackPosts(ideas.length);
    // One post per liked idea — never cycle/duplicate
    const postsToUse = allPosts.slice(0, ideas.length);

    const newAssignments: ContentFormatAssignment[] = postsToUse.map((post, idx) => {
      const idea = ideas[idx];
      return {
        postIndex: idx,
        postId: post.id,
        format: ideaFormatToContentFormat(idea.format),
        customFormatName: idea.title,
        ideaTitle: idea.title,
        ideaHook: idea.hook,
        postType: post.type,
        date: post.date,
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

    // Determine if shoot day decision is needed
    const needsShootDay = generatedShootDays.length > 0 ||
      assignments.some(a => !doesFormatHaveFootage(a.format));

    if (needsShootDay && shootDayAction === null) {
      setStep('shoot_day_prompt');
      addBotMessage(
        `Some of these ideas will need a shoot day — you'll need fresh footage. Do you want to plan it now, or should I add a **"Plan shoot day"** task to your calendar?`,
        500
      );
    } else {
      finalizeAndComplete(shootDayAction || 'skip');
    }
  };

  const finalizeAndComplete = (action: 'plan_now' | 'schedule_task' | 'skip', chosenShootDate?: string) => {
    setShootDayAction(action);
    setStep('complete');

    const result: BrainstormResult = {
      id: `brainstorm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      galaxyId,
      galaxyName,
      formatAssignments: assignments,
      editDays: generatedEditDays,
      shootDays: generatedShootDays,
      shootDayAction: action,
      shootDayDate: action === 'plan_now' ? (chosenShootDate || shootDayDate) : undefined,
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
                  setStep('ask_comfort');
                  addBotMessage(`No problem — how do you like to show up on camera? 👇`, 300);
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

          {/* ASK COMFORT */}
          {step === 'ask_comfort' && !isTyping && (
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'Performance — I love being on camera, singing/playing', value: 'performance' },
                { label: 'Storytelling — I can talk to camera but prefer not to perform', value: 'storytelling' },
                { label: 'Behind the scenes — I prefer not to be on camera much', value: 'bts' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleComfortSelect(opt.label)}
                  className="p-3 rounded-xl border border-gray-700 bg-gray-800/50 hover:bg-purple-600/20 hover:border-purple-500/50 text-left text-sm text-gray-200 transition-all"
                >
                  {opt.label}
                </button>
              ))}
            </div>
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

          {/* SHOW IDEAS — cards with thumbs up/down */}
          {step === 'show_ideas' && !isTyping && contentIdeas.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {contentIdeas.map(idea => {
                  const liked    = likedIdeas.has(idea.id);
                  const disliked = dislikedIdeas.has(idea.id);
                  return (
                    <div
                      key={idea.id}
                      className={`rounded-xl border p-3 transition-all ${
                        liked    ? 'border-green-500/60 bg-green-500/10' :
                        disliked ? 'border-gray-700 bg-gray-800/30 opacity-50' :
                                   'border-gray-700 bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-white font-semibold text-sm">{idea.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${DIFFICULTY_COLOR[idea.difficulty]}`}>
                              {idea.difficulty}
                            </span>
                            <span className="text-[10px] text-gray-500">{idea.format}</span>
                          </div>
                          <p className="text-xs text-purple-300 mb-1.5">
                            <span className="text-gray-500">Hook: </span>{idea.hook}
                          </p>
                          {/* whyItWorks — prominently displayed */}
                          <div className="flex items-start gap-1 mb-1">
                            <span className="text-yellow-400 text-[11px] flex-shrink-0">✨</span>
                            <p className="text-xs text-yellow-200/80 font-medium leading-snug">{idea.whyItWorks}</p>
                          </div>
                          <p className="text-[11px] text-gray-500 italic">"{idea.exampleCaption}"</p>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleLike(idea.id)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${liked ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-green-500/30 text-gray-400'}`}
                          >
                            👍
                          </button>
                          <button
                            onClick={() => toggleDislike(idea.id)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${disliked ? 'bg-red-500/50 text-white' : 'bg-gray-700 hover:bg-red-500/20 text-gray-400'}`}
                          >
                            👎
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                onClick={handleIdeasConfirmed}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold"
              >
                {likedIdeas.size > 0
                  ? `Lock in ${likedIdeas.size + allLikedIdeas.length} idea${(likedIdeas.size + allLikedIdeas.length) !== 1 ? 's' : ''} →`
                  : 'Continue →'}
              </Button>
            </div>
          )}

          {/* IDEAS FEEDBACK — ask for notes or pitch, generate new round if needed */}
          {step === 'ideas_feedback' && !isTyping && (
            <div className="space-y-3">
              <VoiceInput
                onTranscript={(text) => handleFeedbackSubmit(text)}
                autoSubmit={true}
                autoStartAfterDisabled={false}
                placeholder="Tap the mic — give notes, pitch an idea, or say 'looks good'"
              />
              <button
                onClick={() => handleFeedbackSubmit('looks good')}
                className="w-full py-2.5 rounded-xl border border-purple-500/40 bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 text-sm font-medium transition-all"
              >
                These look great — move on to scheduling →
              </button>
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
                  const dateLabel = new Date(a.date).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                  });
                  const typeLabel = a.postType.charAt(0).toUpperCase() + a.postType.slice(1).replace('-', ' ');
                  return (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/80 border border-gray-700/60">
                      <div className="w-1 self-stretch rounded-full bg-purple-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {a.ideaTitle || a.customFormatName || typeLabel}
                        </p>
                        <p className="text-[11px] text-gray-400">{typeLabel} · {dateLabel}</p>
                      </div>
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

