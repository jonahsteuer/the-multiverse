'use client';

import { useState, useEffect, useRef } from 'react';
import { VoiceInput } from './VoiceInput';
import { EnhancedOnboardingForm } from './EnhancedOnboardingForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ArtistProfile, BestPost, ExistingAssets, TeamMember } from '@/types';

interface ConversationalOnboardingProps {
  creatorName: string;
  onComplete: (profile: ArtistProfile) => void;
  onSkip?: () => void;
}

// TTS Engine type
type TTSEngine = 'elevenlabs' | 'browser';

// ElevenLabs voices
const ELEVENLABS_VOICES = {
  rachel: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Warm, calm female' },
  bella: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Young, friendly female' },
  elli: { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young, pleasant female' },
  adam: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, warm male' },
  josh: { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep, friendly male' },
  sam: { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'Young, dynamic male' },
};

// Audio player for ElevenLabs
let currentAudio: HTMLAudioElement | null = null;

// ElevenLabs TTS
const speakWithElevenLabs = async (
  text: string, 
  voiceId: string,
  onStart?: () => void,
  onEnd?: () => void
) => {
  try {
    // Stop any current audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    onStart?.();

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!response.ok) {
      console.error('[ElevenLabs] API error:', response.status);
      onEnd?.();
      return;
    }

    const { audio } = await response.json();
    
    // Create and play audio
    const audioBlob = new Blob(
      [Uint8Array.from(atob(audio), c => c.charCodeAt(0))],
      { type: 'audio/mpeg' }
    );
    const audioUrl = URL.createObjectURL(audioBlob);
    
    currentAudio = new Audio(audioUrl);
    currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      onEnd?.();
    };
    currentAudio.onerror = () => {
      console.error('[ElevenLabs] Audio playback error');
      onEnd?.();
    };
    
    await currentAudio.play();
  } catch (error) {
    console.error('[ElevenLabs] Error:', error);
    onEnd?.();
  }
};

// Browser Web Speech API TTS
const speakWithBrowser = (text: string, onEnd?: () => void) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  
  window.speechSynthesis.cancel();
  
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim();
  
  // If no text to speak, call onEnd immediately
  if (!cleanText) {
    onEnd?.();
    return;
  }
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  const voices = window.speechSynthesis.getVoices();
  const preferredVoiceNames = [
    'Microsoft Aria Online', 'Microsoft Jenny Online',
    'Samantha (Enhanced)', 'Karen (Enhanced)', 'Samantha', 'Karen',
    'Google US English', 'Google UK English Female',
  ];
  
  let selectedVoice: SpeechSynthesisVoice | null = null;
  for (const voiceName of preferredVoiceNames) {
    const found = voices.find(v => v.name.includes(voiceName));
    if (found) {
      selectedVoice = found;
      break;
    }
  }
  
  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.lang.startsWith('en')) || null;
  }
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  
  // Always set up onend and onerror handlers
  utterance.onend = () => {
    console.log('[Browser TTS] Speech ended');
    onEnd?.();
  };
  utterance.onerror = (event) => {
    console.error('[Browser TTS] Error:', event);
    onEnd?.();
  };
  
  window.speechSynthesis.speak(utterance);
};

// Stop any playing audio
const stopSpeaking = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

type ConversationStep = 
  | 'welcome'
  | 'genre'
  | 'genre_inspiration'
  | 'visual_aesthetic'
  | 'posts_experience'
  | 'best_posts_ask'
  | 'best_post_which'
  | 'best_post_why'
  | 'release_strategy'
  | 'best_posts_describe'
  | 'platforms'
  | 'posting_frequency'
  | 'content_enjoyment'
  | 'equipment'
  | 'time_budget'
  | 'preferred_days'
  | 'existing_assets'
  | 'team'
  | 'summary'
  | 'complete';

