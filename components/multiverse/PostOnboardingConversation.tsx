'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { ArtistProfile } from '@/types';
import { ScheduleWalkthrough } from './ScheduleWalkthrough';
import { EnhancedCalendar } from './EnhancedCalendar';

// Voice Input component (reuse from ConversationalOnboarding)
import dynamic from 'next/dynamic';
const VoiceInput = dynamic(
  () => import('./VoiceInput').then(mod => ({ default: mod.VoiceInput })),
  { ssr: false }
);

interface PostOnboardingConversationProps {
  creatorName: string;
  onboardingProfile: Partial<ArtistProfile> & {
    releases?: Array<{
      type: string;
      name: string;
      releaseDate: string;
      isReleased: boolean;
      songs: string[];
    }>;
    bestPostDescription?: string;
    existingAssetsDescription?: string;
    hasExistingAssets?: boolean;
    hasTeam?: boolean;
    teamMembers?: string;
    equipment?: string;
  };
  onComplete: (selectedStrategy: PostOnboardingStrategy) => void;
  skipToCalendar?: boolean; // Skip directly to working calendar (e.g., after OAuth)
}

export interface PostOnboardingStrategy {
  focusSong: string | null;
  focusType: 'upcoming_release' | 'recent_release' | 'audience_building' | 'custom';
  releaseDate?: string;
  agreedToPlan: boolean;
  customFocus?: string;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

type ConversationPhase = 
  | 'initial_thanks'
  | 'propose_plan'
  | 'await_agreement'
  | 'await_agreement_legacy'
  | 'ask_google_sync'
  | 'ask_alternative'
  | 'confirm_alternative'
  | 'plan_finalized'
  | 'transition_to_calendar';

type CalendarHighlight = 'none' | 'intro' | 'release_info' | 'posting_phase' | 'prep_phase' | 'complete';

// TTS Engine selection (developer toggle)
// Set to true to use ElevenLabs for natural voice (uses credits)
const USE_ELEVENLABS = false; // Switched to browser - ElevenLabs API key issue
const ELEVENLABS_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Bella
// Set to true to disable voice entirely (text only mode for faster testing)
const DISABLE_VOICE = false;

export function PostOnboardingConversation({
  creatorName,
  onboardingProfile,
  onComplete,
  skipToCalendar = false,
}: PostOnboardingConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<ConversationPhase>('initial_thanks');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false); // User must click to start (browser audio requirement)
  const [userInput, setUserInput] = useState('');
  const [strategy, setStrategy] = useState<PostOnboardingStrategy>({
    focusSong: null,
    focusType: 'audience_building',
    agreedToPlan: false,
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [showChatInput, setShowChatInput] = useState(false); // Only show chat at the end
  const [planFinalized, setPlanFinalized] = useState(false); // Show finalized view after agreement
  const [showWorkingCalendar, setShowWorkingCalendar] = useState(false); // Full calendar view after "Let's Get Started"
  const [calendarHighlight, setCalendarHighlight] = useState<CalendarHighlight>('none');
  const [currentSongName, setCurrentSongName] = useState<string>('');
  const [currentReleaseDate, setCurrentReleaseDate] = useState<string>('');
  const [walkthroughText, setWalkthroughText] = useState<string>(''); // Text shown during walkthrough
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if returning from Google OAuth or skipToCalendar prop
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const calendarConnected = urlParams.get('calendar_connected');
    const inProgress = localStorage.getItem('postOnboarding_inProgress');
    
    const shouldSkipToCalendar = skipToCalendar || (calendarConnected === 'true' && inProgress === 'true');
    
    if (shouldSkipToCalendar) {
      console.log('[PostOnboarding] Skipping to working calendar...');
      
      // Restore state from localStorage if available
      const savedSongName = localStorage.getItem('postOnboarding_songName') || '';
      const savedReleaseDate = localStorage.getItem('postOnboarding_releaseDate') || '';
      const savedStrategy = localStorage.getItem('postOnboarding_strategy');
      
      // Use saved values or defaults from profile
      const releases = onboardingProfile.releases || [];
      const targetRelease = releases.find(r => !r.isReleased) || releases[0];
      
      setCurrentSongName(savedSongName || targetRelease?.name || 'your music');
      setCurrentReleaseDate(savedReleaseDate || targetRelease?.releaseDate || '');
      
      if (savedStrategy) {
        try {
          setStrategy(JSON.parse(savedStrategy));
        } catch (e) {
          console.error('[PostOnboarding] Failed to parse saved strategy');
        }
      }
      
      // Clear localStorage
      localStorage.removeItem('postOnboarding_inProgress');
      localStorage.removeItem('postOnboarding_songName');
      localStorage.removeItem('postOnboarding_releaseDate');
      localStorage.removeItem('postOnboarding_strategy');
      
      // Clean up URL if needed
      if (calendarConnected) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      
      // Skip straight to working calendar
      setHasStarted(true);
      setShowCalendar(true);
      setPlanFinalized(true);
      setShowWorkingCalendar(true);
      
      // Show success message if coming from OAuth
      if (calendarConnected === 'true') {
        setMessages([{
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Google Calendar connected! I can see your schedule now. I've adjusted your tasks to work around your existing commitments. Let's get started! 🚀`,
        }]);
      }
    }
  }, [skipToCalendar, onboardingProfile.releases]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Analyze onboarding data to determine the best strategy
  const analyzeReleases = () => {
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const releases = onboardingProfile.releases || [];
    
    // Check for upcoming releases within 2 weeks
    const upcomingWithin2Weeks = releases.find(r => {
      if (r.isReleased || !r.releaseDate) return false;
      const releaseDate = new Date(r.releaseDate);
      return releaseDate >= now && releaseDate <= twoWeeksFromNow;
    });

    // Check for upcoming releases within ~1 month (for teaser content)
    const upcomingWithinMonth = releases.find(r => {
      if (r.isReleased || !r.releaseDate) return false;
      const releaseDate = new Date(r.releaseDate);
      return releaseDate > twoWeeksFromNow && releaseDate <= oneMonthFromNow;
    });

    // Check for recent releases (within 30 days)
    const recentRelease = releases.find(r => {
      if (!r.isReleased || !r.releaseDate) return false;
      const releaseDate = new Date(r.releaseDate);
      return releaseDate >= thirtyDaysAgo && releaseDate <= now;
    });

    // Get the next upcoming release (any)
    const nextUpcoming = releases
      .filter(r => !r.isReleased && r.releaseDate)
      .sort((a, b) => new Date(a.releaseDate!).getTime() - new Date(b.releaseDate!).getTime())[0];

    return {
      upcomingWithin2Weeks,
      upcomingWithinMonth,
      recentRelease,
      nextUpcoming,
    };
  };

  // Generate the initial message based on release analysis
  const generateInitialMessage = (): { message: string; proposedStrategy: PostOnboardingStrategy } => {
    const { upcomingWithin2Weeks, upcomingWithinMonth, recentRelease, nextUpcoming } = analyzeReleases();
    
    const thanksMessage = `Okay, that was a lot of questions! Thanks for hanging with me${creatorName ? `, ${creatorName}` : ''}. I feel like I know your vibe now. `;

    // Scenario 1: Upcoming release within 2 weeks
    if (upcomingWithin2Weeks) {
      const daysUntil = Math.ceil(
        (new Date(upcomingWithin2Weeks.releaseDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return {
        message: thanksMessage + 
          `So you've got "${upcomingWithin2Weeks.name}" dropping ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`} - that's coming up fast! ` +
          `Let's focus the next couple weeks on building some buzz for that. We'll create a few posts to get people excited before it drops. Sound good?`,
        proposedStrategy: {
          focusSong: upcomingWithin2Weeks.name,
          focusType: 'upcoming_release',
          releaseDate: upcomingWithin2Weeks.releaseDate ?? undefined,
          agreedToPlan: false,
        },
      };
    }

    // Scenario 2: Upcoming release within ~1 month (teaser content)
    if (upcomingWithinMonth) {
      const daysUntil = Math.ceil(
        (new Date(upcomingWithinMonth.releaseDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return {
        message: thanksMessage + 
          `I see you have "${upcomingWithinMonth.name}" coming out in about ${Math.round(daysUntil / 7)} weeks. ` +
          `That gives us some time to build anticipation with teaser posts. Let's spend the next 2 weeks filming and editing content that'll get your fans excited. Sound like a plan?`,
        proposedStrategy: {
          focusSong: upcomingWithinMonth.name,
          focusType: 'upcoming_release',
          releaseDate: upcomingWithinMonth.releaseDate ?? undefined,
          agreedToPlan: false,
        },
      };
    }

    // Scenario 3: Recent release (within 30 days)
    if (recentRelease) {
      const daysSince = Math.ceil(
        (Date.now() - new Date(recentRelease.releaseDate!).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        message: thanksMessage + 
          `You mentioned you released "${recentRelease.name}" ${daysSince < 7 ? 'just recently' : `about ${Math.round(daysSince / 7)} weeks ago`}. ` +
          `That's still fresh! Most songs don't really pick up steam until they've been out for a few weeks. ` +
          `Want to give it another push with some new content?`,
        proposedStrategy: {
          focusSong: recentRelease.name,
          focusType: 'recent_release',
          releaseDate: recentRelease.releaseDate ?? undefined,
          agreedToPlan: false,
        },
      };
    }

    // Scenario 4: No recent/upcoming releases - audience building
    if (nextUpcoming) {
      const daysUntil = Math.ceil(
        (new Date(nextUpcoming.releaseDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return {
        message: thanksMessage + 
          `Your next release "${nextUpcoming.name}" is about ${Math.round(daysUntil / 30)} months out. ` +
          `That's actually a great time to build your audience without the pressure of a drop. ` +
          `Want to focus on some content that shows who you are as an artist? We can start teasing the new music closer to release.`,
        proposedStrategy: {
          focusSong: null,
          focusType: 'audience_building',
          releaseDate: nextUpcoming.releaseDate ?? undefined,
          agreedToPlan: false,
        },
      };
    }

    // Fallback: No releases at all
    return {
      message: thanksMessage + 
        `Since you don't have anything dropping soon, this is actually a great time to build your audience. ` +
        `Would you rather promote an existing song, or focus on content that shows who you are as an artist?`,
      proposedStrategy: {
        focusSong: null,
        focusType: 'audience_building',
        agreedToPlan: false,
      },
    };
  };

  // TTS functions
  const speakWithElevenLabs = async (text: string, onEnd?: () => void) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: ELEVENLABS_VOICE }),
      });

      if (!response.ok) {
        console.error('[TTS] ElevenLabs error:', response.status);
        onEnd?.();
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        onEnd?.();
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      
      setIsSpeaking(true);
      await audio.play();
    } catch (error) {
      console.error('[TTS] Error:', error);
      setIsSpeaking(false);
      onEnd?.();
    }
  };

  const speakWithBrowser = (text: string, onEnd?: () => void) => {
    console.log('[TTS Browser] Speaking:', text.substring(0, 50) + '...');
    
    if (!('speechSynthesis' in window)) {
      console.warn('[TTS Browser] Speech synthesis not supported');
      setIsSpeaking(false);
      onEnd?.();
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Set speaking state immediately
    setIsSpeaking(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
      console.log('[TTS Browser] Speech started');
    };
    
    utterance.onend = () => {
      console.log('[TTS Browser] Speech ended');
      setIsSpeaking(false);
      onEnd?.();
    };
    
    utterance.onerror = (e) => {
      // "interrupted" is expected when chaining speech segments - not a real error
      if (e.error === 'interrupted') {
        console.log('[TTS Browser] Speech interrupted (expected during walkthrough)');
      } else {
        console.error('[TTS Browser] Speech error:', e.error);
      }
      setIsSpeaking(false);
      onEnd?.();
    };
    
    // Function to speak with available voices
    const speakNow = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log('[TTS Browser] Available voices:', voices.length);
      
      if (voices.length > 0) {
        // Try to find a good female voice
        const preferredVoice = voices.find(v => 
          v.name.includes('Samantha')
        ) || voices.find(v => 
          v.name.includes('Karen')
        ) || voices.find(v => 
          v.lang === 'en-US' && !v.name.includes('Male')
        ) || voices.find(v => 
          v.lang.startsWith('en')
        ) || voices[0];
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log('[TTS Browser] Using voice:', preferredVoice.name);
        }
      }
      
      // Chrome workaround: need to resume if paused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      
      window.speechSynthesis.speak(utterance);
      console.log('[TTS Browser] Speak command sent');
    };
    
    // Check if voices are already loaded
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speakNow();
    } else {
      // Wait for voices to load (Chrome loads them asynchronously)
      console.log('[TTS Browser] Waiting for voices to load...');
      
      const handleVoicesChanged = () => {
        console.log('[TTS Browser] Voices loaded via event');
        window.speechSynthesis.onvoiceschanged = null; // Remove listener
        speakNow();
      };
      
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      
      // Fallback: try speaking anyway after a short delay
      setTimeout(() => {
        const currentVoices = window.speechSynthesis.getVoices();
        if (currentVoices.length > 0 || !window.speechSynthesis.speaking) {
          console.log('[TTS Browser] Fallback: attempting to speak');
          window.speechSynthesis.onvoiceschanged = null;
          speakNow();
        }
      }, 300);
    }
  };

