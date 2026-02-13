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

export function BrainstormContent({
  galaxyId,
  galaxyName,
  scheduledPosts,
  artistProfile,
  preferredDays = ['saturday', 'sunday'],
  onComplete,
  onClose,
}: BrainstormContentProps) {
  const [step, setStep] = useState<BrainstormStep>('intro');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

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

  // Initialize with intro message
  useEffect(() => {
    const hasRecommended = formats.some((f) => f.recommended);
    const recommendedFormat = formats.find((f) => f.recommended);

    let intro = `Hey! Let's brainstorm some content for **${galaxyName}** 🌌\n\n`;
    intro += `You've got **${scheduledPosts.length} posts** scheduled. Let's figure out what kind of content to make for them.\n\n`;

    if (hasRecommended && recommendedFormat) {
      intro += `I see you already have some assets to work with — that's great! `;
      if (recommendedFormat.id === 'music_video_snippet') {
        intro += `Since you have a music video, we could cut some snippets from it.`;
      } else if (recommendedFormat.id === 'bts_performance') {
        intro += `Your behind-the-scenes footage could work really well.`;
      }
      intro += `\n\n`;
    }

    intro += `Pick a content format below, unless you have another idea! 👇`;

    addBotMessage(intro, 300);
    setStep('format_selection');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const generateSummary = (allAssignments: ContentFormatAssignment[]) => {
    setStep('summary');

    // Group assignments by format
    const byFormat = allAssignments.reduce(
      (acc, a) => {
        const key = a.format === 'custom' ? (a.customFormatName || 'Custom') : a.format;
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
      },
      {} as Record<string, ContentFormatAssignment[]>
    );

    // Calculate edit days and shoot days
    const editDays: BrainstormEditDay[] = [];
    const shootDays: BrainstormShootDay[] = [];

    for (const [formatKey, fAssignments] of Object.entries(byFormat)) {
      const format = fAssignments[0].format;
      const needsShoot = !doesFormatHaveFootage(format);

      if (needsShoot) {
        // Schedule a shoot day
        const earliestPostDate = fAssignments
          .map((a) => a.date)
          .sort()[0];

        const shootDate = calculateShootDate(earliestPostDate, preferredDays);
        shootDays.push({
          id: `shoot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          format,
          customFormatName: format === 'custom' ? fAssignments[0].customFormatName : undefined,
          reason: `${getFormatLabel(format, fAssignments[0].customFormatName)} footage needed`,
          duration: 180, // 3 hours default
          date: shootDate,
          startTime: '10:00',
          endTime: '13:00',
          sharedWith: [], // Artist would be added here
        });
      }

      // Schedule edit days — 2 posts per edit day
      const postsPerEditDay = 2;
      const numEditDays = Math.ceil(fAssignments.length / postsPerEditDay);

      for (let i = 0; i < numEditDays; i++) {
        const coveredPosts = fAssignments.slice(
          i * postsPerEditDay,
          (i + 1) * postsPerEditDay
        );
        const latestPostDate = coveredPosts
          .map((a) => a.date)
          .sort()
          .reverse()[0];

        // Edit day should be before the posts but after any shoot day for this format
        let editDate: string;
        if (needsShoot && shootDays.length > 0) {
          // Must be after the shoot day
          const shootDay = shootDays.find(
            (s) => s.format === format
          );
          editDate = calculateEditDate(
            latestPostDate,
            i,
            numEditDays,
            shootDay?.date
          );
        } else {
          editDate = calculateEditDate(latestPostDate, i, numEditDays);
        }

        editDays.push({
          id: `edit-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          format,
          customFormatName: format === 'custom' ? coveredPosts[0].customFormatName : undefined,
          postsCovered: coveredPosts.map((p) => p.postIndex),
          duration: 120, // 2 hours default
          date: editDate,
          startTime: '10:00',
          endTime: '12:00',
        });
      }
    }

    // Build summary message
    let summary = `Here's the plan! 🎯\n\n`;
    summary += `**Content Format Assignments:**\n`;
    for (const [formatKey, fAssignments] of Object.entries(byFormat)) {
      const label = getFormatLabel(
        fAssignments[0].format,
        fAssignments[0].customFormatName
      );
      summary += `• **${label}** → ${fAssignments.length} post${fAssignments.length > 1 ? 's' : ''}\n`;
      fAssignments.forEach((a) => {
        const post = scheduledPosts[a.postIndex];
        const postLabel = a.postType.charAt(0).toUpperCase() + a.postType.slice(1).replace('-', ' ');
        const dateLabel = new Date(a.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        summary += `  → Post ${a.postIndex + 1}: ${label} (${postLabel}) — ${dateLabel}\n`;
      });
    }

    summary += `\n**Schedule Updates:**\n`;
    if (editDays.length > 0) {
      summary += `✂️ **${editDays.length} edit day${editDays.length > 1 ? 's'  : ''}** added to the schedule\n`;
      editDays.forEach((ed) => {
        const dateLabel = new Date(ed.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        summary += `  → ${dateLabel}: Edit ${getFormatLabel(ed.format, ed.customFormatName)} (${ed.postsCovered.length} posts)\n`;
      });
    }
    if (shootDays.length > 0) {
      summary += `📸 **${shootDays.length} shoot day${shootDays.length > 1 ? 's' : ''}** added to the schedule\n`;
      shootDays.forEach((sd) => {
        const dateLabel = new Date(sd.date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        summary += `  → ${dateLabel}: ${sd.reason} (appears on artist's calendar too)\n`;
      });
    }

    summary += `\nLook good? Hit **Confirm** to finalize, or go back to make changes.`;

    addBotMessage(summary, 800);

    // Store for confirmation
    setGeneratedEditDays(editDays);
    setGeneratedShootDays(shootDays);
  };

  const [generatedEditDays, setGeneratedEditDays] = useState<BrainstormEditDay[]>([]);
  const [generatedShootDays, setGeneratedShootDays] = useState<BrainstormShootDay[]>([]);

  const handleConfirm = () => {
    addUserMessage("Looks great, let's do it! ✅");
    setStep('complete');

    const result: BrainstormResult = {
      id: `brainstorm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      galaxyId,
      galaxyName,
      formatAssignments: assignments,
      editDays: generatedEditDays,
      shootDays: generatedShootDays,
      completedAt: new Date().toISOString(),
      status: 'completed',
    };

    addBotMessage(
      `Done! 🎉 Your content plan for **${galaxyName}** is set.\n\n` +
      `The schedule has been updated with your edit days${generatedShootDays.length > 0 ? ' and shoot day' : ''}. ` +
      `The admin will be notified about your content choices.`,
      500
    );

    // Delay slightly so the user sees the confirmation message
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

          {/* SUMMARY — Confirm or Go Back */}
          {step === 'summary' && !isTyping && (
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  // Reset state for redo
                  setStep('format_selection');
                  setMessages([]);
                  setSelectedFormat(null);
                  setSecondFormat(null);
                  setSelectedPostIndices([]);
                  setAssignments([]);
                  setCustomFormatName('');
                  setSecondCustomFormatName('');
                  setHasFootageForBTS(null);
                  setHasFootageForCustom(null);
                  setNeedsFootageCheck(false);
                  // Re-add intro
                  const hasRecommended = formats.some((f) => f.recommended);
                  let intro = `Let's try again! Pick a content format for **${galaxyName}**:`;
                  addBotMessage(intro, 300);
                }}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 rounded-xl"
              >
                ↩ Start Over
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold"
              >
                ✅ Confirm Plan
              </Button>
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