// Conversation flow definition
const CONVERSATION_FLOW: Record<ConversationStep, {
  question: string | ((data: Partial<ArtistProfile>, name: string) => string);
  nextStep: ConversationStep | ((response: string, data: Partial<ArtistProfile>) => ConversationStep);
  processResponse?: (response: string, data: Partial<ArtistProfile>) => Partial<ArtistProfile>;
}> = {
  welcome: {
    question: (_, name) => `Hey ${name}! 👋 I'm here to help you find your fans through social media. Let's chat for a few minutes so I can understand your style and figure out the best way to get your music heard. First up - what genre best describes your music?`,
    nextStep: (response) => {
      // Check if they already mentioned artist inspirations in their answer
      const lower = response.toLowerCase();
      const mentionedArtists = lower.includes('inspired by') || 
                               lower.includes('like ') ||
                               lower.includes('similar to') ||
                               lower.includes('influence');
      return mentionedArtists ? 'visual_aesthetic' : 'genre_inspiration';
    },
    processResponse: (response, data) => {
      // Try to extract any artist names mentioned
      const inspirationMatch = response.match(/inspired by\s+([^.]+)/i) ||
                               response.match(/like\s+([^.]+)/i);
      const inspirations = inspirationMatch 
        ? inspirationMatch[1].split(/,|\s+and\s+/).map(s => s.trim()).filter(Boolean)
        : undefined;
      
      return {
        ...data,
        genre: [response.trim()],
        musicalInspiration: inspirations,
      };
    },
  },
  genre: {
    // This step is now skipped - welcome handles genre question
    question: "What genre or style is your music?",
    nextStep: 'genre_inspiration',
    processResponse: (response, data) => ({
      ...data,
      genre: [response.trim()],
    }),
  },
  genre_inspiration: {
    question: (data) => `Love that! ${data.genre?.[0] ? `${data.genre[0]} has so much range.` : ''} Who are some artists that inspire your sound?`,
    nextStep: 'visual_aesthetic',
    processResponse: (response, data) => ({
      ...data,
      musicalInspiration: response.split(/,|\s+and\s+/).map(s => s.trim()).filter(Boolean),
    }),
  },
  visual_aesthetic: {
    question: (data) => {
      // Build a contextual question based on their inspirations
      const inspirations = data.musicalInspiration?.join(', ') || '';
      const hasInspirations = inspirations.length > 0;
      
      // Try to suggest aesthetics based on known artists
      const lower = inspirations.toLowerCase();
      let suggestion = '';
      if (lower.includes('dominic fike') || lower.includes('bon iver') || lower.includes('phoebe') || lower.includes('fleet foxes')) {
        suggestion = "Given your influences, I'm guessing maybe natural, organic vibes - forests, golden hour, intimate settings? ";
      } else if (lower.includes('weeknd') || lower.includes('doja') || lower.includes('travis')) {
        suggestion = "Based on your influences, maybe something darker, more cinematic, neon-lit? ";
      } else if (lower.includes('taylor') || lower.includes('olivia') || lower.includes('lorde')) {
        suggestion = "Given your influences, maybe something dreamy, emotional, soft color palettes? ";
      }
      
      return hasInspirations 
        ? `Nice taste! ${suggestion}What visual aesthetic matches your music? Dark and moody, bright and energetic, dreamy, retro, nature-inspired - or something else?`
        : "What visual aesthetic matches your music? Think about the vibe - dark and moody, bright and energetic, dreamy, retro, minimalist, or something else?";
    },
    nextStep: 'posts_experience',
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      let aesthetic = 'custom';
      if (lower.includes('dark') || lower.includes('moody')) aesthetic = 'dark_moody';
      else if (lower.includes('bright') || lower.includes('energetic')) aesthetic = 'bright_energetic';
      else if (lower.includes('dream') || lower.includes('ethereal')) aesthetic = 'dreamy_ethereal';
      else if (lower.includes('retro') || lower.includes('vintage')) aesthetic = 'retro_vintage';
      else if (lower.includes('minimal')) aesthetic = 'minimalist';
      else if (lower.includes('nature') || lower.includes('natural') || lower.includes('forest') || lower.includes('outdoor') || lower.includes('organic')) aesthetic = 'natural_organic';
      
      return {
        ...data,
        visualAesthetic: aesthetic,
        visualStyleDescription: response,
      };
    },
  },
  posts_experience: {
    question: (data) => {
      // Acknowledge their visual style first
      const style = data.visualStyleDescription || '';
      const lower = style.toLowerCase();
      let ack = '';
      if (lower.includes('forest') || lower.includes('nature') || lower.includes('outdoor') || lower.includes('beach') || lower.includes('mountain')) {
        ack = "Love the outdoor, natural vibe - that's very cinematic. ";
      } else if (lower.includes('dreamy') || lower.includes('retro')) {
        ack = "Dreamy retro is such a great aesthetic. ";
      } else if (lower.includes('dark') || lower.includes('moody')) {
        ack = "Dark and moody can be super compelling. ";
      }
      
      return `${ack}Have you posted any content for your music on social media before?`;
    },
    nextStep: (response) => {
      const lower = response.toLowerCase();
      // Check for negative responses - be more careful about "none" vs "one"
      const isNegative = lower.includes('no ') || 
                         lower.includes('not ') || 
                         lower.includes("haven't") || 
                         lower.includes("havent") ||
                         lower.includes('never') ||
                         lower.match(/\bnone\b/) || // "none" as a word, not part of "one"
                         lower.match(/^no[,.]?$/) ||
                         lower.includes("don't have") ||
                         lower.includes("dont have");
      
      if (isNegative) {
        return 'platforms';
      }
      return 'best_post_which';
    },
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      const hasPosted = !(lower.includes('no ') || 
                          lower.includes('not ') || 
                          lower.includes("haven't") ||
                          lower.includes("havent") ||
                          lower.includes('never') ||
                          lower.match(/\bnone\b/) ||
                          lower.match(/^no[,.]?$/));
      return {
        ...data,
        hasBestPosts: hasPosted,
      };
    },
  },
  best_post_which: {
    question: "Which post got the most engagement - even if it wasn't a huge hit? I want to understand what resonated.",
    nextStep: 'best_post_why',
    processResponse: (response, data) => ({
      ...data,
      bestPosts: [{
        id: `post-${Date.now()}`,
        description: response,
        postFormat: 'other' as const,
      }],
    }),
  },
  best_post_why: {
    question: "Interesting! Why do you think that one connected more than others? Even a guess helps.",
    nextStep: 'release_strategy',
    processResponse: (response, data) => {
      // Add the "why" to the existing best post
      const existingPosts = data.bestPosts || [];
      if (existingPosts.length > 0) {
        existingPosts[0].description += ` | Why it worked: ${response}`;
      }
      return {
        ...data,
        bestPosts: existingPosts,
      };
    },
  },
  release_strategy: {
    question: (data, name) => {
      // Analyze releases to craft the question
      const releases = (data as any).releases || [];
      const recentRelease = releases.find((r: any) => {
        if (!r.releaseDate || !r.isReleased) return false;
        const monthsAgo = (Date.now() - new Date(r.releaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
        return monthsAgo < 6; // Released within last 6 months
      });
      const upcomingRelease = releases.find((r: any) => !r.isReleased && r.releaseDate);
      
      // Craft question based on their situation
      if (recentRelease && upcomingRelease) {
        const recentMonth = new Date(recentRelease.releaseDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const upcomingDate = new Date(upcomingRelease.releaseDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        return `So '${recentRelease.name}' came out in ${recentMonth}. For your content: start teasing '${upcomingRelease.name}' in 2 weeks, keep promoting '${recentRelease.name}', or just make more general content to grow your audience?`;
      } else if (recentRelease && !upcomingRelease) {
        const monthsAgo = Math.round((Date.now() - new Date(recentRelease.releaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
        const timeframe = monthsAgo === 1 ? '1 month ago' : `${monthsAgo} months ago`;
        return `Got it - '${recentRelease.name}' came out ${timeframe}. So content-wise: keep promoting that, or just make more general content to grow your audience?`;
      } else if (!recentRelease && upcomingRelease) {
        const upcomingDate = new Date(upcomingRelease.releaseDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        return `Got it - '${upcomingRelease.name}' dropping ${upcomingDate}. So for your content strategy: would you like to start teasing ${upcomingRelease.name} in 2 weeks, promote a previous release, or just make more general content to grow your audience?`;
      } else {
        return "What's your main goal right now - growing your fanbase, or are you waiting for the right moment to drop something new?";
      }
    },
    nextStep: 'platforms',
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      let strategy: 'promote_recent' | 'build_to_release' | 'audience_growth' | 'balanced' = 'audience_growth';
      
      // Parse their response
      if (lower.includes('teas') || lower.includes('start teas') || lower.includes('build')) {
        strategy = 'build_to_release';
      } else if (lower.includes('keep promot') || lower.includes('still promot') || lower.includes('promot') && lower.includes('that')) {
        strategy = 'promote_recent';
      } else if (lower.includes('general') || lower.includes('grow') && lower.includes('audience')) {
        strategy = 'audience_growth';
      } else if (lower.includes('both') || lower.includes('mix')) {
        strategy = 'balanced';
      }
      
      return {
        ...data,
        releaseStrategy: strategy,
        releaseStrategyDescription: response,
      };
    },
  },
  // Keep old steps for backwards compatibility but they're now skipped
  best_posts_ask: {
    question: "Have you had any posts that performed really well before?",
    nextStep: 'platforms',
    processResponse: (response, data) => ({ ...data }),
  },
  best_posts_describe: {
    question: "Tell me about it!",
    nextStep: 'platforms',
    processResponse: (response, data) => ({ ...data }),
  },
  platforms: {
    question: "Which platforms do you post to? Instagram, TikTok, YouTube, Twitter - or a mix?",
    nextStep: 'posting_frequency',
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      const platforms: ('instagram' | 'tiktok' | 'youtube' | 'twitter')[] = [];
      if (lower.includes('instagram') || lower.includes('ig') || lower.includes('insta')) platforms.push('instagram');
      if (lower.includes('tiktok') || lower.includes('tik tok')) platforms.push('tiktok');
      if (lower.includes('youtube') || lower.includes('yt')) platforms.push('youtube');
      if (lower.includes('twitter') || lower.includes('x')) platforms.push('twitter');
      
      // Default to Instagram if nothing detected
      if (platforms.length === 0) platforms.push('instagram');
      
      return {
        ...data,
        platforms,
        primaryPlatform: platforms[0],
      };
    },
  },
  posting_frequency: {
    question: (data) => `Got it - ${data.platforms?.join(' and ')}. How often are you posting right now? And how often would you like to be posting?`,
    nextStep: 'content_enjoyment',
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      let current: ArtistProfile['currentPostingFrequency'] = 'less_than_weekly';
      let desired: ArtistProfile['desiredPostingFrequency'] = '2-3x_week';
      
      // Parse current frequency
      if (lower.includes('daily') || lower.includes('every day')) current = 'daily';
      else if (lower.includes('few times') || lower.includes('2-3') || lower.includes('couple')) current = '2-3x_week';
      else if (lower.includes('once a week') || lower.includes('weekly') || lower.includes('week')) current = 'weekly';
      else if (lower.includes('not much') || lower.includes('rarely') || lower.includes('sporadic')) current = 'less_than_weekly';
      
      // For desired, assume they want more than current
      if (current === 'less_than_weekly') desired = 'weekly';
      else if (current === 'weekly') desired = '2-3x_week';
      else if (current === '2-3x_week') desired = 'daily';
      else desired = 'daily';
      
      return {
        ...data,
        currentPostingFrequency: current,
        desiredPostingFrequency: desired,
      };
    },
  },
  content_enjoyment: {
    question: "If you had to make a post tomorrow, what would it be? Would you grab your phone and film something fresh, or edit together footage you already have?",
    nextStep: (response) => {
      const lower = response.toLowerCase();
      // If they mention existing footage/content, ask about assets next
      const mentionsExisting = lower.includes('edit') || 
                              lower.includes('footage') || 
                              lower.includes('already have') ||
                              lower.includes('existing') ||
                              lower.includes('repurpose');
      return mentionsExisting ? 'existing_assets' : 'equipment';
    },
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      let approach = 'mixed';
      
      if (lower.includes('fresh') || lower.includes('new') || lower.includes('film') || lower.includes('shoot') || lower.includes('record')) {
        approach = 'fresh_content';
      } else if (lower.includes('edit') || lower.includes('footage') || lower.includes('existing') || lower.includes('already have')) {
        approach = 'existing_footage';
      }
      
      return {
        ...data,
        contentCreationApproach: approach,
      };
    },
  },
  equipment: {
    question: "What equipment do you have for creating content? Just your phone, or do you have cameras, lights, or other gear?",
    nextStep: 'time_budget',
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      let equipment: ArtistProfile['equipment'] = 'phone';
      
      if (lower.includes('full') || lower.includes('setup') || lower.includes('studio') || lower.includes('team')) {
        equipment = 'full_setup';
      } else if (lower.includes('camera') || lower.includes('dslr') || lower.includes('mirrorless')) {
        equipment = 'camera';
      } else if (lower.includes('tripod') || lower.includes('light') || lower.includes('ring light') || lower.includes('basic')) {
        equipment = 'phone_basic';
      }
      
      return {
        ...data,
        equipment,
      };
    },
  },
  time_budget: {
    question: "How many hours per week can you realistically dedicate to creating and posting content? Be honest - I'll make sure the suggestions fit your schedule.",
    nextStep: 'preferred_days',
    processResponse: (response, data) => {
      // Try to extract a number from the response
      const numbers = response.match(/\d+/g);
      let hours = 6; // Default
      
      if (numbers && numbers.length > 0) {
        hours = parseInt(numbers[0], 10);
        // If they said a range like "5-10", take the first number
      }
      
      // Also parse text descriptions
      const lower = response.toLowerCase();
      if (lower.includes('hour') && lower.includes('day')) {
        // "an hour a day" = 7 hours
        const perDay = numbers ? parseInt(numbers[0], 10) : 1;
        hours = perDay * 7;
      }
      
      return {
        ...data,
        timeBudgetHoursPerWeek: hours,
      };
    },
  },
  preferred_days: {
    question: (data) => `${data.timeBudgetHoursPerWeek} hours a week - got it! Which days work best for you to create content? Weekends, weekdays, or specific days?`,
    nextStep: 'team',
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      const days: string[] = [];
      
      if (lower.includes('weekend')) {
        days.push('saturday', 'sunday');
      }
      if (lower.includes('weekday')) {
        days.push('monday', 'tuesday', 'wednesday', 'thursday', 'friday');
      }
      if (lower.includes('monday') || lower.includes('mon')) days.push('monday');
      if (lower.includes('tuesday') || lower.includes('tue')) days.push('tuesday');
      if (lower.includes('wednesday') || lower.includes('wed')) days.push('wednesday');
      if (lower.includes('thursday') || lower.includes('thu')) days.push('thursday');
      if (lower.includes('friday') || lower.includes('fri')) days.push('friday');
      if (lower.includes('saturday') || lower.includes('sat')) days.push('saturday');
      if (lower.includes('sunday') || lower.includes('sun')) days.push('sunday');
      
      // Remove duplicates
      const uniqueDays = [...new Set(days)];
      
      return {
        ...data,
        preferredDays: uniqueDays.length > 0 ? uniqueDays : ['saturday', 'sunday'],
      };
    },
  },
  existing_assets: {
    question: (data) => {
      // If they mentioned existing footage in content_enjoyment, ask more specifically
      if (data.contentCreationApproach === 'existing_footage') {
        return "You mentioned you'd edit together existing footage - that's smart! What do you have to work with? Music videos, leftover clips, behind-the-scenes stuff, or photos?";
      }
      return "Do you have any existing content you could repurpose? Like a music video, leftover footage from shoots, behind-the-scenes clips, or photos? These can save you a ton of time.";
    },
    nextStep: 'equipment',
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      const assets: ExistingAssets = {};
      
      if (lower.includes('music video') || lower.includes('mv') || lower.includes('video')) {
        assets.musicVideos = [{
          id: `mv-${Date.now()}`,
          description: 'Music video mentioned in onboarding',
          createdAt: new Date().toISOString(),
        }];
      }
      if (lower.includes('footage') || lower.includes('leftover') || lower.includes('clips')) {
        assets.footage = [{
          id: `footage-${Date.now()}`,
          description: 'Leftover footage mentioned in onboarding',
          createdAt: new Date().toISOString(),
        }];
      }
      if (lower.includes('behind') || lower.includes('bts')) {
        assets.behindTheScenes = [{
          id: `bts-${Date.now()}`,
          description: 'Behind-the-scenes content mentioned in onboarding',
          createdAt: new Date().toISOString(),
        }];
      }
      if (lower.includes('photo')) {
        assets.photos = [{
          id: `photo-${Date.now()}`,
          description: 'Photos mentioned in onboarding',
          createdAt: new Date().toISOString(),
        }];
      }
      
      const hasAssets = Object.keys(assets).length > 0;
      
      return {
        ...data,
        existingAssets: hasAssets ? assets : undefined,
        hasExistingAssets: hasAssets,
      };
    },
  },
  team: {
    question: "Last question - do you have anyone who can help you with content? A videographer, editor, or friend who shoots videos? Even occasionally?",
    nextStep: 'summary',
    processResponse: (response, data) => {
      const lower = response.toLowerCase();
      const hasTeam = lower.includes('yes') || 
                      lower.includes('videographer') || 
                      lower.includes('editor') || 
                      lower.includes('friend') ||
                      lower.includes('sometimes') ||
                      lower.includes('occasionally');
      
      const teamMembers: TeamMember[] = [];
      if (lower.includes('videographer')) {
        teamMembers.push({
          id: `team-${Date.now()}`,
          name: 'Videographer',
          role: 'videographer',
          availability: lower.includes('sometimes') || lower.includes('occasional') ? 'sometimes' : 'always',
        });
      }
      if (lower.includes('editor')) {
        teamMembers.push({
          id: `team-${Date.now() + 1}`,
          name: 'Editor',
          role: 'editor',
          availability: lower.includes('sometimes') || lower.includes('occasional') ? 'sometimes' : 'always',
        });
      }
      
      return {
        ...data,
        hasTeam,
        teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
      };
    },
  },
  summary: {
    question: (data) => {
      const parts = [
        `Awesome, here's what I learned about you:`,
        ``,
        `🎵 **Genre:** ${data.genre?.join(', ')}`,
        `🎨 **Visual style:** ${data.visualAesthetic?.replace('_', ' ')}`,
        `📱 **Platforms:** ${data.platforms?.join(', ')}`,
        `⏰ **Time:** ${data.timeBudgetHoursPerWeek} hours/week`,
        `📅 **Best days:** ${data.preferredDays?.join(', ')}`,
      ];
      
      if (data.existingAssets) {
        const assetTypes = Object.keys(data.existingAssets).filter(k => 
          data.existingAssets?.[k as keyof ExistingAssets]?.length
        );
        if (assetTypes.length > 0) {
          parts.push(`📦 **Existing assets:** ${assetTypes.join(', ').replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
      }
      
      if (data.hasTeam) {
        parts.push(`👥 **Team help:** Yes${data.teamMembers?.length ? ` (${data.teamMembers.map(t => t.role).join(', ')})` : ''}`);
      }
      
      parts.push('');
      parts.push("Does this look right? Say 'yes' to continue, or tell me what to change.");
      
      return parts.join('\n');
    },
    nextStep: (response) => {
      const lower = response.toLowerCase();
      if (lower.includes('yes') || lower.includes('right') || lower.includes('correct') || lower.includes('good') || lower.includes('looks good')) {
        return 'complete';
      }
      // If they want to change something, we could add logic to go back
      // For now, just proceed
      return 'complete';
    },
  },
  complete: {
    question: "Perfect! Let's build your universe. 🚀",
    nextStep: 'complete',
  },
};

export function ConversationalOnboarding({ 
  creatorName, 
  onComplete,
  onSkip 
}: ConversationalOnboardingProps) {
  // ============================================================================
  // CONFIG - Developer controlled (ask Cursor to change these)
  // ============================================================================
  const TTS_ENGINE = 'browser' as TTSEngine; // ElevenLabs API key issue - using browser for now
  const ELEVENLABS_VOICE: keyof typeof ELEVENLABS_VOICES = 'bella'; // Options: rachel, bella, elli, adam, josh, sam
  const USE_CLAUDE_CHAT = true; // true = Claude AI conversation, false = scripted flow
  // ============================================================================

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<ConversationStep>('welcome');
  const [collectedData, setCollectedData] = useState<Partial<ArtistProfile>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [claudeQuestionCount, setClaudeQuestionCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false); // User must click to start (browser audio policy)
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const claudeProfileData = useRef<Partial<ArtistProfile>>({});
  const claudeReleaseData = useRef<any[]>([]);

  // Claude chat handler
  const handleClaudeChat = async (userMessage: string): Promise<{ message: string; isComplete: boolean }> => {
    try {
      // Build message history for Claude (exclude the welcome message for API)
      const chatHistory = messages
        .filter(m => m.role === 'user' || (m.role === 'assistant' && messages.indexOf(m) > 0))
        .map(m => ({ role: m.role, content: m.content }));
      
      // Add the new user message
      chatHistory.push({ role: 'user', content: userMessage });

      const response = await fetch('/api/onboarding-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          creatorName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Onboarding] API Error:', errorData);
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      
        // Store extracted profile data
      if (data.profileData) {
        claudeProfileData.current = {
          ...claudeProfileData.current,
          genre: data.profileData.genre || claudeProfileData.current.genre,
          musicalInspiration: data.profileData.musicalInspiration || claudeProfileData.current.musicalInspiration,
          visualAesthetic: data.profileData.visualAesthetic || claudeProfileData.current.visualAesthetic,
          visualStyleDescription: data.profileData.visualStyleDescription || claudeProfileData.current.visualStyleDescription,
          hasBestPosts: data.profileData.hasBestPosts ?? claudeProfileData.current.hasBestPosts,
          platforms: data.profileData.platforms || claudeProfileData.current.platforms,
          primaryPlatform: data.profileData.platforms?.[0] || claudeProfileData.current.primaryPlatform,
          currentPostingFrequency: data.profileData.currentPostingFrequency || claudeProfileData.current.currentPostingFrequency,
          desiredPostingFrequency: data.profileData.desiredPostingFrequency || claudeProfileData.current.desiredPostingFrequency,
          enjoyedContentFormats: data.profileData.enjoyedContentFormats || claudeProfileData.current.enjoyedContentFormats,
          equipment: data.profileData.equipment || claudeProfileData.current.equipment,
          timeBudgetHoursPerWeek: data.profileData.timeBudgetHoursPerWeek || claudeProfileData.current.timeBudgetHoursPerWeek,
          hasTeam: data.profileData.hasTeam ?? claudeProfileData.current.hasTeam,
          // New fields
          ...(data.profileData.editedClipCount != null && { editedClipCount: data.profileData.editedClipCount } as any),
          ...(data.profileData.rawFootageDescription && { rawFootageDescription: data.profileData.rawFootageDescription } as any),
          ...(data.profileData.teamMembers && { teamMembers: data.profileData.teamMembers }),
        };
        
        // Store release data for galaxy/world creation
        if (data.profileData.releases && data.profileData.releases.length > 0) {
          claudeReleaseData.current = data.profileData.releases;
        }
      }

      // Increment question count for progress tracking
      setClaudeQuestionCount(prev => prev + 1);
      
      return {
        message: data.message,
        isComplete: data.isComplete,
      };
    } catch (error) {
      console.error('Claude chat error:', error);
      return {
        message: "Sorry, I had a moment there. Could you repeat that?",
        isComplete: false,
      };
    }
  };

  // Unified speak function that uses the configured engine
  const speak = (text: string, onEnd?: () => void) => {
    if (!speechEnabled) {
      console.log('[Speak] Speech disabled, skipping');
      onEnd?.();
      return;
    }

    console.log('[Speak] Starting TTS with engine:', TTS_ENGINE);
    
    if (TTS_ENGINE === 'elevenlabs') {
      speakWithElevenLabs(
        text,
        ELEVENLABS_VOICES[ELEVENLABS_VOICE].id,
        () => {
          console.log('[Speak] ElevenLabs started, isSpeaking = true');
          setIsSpeaking(true);
        },
        () => {
          console.log('[Speak] ElevenLabs ended, isSpeaking = false');
          setIsSpeaking(false);
          onEnd?.();
        }
      );
    } else {
      console.log('[Speak] Browser TTS starting, isSpeaking = true');
      setIsSpeaking(true);
      speakWithBrowser(text, () => {
        console.log('[Speak] Browser TTS ended, isSpeaking = false');
        setIsSpeaking(false);
        onEnd?.();
      });
    }
  };

  // Load voices on mount (needed for some browsers)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Voices may not be loaded immediately
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with first question (only after user clicks to start)
  useEffect(() => {
    if (!hasStarted) return; // Wait for user to click start
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const initChat = async () => {
      setIsInitializing(true);
      let welcomeMessage: string;
      
      if (USE_CLAUDE_CHAT) {
        // For Claude mode, get the first message from Claude
        try {
          const response = await fetch('/api/onboarding-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: `Hi, I'm ${creatorName}. I just signed up and I'm ready to get started.` }],
              creatorName,
            }),
          });
          const data = await response.json();
          welcomeMessage = data.message || `Hey ${creatorName}! 👋 I'm here to help you find your fans through social media. What genre best describes your music?`;
          setClaudeQuestionCount(1);
        } catch (error) {
          console.error('Failed to get Claude welcome:', error);
          welcomeMessage = `Hey ${creatorName}! 👋 I'm here to help you find your fans through social media. What genre best describes your music?`;
        }
      } else {
        // Use scripted welcome
        const flow = CONVERSATION_FLOW.welcome;
        welcomeMessage = typeof flow.question === 'function' 
          ? flow.question(collectedData, creatorName)
          : flow.question;
      }
      
      setIsInitializing(false);
      setMessages([{
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date(),
      }]);
      
      // Speak the welcome message
      if (speechEnabled) {
        if (TTS_ENGINE === 'elevenlabs') {
          speakWithElevenLabs(
            welcomeMessage,
            ELEVENLABS_VOICES[ELEVENLABS_VOICE].id,
            () => setIsSpeaking(true),
            () => setIsSpeaking(false)
          );
        } else {
          setIsSpeaking(true);
          speakWithBrowser(welcomeMessage, () => setIsSpeaking(false));
        }
      }
    };
    
    // Small delay for better UX
    setTimeout(initChat, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorName, hasStarted]);

  // Handle user response
  const handleUserResponse = async (response: string) => {
    if (isProcessing || currentStep === 'complete') return;
    
    setIsProcessing(true);
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: response,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Use Claude mode or scripted mode
    if (USE_CLAUDE_CHAT) {
      // Claude-powered conversation
      const claudeResponse = await handleClaudeChat(response);
      
      // Add Claude's response
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: claudeResponse.message,
        timestamp: new Date(),
      }]);

      // Speak the response
      speak(claudeResponse.message);

      // Check if complete
      if (claudeResponse.isComplete) {
        // Build final profile from Claude's extracted data
        const finalProfile: ArtistProfile & { releases?: any[] } = {
          userId: '',
          genre: claudeProfileData.current.genre || ['Unknown'],
          musicalInspiration: claudeProfileData.current.musicalInspiration,
          visualAesthetic: claudeProfileData.current.visualAesthetic || 'custom',
          visualStyleDescription: claudeProfileData.current.visualStyleDescription,
          hasBestPosts: claudeProfileData.current.hasBestPosts || false,
          bestPosts: claudeProfileData.current.bestPosts,
          platforms: (claudeProfileData.current.platforms as any) || ['instagram'],
          primaryPlatform: (claudeProfileData.current.primaryPlatform as any) || 'instagram',
          currentPostingFrequency: (claudeProfileData.current.currentPostingFrequency as any) || 'less_than_weekly',
          desiredPostingFrequency: (claudeProfileData.current.desiredPostingFrequency as any) || '2-3x_week',
          enjoyedContentFormats: claudeProfileData.current.enjoyedContentFormats || [],
          contentCreationLevel: 'beginner',
          equipment: (claudeProfileData.current.equipment as any) || 'phone',
          planningComfort: 'some_planning',
          timeBudgetHoursPerWeek: claudeProfileData.current.timeBudgetHoursPerWeek,
          preferredDays: claudeProfileData.current.preferredDays,
          existingAssets: claudeProfileData.current.existingAssets,
          hasTeam: claudeProfileData.current.hasTeam,
          teamMembers: claudeProfileData.current.teamMembers,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Include release data for galaxy/world creation
          releases: claudeReleaseData.current.length > 0 ? claudeReleaseData.current : undefined,
        };

        setCurrentStep('complete');
        
        // Complete after short delay
        setTimeout(() => {
          onComplete(finalProfile);
        }, 2000);
      }

      setIsProcessing(false);
      return;
    }

    // Scripted mode (original flow)
    // Process response and get next step
    const flow = CONVERSATION_FLOW[currentStep];
    
    // Update collected data
    let newData = collectedData;
    if (flow.processResponse) {
      newData = flow.processResponse(response, collectedData);
      setCollectedData(newData);
    }

    // Determine next step
    const nextStep = typeof flow.nextStep === 'function'
      ? flow.nextStep(response, newData)
      : flow.nextStep;

    // Small delay for natural feel
    await new Promise(resolve => setTimeout(resolve, 800));

    if (nextStep === 'complete') {
      // Build final profile and complete
      const finalProfile: ArtistProfile = {
        userId: '',
        genre: newData.genre || ['Unknown'],
        musicalInspiration: newData.musicalInspiration,
        visualAesthetic: newData.visualAesthetic || 'custom',
        visualStyleDescription: newData.visualStyleDescription,
        hasBestPosts: newData.hasBestPosts || false,
        bestPosts: newData.bestPosts,
        platforms: newData.platforms || ['instagram'],
        primaryPlatform: newData.primaryPlatform || 'instagram',
        currentPostingFrequency: newData.currentPostingFrequency || 'less_than_weekly',
        desiredPostingFrequency: newData.desiredPostingFrequency || '2-3x_week',
        enjoyedContentFormats: newData.enjoyedContentFormats || [],
        enjoyedContentFormatsOther: newData.enjoyedContentFormatsOther,
        contentCreationLevel: newData.contentCreationLevel || 'beginner',
        equipment: newData.equipment || 'phone',
        planningComfort: 'some_planning',
        timeBudgetHoursPerWeek: newData.timeBudgetHoursPerWeek,
        preferredDays: newData.preferredDays,
        existingAssets: newData.existingAssets,
        hasTeam: newData.hasTeam,
        teamMembers: newData.teamMembers,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add final message
      const finalFlow = CONVERSATION_FLOW.complete;
      const finalQuestion = typeof finalFlow.question === 'function'
        ? finalFlow.question(newData, creatorName)
        : finalFlow.question;
      
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: finalQuestion,
        timestamp: new Date(),
      }]);

      // Speak final message
      speak(finalQuestion);

      // Complete after short delay
      setTimeout(() => {
        onComplete(finalProfile);
      }, 1500);
    } else {
      // Get next question
      const nextFlow = CONVERSATION_FLOW[nextStep];
      const nextQuestion = typeof nextFlow.question === 'function'
        ? nextFlow.question(newData, creatorName)
        : nextFlow.question;

      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: nextQuestion,
        timestamp: new Date(),
      }]);

      // Speak the question
      speak(nextQuestion);

      setCurrentStep(nextStep);
    }

    setIsProcessing(false);
  };

  // Show form fallback
  if (showForm) {
    return (
      <div>
        <div className="mb-4">
          <Button
            onClick={() => setShowForm(false)}
            variant="outline"
            className="text-sm border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
          >
            ← Back to conversation
          </Button>
        </div>
        <EnhancedOnboardingForm 
          onComplete={onComplete}
          onSkip={onSkip}
        />
      </div>
    );
  }

  // Calculate progress
  // For Claude mode, estimate based on ~12 typical questions
  // For scripted mode, use the step index
  const ESTIMATED_CLAUDE_QUESTIONS = 12;
  const progress = USE_CLAUDE_CHAT
    ? Math.min(Math.round((claudeQuestionCount / ESTIMATED_CLAUDE_QUESTIONS) * 100), 100)
    : Math.round((Object.keys(CONVERSATION_FLOW).indexOf(currentStep) / (Object.keys(CONVERSATION_FLOW).length - 1)) * 100);

  // Show start screen before user interaction (required for browser audio)
  if (!hasStarted) {
    return (
      <Card className="w-full max-w-2xl mx-auto bg-black/95 border-yellow-500/50">
        <CardContent className="p-6">
          <div className="text-center py-12">
            <h2 className="text-3xl font-star-wars text-yellow-400 mb-4">
              Welcome, {creatorName}! 👋
            </h2>
            <p className="text-gray-300 mb-8 max-w-md mx-auto">
              Let's have a quick chat so I can understand your style and figure out the best way to help you find your fans.
            </p>
            <Button
              onClick={() => setHasStarted(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8 py-3 text-lg"
            >
              Start Conversation 🎤
            </Button>
            <p className="text-xs text-gray-500 mt-4">
              You can speak or type your responses
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-black/95 border-yellow-500/50">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-star-wars text-yellow-400">Let's Chat</h2>
            <p className="text-sm text-gray-400">Tell me about your music</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Speech Toggle - User can mute/unmute */}
            <button
              onClick={() => {
                if (speechEnabled) {
                  stopSpeaking();
                  setIsSpeaking(false);
                }
                setSpeechEnabled(!speechEnabled);
              }}
              className={`p-2 rounded-lg transition-colors ${
                speechEnabled 
                  ? 'bg-yellow-500/20 text-yellow-400' 
                  : 'bg-gray-800 text-gray-500'
              }`}
              title={speechEnabled ? 'Turn off voice' : 'Turn on voice'}
            >
              {isSpeaking ? (
                <span className="text-lg animate-pulse">🔊</span>
              ) : speechEnabled ? (
                <span className="text-lg">🔊</span>
              ) : (
                <span className="text-lg">🔇</span>
              )}
            </button>
            <Button
              onClick={() => setShowForm(true)}
              variant="outline"
              className="text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            >
              Show me a form instead
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Chat Messages */}
        <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
          {/* Loading state when initializing */}
          {isInitializing && messages.length === 0 && (
            <div className="flex justify-start">
              <div className="bg-gray-800/80 text-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <p className="text-sm text-yellow-400 animate-pulse">📞 Calling your manager...</p>
              </div>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-yellow-500/20 text-white rounded-br-md'
                    : 'bg-gray-800/80 text-gray-100 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-line">{message.content}</p>
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-800/80 text-gray-400 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Voice/Text Input */}
        {currentStep !== 'complete' && (
          <VoiceInput
            onTranscript={handleUserResponse}
            disabled={isProcessing || isSpeaking}
            autoSubmit={false}
            autoStartAfterDisabled={true}
            placeholder={isSpeaking ? "Listening to response..." : "Type your response or tap the mic to speak..."}
          />
        )}
      </CardContent>
    </Card>
  );
}