  const speak = (text: string, onEnd?: () => void) => {
    // Skip voice entirely for faster testing
    if (DISABLE_VOICE) {
      console.log('[TTS] Voice disabled, skipping speech');
      onEnd?.();
      return;
    }
    
    if (USE_ELEVENLABS) {
      speakWithElevenLabs(text, onEnd);
    } else {
      speakWithBrowser(text, onEnd);
    }
  };

  // Add assistant message and speak it
  const addAssistantMessage = (content: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content,
    };
    setMessages(prev => [...prev, newMessage]);
    speak(content);
  };

  // Speak and show text as walkthrough overlay (not in chat)
  const speakAndWait = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      setWalkthroughText(text);
      
      if (DISABLE_VOICE) {
        // If voice disabled, just wait a bit for reading
        setTimeout(resolve, 2500);
      } else {
        speak(text, resolve);
      }
    });
  };

  // Start the conversation with visual walkthrough
  const startConversation = async () => {
    setHasStarted(true);
    setIsLoading(true);
    
    // Analyze releases to get song info
    const { upcomingWithin2Weeks, upcomingWithinMonth, recentRelease, nextUpcoming } = analyzeReleases();
    const targetRelease = upcomingWithin2Weeks || upcomingWithinMonth || nextUpcoming;
    const songName = targetRelease?.name || 'your music';
    const releaseDate = targetRelease?.releaseDate || '';
    
    setCurrentSongName(songName);
    setCurrentReleaseDate(releaseDate);
    
    // Set strategy
    let focusType: PostOnboardingStrategy['focusType'] = 'audience_building';
    if (upcomingWithin2Weeks || upcomingWithinMonth) focusType = 'upcoming_release';
    else if (recentRelease) focusType = 'recent_release';
    
    setStrategy({
      focusSong: songName,
      focusType,
      releaseDate,
      agreedToPlan: false,
    });
    
    // Calculate weeks until release
    const weeksUntil = releaseDate 
      ? Math.round((new Date(releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))
      : 0;
    
    // Small delay then start the walkthrough
    await new Promise(r => setTimeout(r, 500));
    setIsLoading(false);
    setShowCalendar(true);
    
    // Step 1: Thanks and intro
    setCalendarHighlight('intro');
    await speakAndWait(`Okay, that was a lot of questions! Thanks for hanging with me${creatorName ? `, ${creatorName}` : ''}. I feel like I know your vibe now.`);
    
    await new Promise(r => setTimeout(r, 500));
    
    // Step 2: Release info (highlight release date on calendar)
    setCalendarHighlight('release_info');
    if (weeksUntil > 0) {
      await speakAndWait(`I see you have "${songName}" coming out in about ${weeksUntil} ${weeksUntil === 1 ? 'week' : 'weeks'}. That gives us some time to build anticipation.`);
    } else {
      await speakAndWait(`Let's focus on building your audience and getting your music heard.`);
    }
    
    await new Promise(r => setTimeout(r, 500));
    
    // Step 3: Posting phase explanation (highlight posting dates)
    setCalendarHighlight('posting_phase');
    await speakAndWait(`In around 2 weeks, we'll start posting. First with some audience-building content to introduce you, then we'll mix in teaser posts as we get closer to release.`);
    
    await new Promise(r => setTimeout(r, 500));
    
    // Step 4: Prep phase explanation (highlight prep tasks)
    setCalendarHighlight('prep_phase');
    await speakAndWait(`Here are some things you can do to start preparing. We'll plan your content, film over a couple days, then edit everything so it's ready to go.`);
    
    await new Promise(r => setTimeout(r, 500));
    
    // Step 5: Ask for agreement - NOW show the chat input
    setCalendarHighlight('complete');
    setWalkthroughText(''); // Clear walkthrough text
    setShowChatInput(true); // Show the chat input
    
    // Add the question to chat
    const questionMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `What do you think of the plan? Do you think you could stick to it?`,
    };
    setMessages([questionMessage]);
    speak(`What do you think of the plan? Do you think you could stick to it?`);
    
    setPhase('await_agreement');
  };

  // Check if user response indicates agreement
  const checkAgreement = (response: string): boolean => {
    const agreementPhrases = [
      'yes', 'yeah', 'yep', 'sure', 'sounds good', 'that works', 'let\'s do it',
      'okay', 'ok', 'good', 'perfect', 'great', 'love it', 'sounds like a plan',
      'i\'m down', 'let\'s go', 'that\'s a good plan', 'sounds great'
    ];
    const lowerResponse = response.toLowerCase();
    return agreementPhrases.some(phrase => lowerResponse.includes(phrase));
  };

  // Check if user wants something different
  const checkDisagreement = (response: string): boolean => {
    const disagreementPhrases = [
      'no', 'nah', 'not really', 'actually', 'i was thinking', 'what about',
      'can we', 'i\'d rather', 'different', 'something else', 'instead'
    ];
    const lowerResponse = response.toLowerCase();
    return disagreementPhrases.some(phrase => lowerResponse.includes(phrase));
  };

  // Handle user response
  const handleUserResponse = (response: string) => {
    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: response,
    };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');

    // Process based on current phase
    if (phase === 'await_agreement') {
      if (checkAgreement(response)) {
        // User agreed - ask about Google Calendar sync
        setStrategy(prev => ({ ...prev, agreedToPlan: true }));
        setPhase('ask_google_sync');
        
        setTimeout(() => {
          addAssistantMessage(
            `Perfect! One more thing - would you like to sync your Google Calendar? This helps me schedule tasks around your existing commitments so nothing overlaps. It only takes a second.`
          );
        }, 500);
        
        return;
      } else if (checkDisagreement(response)) {
        // User wants something different
        setPhase('ask_alternative');
        
        setTimeout(() => {
          addAssistantMessage(
            `No problem! Is there a different song you'd prefer to promote? Or would you rather focus on something else entirely?`
          );
        }, 500);
        return;
      }
    }
    
    // Handle Google Calendar sync response
    if (phase === 'ask_google_sync') {
      if (checkAgreement(response)) {
        // User wants to sync - save state and redirect to Google OAuth
        addAssistantMessage(`Great! Let me connect you to Google Calendar...`);
        
        // Save state to localStorage so we can restore after OAuth
        localStorage.setItem('postOnboarding_inProgress', 'true');
        localStorage.setItem('postOnboarding_songName', currentSongName);
        localStorage.setItem('postOnboarding_releaseDate', currentReleaseDate);
        localStorage.setItem('postOnboarding_strategy', JSON.stringify(strategy));
        
        setTimeout(() => {
          window.location.href = '/api/calendar/auth?return_url=' + encodeURIComponent(window.location.origin + window.location.pathname);
        }, 1500);
        
        return;
      } else {
        // User doesn't want to sync - proceed to finalized calendar
        setPhase('plan_finalized');
        setShowChatInput(false);
        
        addAssistantMessage(`No problem! You can always sync it later. Here's your finalized schedule. Let's get started! 🚀`);
        
        setTimeout(() => {
          setPlanFinalized(true);
        }, 2000);
        
        return;
      }
    }
    
    // Legacy handling for other phases (keeping for compatibility)
    if (phase === 'await_agreement_legacy') {
      if (checkAgreement(response)) {
        setStrategy(prev => ({ ...prev, agreedToPlan: true }));
        setPhase('transition_to_calendar');
        
        setTimeout(() => {
          addAssistantMessage(
            `Great! Let me show you what I'm thinking. Based on everything you told me - your style, your schedule, what's worked before - here's a rough calendar for the next 2 weeks. ` +
            `We'll spend this time filming and editing, then start posting.`
          );
          
          setTimeout(() => {
            onComplete({ ...strategy, agreedToPlan: true });
          }, 6000);
        }, 500);
      } else if (checkDisagreement(response)) {
        // User wants something different
        setPhase('ask_alternative');
        setTimeout(() => {
          addAssistantMessage(
            `No problem - is there a different song you'd prefer to promote? Or did you have something else in mind?`
          );
        }, 500);
      } else {
        // Unclear response - clarify
        setTimeout(() => {
          addAssistantMessage(
            `I want to make sure we're on the same page. Does that plan work for you, or would you like to take a different approach?`
          );
        }, 500);
      }
    } else if (phase === 'ask_alternative') {
      // User is explaining what they want instead
      setStrategy(prev => ({
        ...prev,
        focusType: 'custom',
        customFocus: response,
        agreedToPlan: true,
      }));
      setPhase('confirm_alternative');
      
      setTimeout(() => {
        addAssistantMessage(
          `Got it! Let's build a plan around that. I'll set up a calendar for the next 2 weeks and we can figure out the specific posts together.`
        );
        
        // After speaking, transition to calendar
        setTimeout(() => {
          onComplete({
            ...strategy,
            focusType: 'custom',
            customFocus: response,
            agreedToPlan: true,
          });
        }, 5000);
      }, 500);
    }
  };

  // Handle send
  const handleSend = () => {
    if (userInput.trim() && !isSpeaking) {
      handleUserResponse(userInput.trim());
    }
  };

  // Show "Continue" button before starting (required for browser audio)
  if (!hasStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-96 max-w-2xl mx-auto">
        <div className="text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-star-wars text-yellow-400 mb-4">
            Onboarding Complete!
          </h2>
          <p className="text-gray-300 text-lg mb-2">
            Great job, {creatorName}!
          </p>
          <p className="text-gray-400 mb-8">
            Now let's figure out what content to create over the next 2 weeks.
          </p>
          <Button
            onClick={startConversation}
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars text-lg rounded-lg"
          >
            Continue →
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-yellow-400 font-star-wars">Preparing your content strategy...</p>
        </div>
      </div>
    );
  }

  // FINALIZED VIEW - after user agrees
  if (planFinalized) {
    return (
      <div className="flex flex-col h-full w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-star-wars text-yellow-400 mb-2">
            ✨ Your Plan is Set!
          </h2>
          <p className="text-gray-300 text-lg">
            Here's your content schedule for the next month
          </p>
        </div>

        {/* Finalized Calendar */}
        <div className="flex-1">
          <EnhancedCalendar
            songName={currentSongName}
            releaseDate={currentReleaseDate}
            showGoogleSync={false}
            artistProfile={onboardingProfile as ArtistProfile}
            onTaskComplete={(taskId) => {
              console.log('[Finalized] Task completed:', taskId);
            }}
          />
        </div>

        {/* Next Steps */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 mb-4">
            Your first task: <span className="text-yellow-400 font-semibold">📋 Plan content ideas</span>
          </p>
          <Button
            onClick={() => {
              console.log('[PostOnboarding] Let\'s Get Started clicked - transitioning to galaxy view');
              onComplete({ ...strategy, agreedToPlan: true });
            }}
            className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars text-lg"
          >
            Let's Get Started →
          </Button>
        </div>
      </div>
    );
  }

  // WORKING CALENDAR VIEW - the main calendar interface after setup
  if (showWorkingCalendar) {
    return (
      <>
        {/* Backdrop - Click to close */}
        <div 
          className="fixed inset-0 bg-black/90 z-[60]"
          onClick={() => {
            console.log('[Calendar] Backdrop clicked - closing calendar');
            onComplete({ ...strategy, agreedToPlan: true });
          }}
        />
        
        {/* Calendar Container - Full screen modal */}
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="relative bg-gray-900 rounded-xl p-8 w-full max-w-7xl my-auto shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
          >
            {/* Close Button - Top Right */}
            <button
              onClick={() => {
                console.log('[Calendar] Close button clicked - transitioning to galaxy view');
                onComplete({ ...strategy, agreedToPlan: true });
              }}
              className="absolute top-6 right-6 px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm rounded-lg transition-all shadow-lg hover:shadow-xl z-20"
              aria-label="Close calendar"
            >
              CLOSE
            </button>

            {/* Calendar Title */}
            <div className="mb-6">
              <h1 className="text-3xl font-star-wars text-white mb-1">Snapshot Calendar</h1>
              <p className="text-gray-400 text-sm">Rabbit Season - All Worlds</p>
            </div>

            {/* Header Stats */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
              <div>
                <h2 className="text-xl font-star-wars text-yellow-400">
                  Your Schedule
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {currentSongName ? `Promoting: "${currentSongName}"` : 'Building your audience'}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Ambition Level</p>
                  <p className="text-yellow-400 font-star-wars text-lg">3 / 10</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Streak</p>
                  <p className="text-green-400 font-star-wars text-lg">🔥 0 days</p>
                </div>
              </div>
            </div>

            {/* Enhanced Calendar with Google Sync */}
            <div className="overflow-y-auto max-h-[calc(100vh-20rem)]">
              <EnhancedCalendar
                songName={currentSongName}
                releaseDate={currentReleaseDate}
                showGoogleSync={true}
                artistProfile={onboardingProfile as ArtistProfile}
                onTaskComplete={(taskId) => {
                  console.log('[Calendar] Task completed:', taskId);
                  // TODO: Update task state and adjust ambition/streak
                }}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-star-wars text-yellow-400 mb-2">
          Your Content Strategy
        </h2>
        <p className="text-gray-400 text-sm">
          Here's your roadmap for the next month
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Calendar Section with Walkthrough Text Overlay */}
        {showCalendar && (
          <div className="flex-1 relative">
            <ScheduleWalkthrough
              creatorName={creatorName}
              songName={currentSongName}
              releaseDate={currentReleaseDate}
              releaseStrategy={onboardingProfile?.releaseStrategy}
              releaseStrategyDescription={onboardingProfile?.releaseStrategyDescription}
              releases={(onboardingProfile?.releases || []).map(r => ({ title: r.name, releaseDate: r.releaseDate || '', type: r.type }))}
              highlightPhase={calendarHighlight}
            />
            
            {/* Walkthrough text overlay - shown during walkthrough */}
            {walkthroughText && !showChatInput && (
              <div className="mt-6 flex justify-center">
                <div className="bg-gray-900/90 border border-yellow-500/30 rounded-lg p-4 max-w-2xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🎙️</span>
                    <div>
                      <span className="text-yellow-400 text-xs font-star-wars block mb-1">
                        Your Manager
                      </span>
                      <p className="text-gray-100 text-sm leading-relaxed">
                        {walkthroughText}
                      </p>
                    </div>
                  </div>
                  {isSpeaking && (
                    <div className="mt-2 flex items-center justify-center gap-1">
                      <div className="w-1 h-3 bg-yellow-500 rounded animate-pulse"></div>
                      <div className="w-1 h-4 bg-yellow-500 rounded animate-pulse delay-75"></div>
                      <div className="w-1 h-2 bg-yellow-500 rounded animate-pulse delay-150"></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Section - only shown when ready for input */}
        {showChatInput && (
          <div className="mt-6 max-w-2xl mx-auto w-full">
            {/* Messages */}
            <div className="space-y-3 mb-4 p-4 bg-gray-900/50 rounded-lg border border-yellow-500/20">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-yellow-500/20 text-yellow-100 border border-yellow-500/30'
                        : 'bg-gray-800 text-gray-100 border border-gray-700'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <span className="text-yellow-400 text-xs font-star-wars block mb-1">
                        🎙️ Your Manager
                      </span>
                    )}
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="space-y-3">
              {/* Voice Input */}
              <VoiceInput
                onTranscript={(text) => setUserInput(text)}
                disabled={isSpeaking}
                autoStartAfterDisabled={true}
              />
              
              {/* Text input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isSpeaking && handleSend()}
                  placeholder={isSpeaking ? "Listening..." : "Type your response..."}
                  disabled={isSpeaking}
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 disabled:opacity-50"
                />
                <Button
                  onClick={handleSend}
                  disabled={!userInput.trim() || isSpeaking}
                  className="px-6 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars disabled:opacity-50"
                >
                  Send
                </Button>
              </div>
              
              {/* Status indicator */}
              <div className="text-xs text-gray-500 text-center">
                {isSpeaking ? '🔊 Speaking...' : '🎤 Ready for your response'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

