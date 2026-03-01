'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CreatorOnboardingForm } from '@/components/multiverse/CreatorOnboardingForm';
import { LoadingScreen } from '@/components/multiverse/LoadingScreen';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { loadAccount, loadUniverse, loadGalaxy, saveUniverse, saveGalaxy, saveWorld, loadCurrentGalaxyId, saveCurrentGalaxyId, deleteGalaxy, deleteWorld, clearAllData, saveAccount } from '@/lib/storage';
import { isTestUser, getTestUserProfile } from '@/lib/test-data';
import { getMyTeams } from '@/lib/team';
import type { CreatorAccountData, Universe, Galaxy, World, ArtistProfile, GalaxyEntry } from '@/types';

// Dynamically import heavy components to improve compilation time
const ConversationalOnboarding = dynamic(
  () => import('@/components/multiverse/ConversationalOnboarding').then(mod => ({ default: mod.ConversationalOnboarding })),
  { ssr: false }
);

const PostOnboardingConversation = dynamic(
  () => import('@/components/multiverse/PostOnboardingConversation').then(mod => ({ default: mod.PostOnboardingConversation })),
  { ssr: false }
);

// Use a wrapper component that dynamically imports GalaxyView
// This creates an extra layer of isolation to prevent Next.js from analyzing Three.js
const GalaxyViewWrapper = dynamic(
  () => import('@/components/multiverse/GalaxyViewWrapper').then(mod => ({ default: mod.GalaxyViewWrapper })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-screen bg-black text-white">
        <div className="text-center">
          <div className="text-yellow-400 font-star-wars text-xl">Loading galaxy...</div>
        </div>
      </div>
    )
  }
);

// EmptyUniverseView still disabled - will enable after GalaxyView is confirmed working

// ============================================================================
// DEV MODE: Developer testing flags
// ============================================================================
const DEV_SKIP_ONBOARDING = false; // Set to true to skip to galaxy view with test data
const DEV_SKIP_TO_POST_ONBOARDING = false; // Set to true to test post-onboarding conversation

// Julian Kenji's onboarding data (from actual user test conversation)
const DEV_TEST_DATA = {
  creatorName: 'Julian kenji',
  email: 'julian@test.com',
  // Onboarding profile data
  onboardingProfile: {
    genre: ['indie pop'],
    musicalInspiration: ['Dominic Fike'],
    visualAesthetic: 'effortlessly cool',
    visualStyleDescription: 'Dominic Fike inspired aesthetic - effortlessly cool vibe',
    releases: [
      {
        type: 'album',
        name: 'Rabbit Season',
        releaseDate: '2026-01-30', // Released yesterday - recent release scenario
        isReleased: true,
        songs: ['blur', 'psychedelic', 'I love you so much', 'cliche', 'freak', 'high demand', 'me and you', 'melody', "what's up"]
      }
    ],
    hasBestPosts: true,
    bestPostDescription: 'voiceover video about near-death experience and how it led to the genesis of the album - worked because of personal storytelling',
    platforms: ['instagram', 'tiktok'] as ('instagram' | 'tiktok')[],
    currentPostingFrequency: 'less_than_weekly' as const,
    desiredPostingFrequency: '3-4x_week' as const,
    enjoyedContentFormats: ['artsy performance videos', 'jumping to music with cool editing'],
    equipment: 'Canon DSLR, iPhone camera, tripod',
    timeBudgetHoursPerWeek: 7,
    preferredDays: ['saturday', 'sunday'],
    hasExistingAssets: false,
    existingAssetsDescription: 'none currently, will film new content',
    hasTeam: true,
    teamMembers: 'videographer friends who can help shoot ideas',
  } as any,
  // Legacy release data for backward compatibility
  releases: [
    {
      type: 'album',
      name: 'Rabbit Season',
      releaseDate: '2026-01-30',
      isReleased: true,
      songs: ['blur', 'psychedelic', 'I love you so much', 'cliche', 'freak', 'high demand', 'me and you', 'melody', "what's up"]
    }
  ]
};
// ============================================================================

/** Load all galaxies from teams the user belongs to (excluding their own universe) */
async function loadAllTeamGalaxyEntries(): Promise<GalaxyEntry[]> {
  const entries: GalaxyEntry[] = [];
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return entries;

    // Get all teams this user is a member of
    const { data: memberRows } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    if (!memberRows || memberRows.length === 0) return entries;

    const teamIds = memberRows.map(r => r.team_id);

    // For each team, get the universe_id and team name
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name, universe_id')
      .in('id', teamIds);

    if (!teamRows) return entries;

    // Load universe + galaxies for each unique universe_id
    const seenUniverseIds = new Set<string>();
    for (const team of teamRows) {
      if (!team.universe_id || seenUniverseIds.has(team.universe_id)) continue;
      seenUniverseIds.add(team.universe_id);

      try {
        const { data: universeData } = await supabase
          .from('universes')
          .select('id, name, creator_id, created_at')
          .eq('id', team.universe_id)
          .single();

        if (!universeData) continue;

        const { data: galaxiesData } = await supabase
          .from('galaxies')
          .select('id, name, universe_id, release_date, visual_landscape, created_at')
          .eq('universe_id', team.universe_id)
          .order('created_at', { ascending: true });

        if (!galaxiesData) continue;

        const galaxies: Galaxy[] = [];
        for (const gd of galaxiesData) {
          const galaxy = await loadGalaxy(gd.id);
          if (galaxy) galaxies.push(galaxy);
        }

        const universe: Universe = {
          id: universeData.id,
          name: universeData.name,
          creatorId: universeData.creator_id,
          createdAt: universeData.created_at,
          galaxies,
        };

        // Determine artist name from the universe name (e.g., "The Kiss Bangverse" → "Kiss Bang")
        const artistName = universeData.name.replace(/^The\s+/i, '').replace(/verse$/i, '').trim() || team.name;

        // Check if this is the user's own universe (admin vs member)
        const isOwnUniverse = universeData.creator_id === user.id;

        for (const galaxy of galaxies) {
          entries.push({ galaxy, universe, isAdmin: isOwnUniverse, artistName });
        }
      } catch (e) {
        console.warn('[loadAllTeamGalaxyEntries] Error loading universe:', e);
      }
    }
  } catch (e) {
    console.warn('[loadAllTeamGalaxyEntries] Error:', e);
  }
  return entries;
}

/** Load the universe for an invited team member (they don't own a universe, they're part of a team) */
async function loadTeamUniverse(): Promise<Universe | null> {
  let universeId: string | null = null;

  // Strategy 1: Query team membership via Supabase
  try {
    const teams = await getMyTeams();
    if (teams && teams.length > 0) {
      universeId = teams[0].universeId;
      console.log('[loadTeamUniverse] Found team via Supabase:', teams[0].name, 'universe:', universeId);
    }
  } catch (err) {
    console.warn('[loadTeamUniverse] Supabase team query failed:', err);
  }

  // Strategy 2: Query team_members directly (bypasses teams RLS issue)
  if (!universeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // team_members SELECT policy allows user_id = auth.uid()
        const { data: memberRows } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .limit(1);
        
        if (memberRows && memberRows.length > 0) {
          const teamId = memberRows[0].team_id;
          console.log('[loadTeamUniverse] Found team_id via direct query:', teamId);
          
          // Try to get universe_id from teams table
          const { data: teamRow } = await supabase
            .from('teams')
            .select('universe_id')
            .eq('id', teamId)
            .single();
          
          if (teamRow?.universe_id) {
            universeId = teamRow.universe_id;
            console.log('[loadTeamUniverse] Found universe via team_members→teams:', universeId);
          }
        }
      }
    } catch (err) {
      console.warn('[loadTeamUniverse] Direct team_members query failed:', err);
    }
  }

  // Strategy 3: Fallback to localStorage (saved during invite acceptance)
  if (!universeId && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('multiverse_team_info');
      if (stored) {
        const teamInfo = JSON.parse(stored);
        if (teamInfo.universeId) {
          universeId = teamInfo.universeId;
          console.log('[loadTeamUniverse] Found universe via localStorage:', universeId);
        }
      }
    } catch (e) {
      console.warn('[loadTeamUniverse] Error reading localStorage:', e);
    }
  }

  if (!universeId) {
    console.log('[loadTeamUniverse] No team universe found');
    return null;
  }

  try {
    // Load the universe directly from Supabase
    const { data: universeData, error: universeError } = await supabase
      .from('universes')
      .select('id, name, creator_id, created_at')
      .eq('id', universeId)
      .single();
    
    if (universeError || !universeData) {
      console.warn('[loadTeamUniverse] Could not load universe from Supabase:', universeError);
      return null;
    }
    
    // Load galaxies for this universe
    const { data: galaxiesData } = await supabase
      .from('galaxies')
      .select('id, name, universe_id, release_date, visual_landscape, created_at')
      .eq('universe_id', universeId)
      .order('created_at', { ascending: true });
    
    const galaxies: Galaxy[] = [];
    if (galaxiesData) {
      for (const gd of galaxiesData) {
        const galaxy = await loadGalaxy(gd.id);
        if (galaxy) galaxies.push(galaxy);
      }
    }
    
    const universe: Universe = {
      id: universeData.id,
      name: universeData.name,
      creatorId: universeData.creator_id,
      createdAt: universeData.created_at,
      galaxies,
    };
    
    console.log('[loadTeamUniverse] ✅ Loaded team universe with', galaxies.length, 'galaxies');
    return universe;
  } catch (err) {
    console.warn('[loadTeamUniverse] Error loading universe:', err);
    return null;
  }
}

export default function Home() {
  const [account, setAccount] = useState<CreatorAccountData | null>(null);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [currentGalaxy, setCurrentGalaxy] = useState<Galaxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showEnhancedOnboarding, setShowEnhancedOnboarding] = useState(false);
  const [showPostOnboarding, setShowPostOnboarding] = useState(false);
  const [skipToCalendar, setSkipToCalendar] = useState(false);
  // Multi-galaxy navigation
  const [allGalaxyEntries, setAllGalaxyEntries] = useState<GalaxyEntry[]>([]);
  const [activeGalaxyIdx, setActiveGalaxyIdx] = useState(0);

  // Build allGalaxyEntries whenever universe or currentGalaxy changes
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const buildEntries = async () => {
      try {
        // Start with own universe galaxies (admin)
        const adminEntries: GalaxyEntry[] = [];
        if (universe) {
          const artistName = universe.name.replace(/^The\s+/i, '').replace(/verse$/i, '').trim() || account?.creatorName || 'My Galaxy';
          for (const g of universe.galaxies) {
            adminEntries.push({ galaxy: g, universe, isAdmin: true, artistName });
          }
        }

        // Load team galaxies (non-admin), excluding own universe
        const teamEntries = await loadAllTeamGalaxyEntries();
        // Deduplicate: skip any galaxy that is already in the admin entries
        const ownGalaxyIds = new Set(adminEntries.map(e => e.galaxy.id));
        const filteredTeamEntries = teamEntries.filter(e => !ownGalaxyIds.has(e.galaxy.id));

        const combined = [...adminEntries, ...filteredTeamEntries];
        if (combined.length === 0) return;

        // Determine best active index:
        // 1. Admin galaxies come first so if user has own galaxy, default to index 0
        // 2. If user has no admin galaxy, use last_active_galaxy_id
        const lastActiveId = typeof window !== 'undefined' ? localStorage.getItem('last_active_galaxy_id') : null;
        let bestIdx = 0;
        if (currentGalaxy) {
          const found = combined.findIndex(e => e.galaxy.id === currentGalaxy.id);
          if (found >= 0) bestIdx = found;
        } else if (lastActiveId) {
          const found = combined.findIndex(e => e.galaxy.id === lastActiveId);
          if (found >= 0) bestIdx = found;
        }

        setAllGalaxyEntries(combined);
        setActiveGalaxyIdx(bestIdx);
      } catch (e) {
        console.warn('[buildEntries] Error building galaxy entries:', e);
      }
    };

    buildEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe?.id, currentGalaxy?.id]);

  // Load data on mount
  useEffect(() => {
    const initializeApp = async () => {
      console.log('[Initialize] Starting app initialization...');
      setIsInitializing(true);
      
      // Check if returning from Google OAuth
      const urlParams = new URLSearchParams(window.location.search);
      const isReturningFromOAuth = urlParams.get('calendar_connected') === 'true';
      const hasOAuthState = localStorage.getItem('postOnboarding_inProgress') === 'true';
      
      // Handle normal OAuth return (not in dev mode)
      if (isReturningFromOAuth && hasOAuthState && !DEV_SKIP_TO_POST_ONBOARDING) {
        console.log('[OAuth Return] 🔄 User returning from Google Calendar OAuth...');
        // Clear the URL param
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Load the actual user's account from localStorage/Supabase
        const loadedAccount = await loadAccount();
        if (loadedAccount) {
          console.log('[OAuth Return] ✅ ACCOUNT LOADED AFTER OAUTH:', loadedAccount.creatorName);
          console.log('[OAuth Return] Onboarding complete:', loadedAccount.onboardingComplete);
          console.log('[OAuth Return] Has profile data:', !!loadedAccount.onboardingProfile);
          setAccount(loadedAccount);
          setSkipToCalendar(true); // Skip to calendar since they already did the walkthrough
          setShowPostOnboarding(true);
          setIsInitializing(false);
          setIsLoading(false);
          return;
        } else {
          console.warn('[OAuth Return] ⚠️ No account found after OAuth');
        }
      }
      
      // DEV MODE: Skip directly to enhanced calendar for testing
      if (DEV_SKIP_TO_POST_ONBOARDING) {
        console.log('[DEV MODE] Skipping directly to enhanced calendar view...');
        
        // Always skip to calendar in dev mode
        setSkipToCalendar(true);
        
        // Create test account with onboarding data
        const testAccount: CreatorAccountData = {
          creatorName: DEV_TEST_DATA.creatorName,
          email: DEV_TEST_DATA.email,
          password: 'test123',
          userType: 'artist',
          onboardingComplete: true,
          onboardingProfile: DEV_TEST_DATA.onboardingProfile,
        };
        setAccount(testAccount);
        setShowPostOnboarding(true);
        setIsInitializing(false);
        setIsLoading(false);
        return;
      }
      
      // DEV MODE: Skip onboarding and create test data
      if (DEV_SKIP_ONBOARDING) {
        console.log('[DEV MODE] Skipping onboarding, creating test data...');
        
        // Check if we already have data
        const existingAccount = await loadAccount();
        const existingUniverse = await loadUniverse();
        
        if (existingAccount && existingUniverse && existingUniverse.galaxies.length > 0) {
          console.log('[DEV MODE] Data already exists, loading...');
          setAccount(existingAccount);
          setUniverse(existingUniverse);
          
          const savedGalaxyId = loadCurrentGalaxyId();
          if (savedGalaxyId) {
            const galaxy = existingUniverse.galaxies.find(g => g.id === savedGalaxyId);
            if (galaxy) setCurrentGalaxy(galaxy);
          } else if (existingUniverse.galaxies.length > 0) {
            setCurrentGalaxy(existingUniverse.galaxies[0]);
          }
        } else {
          // Create test account
          const testAccount: CreatorAccountData = {
            creatorName: DEV_TEST_DATA.creatorName,
            email: DEV_TEST_DATA.email,
            password: '',
            userType: 'artist',
          };
          await saveAccount(testAccount);
          setAccount(testAccount);
          
          // Create universe with galaxies from test data
          const newUniverse: Universe = {
            id: `universe-${Date.now()}`,
            name: `The ${DEV_TEST_DATA.creatorName}verse`,
            creatorId: `dev-creator-${Date.now()}`,
            createdAt: new Date().toISOString(),
            galaxies: [],
          };
          
          // Create galaxies and worlds from releases
          for (const release of DEV_TEST_DATA.releases) {
            const newGalaxy: Galaxy = {
              id: `galaxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: release.name,
              universeId: newUniverse.id,
              releaseDate: release.releaseDate,
              visualLandscape: { images: [], colorPalette: [] },
              worlds: [],
              createdAt: new Date().toISOString(),
            };
            
            for (const songName of release.songs) {
              const worldColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
              const newWorld: World = {
                id: `world-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: songName,
                galaxyId: newGalaxy.id,
                releaseDate: release.releaseDate,
                color: worldColor,
                visualLandscape: { images: [], colorPalette: [worldColor] },
                isPublic: false,
                isReleased: release.isReleased,
                createdAt: new Date().toISOString(),
              };
              newGalaxy.worlds.push(newWorld);
              await saveWorld(newWorld, newGalaxy.id);
            }
            
            await saveGalaxy(newGalaxy, newUniverse.id);
            newUniverse.galaxies.push(newGalaxy);
          }
          
          await saveUniverse(newUniverse);
          setUniverse(newUniverse);
          
          if (newUniverse.galaxies.length > 0) {
            saveCurrentGalaxyId(newUniverse.galaxies[0].id);
            setCurrentGalaxy(newUniverse.galaxies[0]);
          }
          
          console.log('[DEV MODE] Created test data:', newUniverse.galaxies.length, 'galaxies');
        }
        
        setIsInitializing(false);
        setIsLoading(false);
        return;
      }
      
      try {
        // Check for Supabase session
        if (isSupabaseConfigured()) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // User is logged in, load their data
            let loadedAccount = await loadAccount();
            // Only proceed if we actually have an account
            if (loadedAccount && loadedAccount.creatorName) {
              // Auto-populate Julian Kenji account with onboarding data if incomplete or missing
              if ((loadedAccount.creatorName === 'Julian kenji' || loadedAccount.creatorName === 'Julian Kenji') && (!loadedAccount.onboardingComplete || !loadedAccount.onboardingProfile)) {
                console.log('[Initialize] 🎵 Auto-populating Julian Kenji account with onboarding data from completed conversation...');
                const julianOnboardingData = {
                  genre: ["indie pop"],
                  musicalInspiration: ["Dominic Fike"],
                  visualAesthetic: "effortlessly cool",
                  visualStyleDescription: "Dominic Fike inspired aesthetic - effortlessly cool vibe",
                  releases: [
                    {
                      type: "album",
                      name: "Rabbit Season",
                      releaseDate: "2026-01-30", // Released yesterday (from the conversation)
                      isReleased: true,
                      songs: ["blur", "psychedelic", "I love you so much", "cliche", "freak", "high demand", "me and you", "melody", "what's up"]
                    }
                  ],
                  hasBestPosts: true,
                  bestPostDescription: "voiceover video about near-death experience and how it led to the genesis of the album - worked because of personal storytelling",
                  platforms: ["instagram", "tiktok"],
                  currentPostingFrequency: "couple times a week",
                  desiredPostingFrequency: "3-4x_week",
                  enjoyedContentFormats: ["artsy performance videos", "jumping to music with cool editing"],
                  equipment: "Canon DSLR, iPhone camera, tripod",
                  timeBudgetHoursPerWeek: 7,
                  preferredDays: ["saturday", "sunday"],
                  hasExistingAssets: false,
                  existingAssetsDescription: "none currently, will film new content",
                  hasTeam: true,
                  teamMembers: "videographer friends who can help shoot ideas",
                };
                
                loadedAccount = {
                  ...loadedAccount,
                  onboardingComplete: true,
                  onboardingProfile: julianOnboardingData as any,
                };
                await saveAccount(loadedAccount);
                setAccount(loadedAccount);
                console.log('[Initialize] ✅ Julian Kenji account populated and marked complete');
                
                // Trigger post-onboarding
                setShowPostOnboarding(true);
                setIsInitializing(false);
                setIsLoading(false);
                return;
              }
              
              // Auto-populate Leon Tax account with onboarding data if incomplete or missing
              if (loadedAccount.creatorName === 'Leon Tax' && (!loadedAccount.onboardingComplete || !loadedAccount.onboardingProfile)) {
                console.log('[Initialize] Auto-populating Leon Tax account with onboarding data from completed conversation...');
                // Use data from the actual completed conversation
                const leonOnboardingData = {
                  genre: ["indie pop"],
                  musicalInspiration: ["Dominic Fike", "Bon Iver"],
                  visualAesthetic: "dreamy atmospheric",
                  visualStyleDescription: "aesthetic performance shots with atmospheric elements",
                  releases: [
                    {
                      type: "single",
                      name: "will I find you",
                      releaseDate: "2025-03-01",
                      isReleased: false,
                      songs: ["will I find you"]
                    }
                  ],
                  hasBestPosts: true,
                  bestPostDescription: "Performance shot with Snapchat filter got 1200 views, 40 likes, 9 comments - worked because it showed authentic performance with visual enhancement",
                  platforms: ["instagram", "tiktok"],
                  currentPostingFrequency: "none",
                  desiredPostingFrequency: "2-3x_week",
                  enjoyedContentFormats: ["visually aesthetic performance shots"],
                  equipment: "iPhone, camcorder, Canon DSLR",
                  timeBudgetHoursPerWeek: 6,
                  preferredDays: ["friday", "saturday", "sunday"],
                  hasExistingAssets: true,
                  existingAssetsDescription: "Yosemite camcorder footage for next single promotion",
                  hasTeam: true,
                  teamMembers: "girlfriend (shoot/edit), roommate Julian (shooting ideas)",
                };
                
              loadedAccount = {
                ...loadedAccount,
                onboardingComplete: true,
                onboardingProfile: leonOnboardingData as any,
              };
              await saveAccount(loadedAccount);
              setAccount(loadedAccount);
              console.log('[Initialize] Leon Tax account populated and marked complete');
              
              // Create universe with galaxies/worlds from releases
              setIsLoading(true);
              try {
                let existingUniverse = await loadUniverse();
                
                if (!existingUniverse) {
                  let creatorId = `creator-${Date.now()}`;
                  if (isSupabaseConfigured()) {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user?.id) creatorId = user.id;
                    } catch (e) {}
                  }
                  
                  const newUniverse: Universe = {
                    id: `universe-${Date.now()}`,
                    name: `The ${loadedAccount.creatorName}verse`,
                    creatorId,
                    createdAt: new Date().toISOString(),
                    galaxies: [],
                  };
                  await saveUniverse(newUniverse);
                  existingUniverse = newUniverse;
                }
                
                // Create galaxies/worlds from releases
                if (leonOnboardingData.releases && leonOnboardingData.releases.length > 0) {
                  let updatedUniverse = { ...existingUniverse };
                  
                  for (const release of leonOnboardingData.releases) {
                    if (!release || !release.name) continue;
                    
                    const newGalaxy: Galaxy = {
                      id: `galaxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      name: release.name,
                      universeId: updatedUniverse.id,
                      releaseDate: release.releaseDate,
                      visualLandscape: { images: [], colorPalette: [] },
                      worlds: [],
                      createdAt: new Date().toISOString(),
                    };
                    
                    const songs = release.songs && release.songs.length > 0 ? release.songs : [release.name];
                    for (const songName of songs) {
                      if (!songName) continue;
                      const worldColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
                      const newWorld: World = {
                        id: `world-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: songName,
                        galaxyId: newGalaxy.id,
                        releaseDate: release.releaseDate || new Date().toISOString().split('T')[0],
                        color: worldColor,
                        visualLandscape: { images: [], colorPalette: [worldColor] },
                        isPublic: false,
                        isReleased: release.isReleased || false,
                        createdAt: new Date().toISOString(),
                      };
                      newGalaxy.worlds.push(newWorld);
                      await saveWorld(newWorld, newGalaxy.id);
                    }
                    
                    await saveGalaxy(newGalaxy, updatedUniverse.id);
                    updatedUniverse.galaxies.push(newGalaxy);
                  }
                  
                  await saveUniverse(updatedUniverse);
                  setUniverse(updatedUniverse);
                  
                  if (updatedUniverse.galaxies.length > 0) {
                    saveCurrentGalaxyId(updatedUniverse.galaxies[0].id);
                    setCurrentGalaxy(updatedUniverse.galaxies[0]);
                  }
                } else {
                  setUniverse(existingUniverse);
                }
              } catch (error) {
                console.error('[Initialize] Error creating universe for Leon Tax:', error);
                const fallbackUniverse = await loadUniverse();
                if (fallbackUniverse) setUniverse(fallbackUniverse);
              } finally {
                setIsLoading(false);
              }
              
              return; // Exit early
            }
              
              setAccount(loadedAccount);
              console.log('[Initialize] Generic account handler for:', loadedAccount.creatorName);
              console.log('[Initialize] Onboarding complete:', loadedAccount.onboardingComplete);
              console.log('[Initialize] Has onboarding profile:', !!loadedAccount.onboardingProfile);
              
              // Check if onboarding is complete
              if (!loadedAccount.onboardingComplete) {
                // Show onboarding to resume
                console.log('[Initialize] Onboarding not complete, showing enhanced onboarding');
                setShowEnhancedOnboarding(true);
              } else {
                // Onboarding complete, skip onboarding and go straight to universe
                // If we have onboarding profile data, create universe/galaxies from it
                if (loadedAccount.onboardingProfile?.releases && loadedAccount.onboardingProfile.releases.length > 0) {
                  setIsLoading(true);
                  console.log('[Initialize] Loading universe for returning user...');
                  try {
                    let existingUniverse = await loadUniverse();
                    
                    if (!existingUniverse) {
                      let creatorId = `creator-${Date.now()}`;
                      if (isSupabaseConfigured()) {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (user?.id) creatorId = user.id;
                        } catch (e) {}
                      }
                      
                      const newUniverse: Universe = {
                        id: `universe-${Date.now()}`,
                        name: `The ${loadedAccount.creatorName}verse`,
                        creatorId,
                        createdAt: new Date().toISOString(),
                        galaxies: [],
                      };
                      await saveUniverse(newUniverse);
                      existingUniverse = newUniverse;
                    }
                    
                    // Create galaxies/worlds from releases if they don't exist
                    if (existingUniverse.galaxies.length === 0 && loadedAccount.onboardingProfile.releases) {
                      let updatedUniverse = { ...existingUniverse };
                      
                      for (const release of loadedAccount.onboardingProfile.releases) {
                        if (!release || !release.name) continue;
                        
                        const newGalaxy: Galaxy = {
                          id: `galaxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          name: release.name,
                          universeId: updatedUniverse.id,
                          releaseDate: release.releaseDate || undefined,
                          visualLandscape: { images: [], colorPalette: [] },
                          worlds: [],
                          createdAt: new Date().toISOString(),
                        };
                        
                        const songs = release.songs && release.songs.length > 0 ? release.songs : [release.name];
                        for (const songName of songs) {
                          if (!songName) continue;
                          const worldColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
                          const newWorld: World = {
                            id: `world-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            name: songName,
                            galaxyId: newGalaxy.id,
                            releaseDate: release.releaseDate || new Date().toISOString().split('T')[0],
                            color: worldColor,
                            visualLandscape: { images: [], colorPalette: [worldColor] },
                            isPublic: false,
                            isReleased: release.isReleased || false,
                            createdAt: new Date().toISOString(),
                          };
                          newGalaxy.worlds.push(newWorld);
                          try {
                            await saveWorld(newWorld, newGalaxy.id);
                          } catch (error) {
                            console.warn('[Initialize] Error saving world, continuing:', error);
                          }
                        }
                        
                        await saveGalaxy(newGalaxy, updatedUniverse.id);
                        updatedUniverse.galaxies.push(newGalaxy);
                      }
                      
                      await saveUniverse(updatedUniverse);
                      setUniverse(updatedUniverse);
                      
                      if (updatedUniverse.galaxies.length > 0) {
                        saveCurrentGalaxyId(updatedUniverse.galaxies[0].id);
                        setCurrentGalaxy(updatedUniverse.galaxies[0]);
                      }
                    } else {
                      setUniverse(existingUniverse);
                      const savedGalaxyId = loadCurrentGalaxyId();
                      if (savedGalaxyId) {
                        const galaxy = existingUniverse.galaxies.find(g => g.id === savedGalaxyId);
                        if (galaxy) setCurrentGalaxy(galaxy);
                      } else if (existingUniverse.galaxies.length > 0) {
                        setCurrentGalaxy(existingUniverse.galaxies[0]);
                      }
                    }
                  } catch (error) {
                    console.error('[Initialize] Error creating universe from profile:', error);
                    // Try localStorage fallback instead of calling loadUniverse again
                    if (typeof window !== 'undefined') {
                      const stored = localStorage.getItem('multiverse_universe');
                      if (stored) {
                        try {
                          const fallbackUniverse = JSON.parse(stored);
                          if (fallbackUniverse) setUniverse(fallbackUniverse);
                        } catch (e) {
                          console.warn('[Initialize] Error parsing fallback universe:', e);
                        }
                      }
                    }
                  } finally {
                    setIsLoading(false);
                  }
                } else {
                  // No releases — could be an invited team member or solo user
                  console.log('[Initialize] No releases, loading existing universe...');
                  let loadedUniverse = await loadUniverse();
                  
                  // If no owned universe, check if user is part of a team (invited member)
                  if (!loadedUniverse) {
                    console.log('[Initialize] No owned universe, checking team membership...');
                    loadedUniverse = await loadTeamUniverse();
                  }
                  
                  if (loadedUniverse) {
                    setUniverse(loadedUniverse);
                    
                    const savedGalaxyId = loadCurrentGalaxyId();
                    if (savedGalaxyId) {
                      const galaxy = loadedUniverse.galaxies.find(g => g.id === savedGalaxyId);
                      if (galaxy) setCurrentGalaxy(galaxy);
                    } else if (loadedUniverse.galaxies.length > 0) {
                      setCurrentGalaxy(loadedUniverse.galaxies[0]);
                    }
                  }
                }
              }
            } else {
              // No valid account, clear any stale session
              console.log('[Initialize] No valid account found, clearing session');
              await supabase.auth.signOut();
              // Clear localStorage
              if (typeof window !== 'undefined') {
                localStorage.removeItem('multiverse_account');
                localStorage.removeItem('multiverse_universe');
                localStorage.removeItem('multiverse_current_galaxy');
              }
            }
          }
        } else {
          // Fallback to localStorage
          let loadedAccount = await loadAccount();
          // Only proceed if we actually have a valid account
          if (loadedAccount && loadedAccount.creatorName) {
            // Auto-populate Leon Tax account with onboarding data if incomplete or missing
            if (loadedAccount.creatorName === 'Leon Tax' && (!loadedAccount.onboardingComplete || !loadedAccount.onboardingProfile)) {
              console.log('[Initialize] Auto-populating Leon Tax account with onboarding data from completed conversation...');
              // Use data from the actual completed conversation
              const leonOnboardingData = {
                genre: ["indie pop"],
                musicalInspiration: ["Dominic Fike", "Bon Iver"],
                visualAesthetic: "dreamy atmospheric",
                visualStyleDescription: "aesthetic performance shots with atmospheric elements",
                releases: [
                  {
                    type: "single",
                    name: "will I find you",
                    releaseDate: "2025-03-01",
                    isReleased: false,
                    songs: ["will I find you"]
                  }
                ],
                hasBestPosts: true,
                bestPostDescription: "Performance shot with Snapchat filter got 1200 views, 40 likes, 9 comments - worked because it showed authentic performance with visual enhancement",
                platforms: ["instagram", "tiktok"],
                currentPostingFrequency: "none",
                desiredPostingFrequency: "2-3x_week",
                enjoyedContentFormats: ["visually aesthetic performance shots"],
                equipment: "iPhone, camcorder, Canon DSLR",
                timeBudgetHoursPerWeek: 6,
                preferredDays: ["friday", "saturday", "sunday"],
                hasExistingAssets: true,
                existingAssetsDescription: "Yosemite camcorder footage for next single promotion",
                hasTeam: true,
                teamMembers: "girlfriend (shoot/edit), roommate Julian (shooting ideas)",
              };
              
              loadedAccount = {
                ...loadedAccount,
                onboardingComplete: true,
                onboardingProfile: leonOnboardingData as any,
              };
              await saveAccount(loadedAccount);
              setAccount(loadedAccount);
              console.log('[Initialize] Leon Tax account populated and marked complete');
              
              // Create universe with galaxies/worlds from releases
              setIsLoading(true);
              try {
                let existingUniverse = await loadUniverse();
                
                if (!existingUniverse) {
                  let creatorId = `creator-${Date.now()}`;
                  if (isSupabaseConfigured()) {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user?.id) creatorId = user.id;
                    } catch (e) {}
                  }
                  
                  const newUniverse: Universe = {
                    id: `universe-${Date.now()}`,
                    name: `The ${loadedAccount.creatorName}verse`,
                    creatorId,
                    createdAt: new Date().toISOString(),
                    galaxies: [],
                  };
                  await saveUniverse(newUniverse);
                  existingUniverse = newUniverse;
                }
                
                // Create galaxies/worlds from releases
                if (leonOnboardingData.releases && leonOnboardingData.releases.length > 0) {
                  let updatedUniverse = { ...existingUniverse };
                  
                  for (const release of leonOnboardingData.releases) {
                    if (!release || !release.name) continue;
                    
                    const newGalaxy: Galaxy = {
                      id: `galaxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      name: release.name,
                      universeId: updatedUniverse.id,
                      releaseDate: release.releaseDate,
                      visualLandscape: { images: [], colorPalette: [] },
                      worlds: [],
                      createdAt: new Date().toISOString(),
                    };
                    
                    const songs = release.songs && release.songs.length > 0 ? release.songs : [release.name];
                    for (const songName of songs) {
                      if (!songName) continue;
                      const worldColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
                      const newWorld: World = {
                        id: `world-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: songName,
                        galaxyId: newGalaxy.id,
                        releaseDate: release.releaseDate || new Date().toISOString().split('T')[0],
                        color: worldColor,
                        visualLandscape: { images: [], colorPalette: [worldColor] },
                        isPublic: false,
                        isReleased: release.isReleased || false,
                        createdAt: new Date().toISOString(),
                      };
                      newGalaxy.worlds.push(newWorld);
                      await saveWorld(newWorld, newGalaxy.id);
                    }
                    
                    await saveGalaxy(newGalaxy, updatedUniverse.id);
                    updatedUniverse.galaxies.push(newGalaxy);
                  }
                  
                  await saveUniverse(updatedUniverse);
                  setUniverse(updatedUniverse);
                  
                  if (updatedUniverse.galaxies.length > 0) {
                    saveCurrentGalaxyId(updatedUniverse.galaxies[0].id);
                    setCurrentGalaxy(updatedUniverse.galaxies[0]);
                  }
                } else {
                  setUniverse(existingUniverse);
                }
              } catch (error) {
                console.error('[Initialize] Error creating universe for Leon Tax:', error);
                const fallbackUniverse = await loadUniverse();
                if (fallbackUniverse) setUniverse(fallbackUniverse);
              } finally {
                setIsLoading(false);
              }
              
              return; // Exit early
            }
            
            setAccount(loadedAccount);
            
            // Check if onboarding is complete
            if (!loadedAccount.onboardingComplete) {
              // Show onboarding to resume
              setShowEnhancedOnboarding(true);
            } else {
              // Onboarding complete, load universe
              const loadedUniverse = await loadUniverse();
              if (loadedUniverse) {
                setUniverse(loadedUniverse);
                
                const savedGalaxyId = loadCurrentGalaxyId();
                if (savedGalaxyId) {
                  const galaxy = loadedUniverse.galaxies.find(g => g.id === savedGalaxyId);
                  if (galaxy) {
                    setCurrentGalaxy(galaxy);
                  } else if (loadedUniverse.galaxies.length > 0) {
                    // savedGalaxyId doesn't match any galaxy — fall back to first
                    setCurrentGalaxy(loadedUniverse.galaxies[0]);
                    saveCurrentGalaxyId(loadedUniverse.galaxies[0].id);
                  }
                } else if (loadedUniverse.galaxies.length > 0) {
                  // No saved galaxy id (fresh browser / cleared localStorage) — show first galaxy
                  setCurrentGalaxy(loadedUniverse.galaxies[0]);
                  saveCurrentGalaxyId(loadedUniverse.galaxies[0].id);
                }
              }
            }
          } else {
            // No valid account, clear any stale data
            console.log('[Initialize] No valid account found in localStorage, clearing');
            if (typeof window !== 'undefined') {
              localStorage.removeItem('multiverse_account');
              localStorage.removeItem('multiverse_universe');
              localStorage.removeItem('multiverse_current_galaxy');
            }
          }
        }
      } catch (error) {
        console.error('[Initialize] Error loading app data:', error);
        console.error('[Initialize] Error stack:', (error as Error)?.stack);
      } finally {
        console.log('[Initialize] Initialization complete, setting isInitializing to false');
        setIsInitializing(false);
        setIsLoading(false);
      }
    };

    // Add overall timeout to prevent indefinite loading
    const initTimeout = setTimeout(() => {
      console.warn('[Initialize] ⚠️ Initialization timed out after 20 seconds, forcing completion');
      setIsInitializing(false);
      setIsLoading(false);
    }, 20000);
    
    initializeApp().catch((error) => {
      console.error('[Initialize] Unhandled error in initializeApp:', error);
      setIsInitializing(false);
      setIsLoading(false);
    }).finally(() => {
      clearTimeout(initTimeout);
    });
  }, []);

  // Step 1: Account Creation
  const handleAccountCreated = async (accountData: CreatorAccountData) => {
    console.log('[Account Created]', accountData.creatorName);
    console.log('[Account Created] onboardingComplete:', accountData.onboardingComplete);
    console.log('[Account Created] hasProfile:', !!accountData.onboardingProfile);
    
    // Check if this is a test user (e.g., Cam Okoro)
    if (isTestUser(accountData.creatorName)) {
      console.log('[Test User Detected] Auto-populating data for:', accountData.creatorName);
      const testProfile = getTestUserProfile(accountData.creatorName);
      
      if (testProfile) {
        // Create account with pre-populated onboarding data
        const populatedAccount = {
          ...accountData,
          onboardingComplete: true,
          onboardingProfile: testProfile,
        };
        
        await saveAccount(populatedAccount);
        setAccount(populatedAccount);
        
        console.log('[Test User] Skipping conversational onboarding, using pre-populated data');
        
        // Trigger the onboarding complete handler with the test profile
        await handleEnhancedOnboardingComplete(testProfile);
        return;
      }
    }
    
    setAccount(accountData);
    
    // If onboarding is already complete (e.g., returning user or invited team member), load their universe
    if (accountData.onboardingComplete) {
      console.log('[Account Created] Returning user detected - loading existing universe');
      console.log('[Account Created] Profile data:', {
        hasProfile: !!accountData.onboardingProfile,
        releaseStrategy: (accountData.onboardingProfile as any)?.releaseStrategy,
        releases: (accountData.onboardingProfile as any)?.releases
      });
      setIsLoading(true);
      
      try {
        // Load their existing universe with a timeout to prevent hanging
        const universePromise = loadUniverse();
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('[Account Created] ⚠️ loadUniverse timed out after 15s');
            resolve(null);
          }, 15000);
        });
        
        let existingUniverse = await Promise.race([universePromise, timeoutPromise]);
        
        // If no owned universe, check if user is part of a team (invited member)
        if (!existingUniverse || !existingUniverse.galaxies || existingUniverse.galaxies.length === 0) {
          console.log('[Account Created] No owned universe, checking team membership...');
          const teamUniverse = await loadTeamUniverse();
          if (teamUniverse) {
            existingUniverse = teamUniverse;
          }
        }
        
        console.log('[Account Created] Universe load result:', {
          hasUniverse: !!existingUniverse,
          galaxyCount: existingUniverse?.galaxies?.length || 0
        });
        
        if (existingUniverse && existingUniverse.galaxies && existingUniverse.galaxies.length > 0) {
          console.log('[Account Created] Found universe with', existingUniverse.galaxies.length, 'galaxies');
          setUniverse(existingUniverse);
          setCurrentGalaxy(existingUniverse.galaxies[0]);
          // Galaxy view will render automatically when currentGalaxy is set
        } else if (accountData.onboardingProfile) {
          console.log('[Account Created] No universe found - showing post-onboarding');
          // Has onboarding profile but no universe yet, show post-onboarding to create one
          setShowPostOnboarding(true);
        } else {
          console.log('[Account Created] Invited user with no universe yet - waiting for admin setup');
          // Invited user whose admin hasn't set up the universe yet
          // Just show galaxy view with empty state
        }
      } catch (error) {
        console.error('[Account Created] Error loading universe:', error);
        if (accountData.onboardingProfile) {
          setShowPostOnboarding(true);
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Show enhanced onboarding after account creation
    setShowEnhancedOnboarding(true);
  };

  // Step 2: Enhanced Onboarding (Artist Profile)
  const handleEnhancedOnboardingComplete = async (profile: any, shouldShowPostOnboarding: boolean = true) => {
    console.log('[Enhanced Onboarding] Profile completed:', profile);
    
    // Mark onboarding as complete and save profile data
    if (account) {
      const updatedAccount = {
        ...account,
        onboardingComplete: true,
        onboardingProfile: profile,
      };
      await saveAccount(updatedAccount);
      setAccount(updatedAccount);
    }
    
    // Show loading while we create the universe
    setIsLoading(true);
    
    try {
      // Check if universe already exists
      let existingUniverse = await loadUniverse();
      
      if (!existingUniverse) {
        // Get creator ID safely
        let creatorId = `creator-${Date.now()}`;
        if (isSupabaseConfigured()) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
              creatorId = user.id;
            }
          } catch (authError) {
            console.warn('[Enhanced Onboarding] Could not get user ID from Supabase:', authError);
          }
        }
        
        // Create empty universe
        const newUniverse: Universe = {
          id: `universe-${Date.now()}`,
          name: `The ${account?.creatorName || 'User'}verse`,
          creatorId,
          createdAt: new Date().toISOString(),
          galaxies: [],
        };
        
        await saveUniverse(newUniverse);
        existingUniverse = newUniverse;
        console.log('[Enhanced Onboarding] Created new universe:', newUniverse.id);
      }

      // If profile includes release data, create galaxies and worlds
      if (profile.releases && Array.isArray(profile.releases) && profile.releases.length > 0) {
        console.log('[Enhanced Onboarding] Creating galaxies/worlds from releases:', profile.releases);
        
        let updatedUniverse = { ...existingUniverse };
        
        for (const release of profile.releases) {
          // Skip invalid releases
          if (!release || !release.name) {
            console.log('[Enhanced Onboarding] Skipping invalid release:', release);
            continue;
          }
          
          // Determine galaxy name
          // For EP/Album: use the project name
          // For standalone single: use the song name
          const galaxyName = release.name || 'Untitled Project';
          
          // Create the galaxy
          const newGalaxy: Galaxy = {
            id: `galaxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: galaxyName,
            universeId: updatedUniverse.id,
            releaseDate: release.releaseDate,
            visualLandscape: { images: [], colorPalette: [] },
            worlds: [],
            createdAt: new Date().toISOString(),
          };
          
          // Create worlds for each song
          const songs = release.songs && Array.isArray(release.songs) && release.songs.length > 0 
            ? release.songs 
            : [release.name]; // For singles, the song name is the project name
          
          for (const songName of songs) {
            if (!songName) continue; // Skip empty song names
            
            const worldColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
            const newWorld: World = {
              id: `world-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: songName || 'Untitled Song',
              galaxyId: newGalaxy.id,
              releaseDate: release.releaseDate || new Date().toISOString().split('T')[0],
              color: worldColor,
              visualLandscape: { images: [], colorPalette: [worldColor] },
              isPublic: false,
              isReleased: release.isReleased || false,
              createdAt: new Date().toISOString(),
            };
            
            newGalaxy.worlds.push(newWorld);
          }
          
          // IMPORTANT: Save the galaxy FIRST (before worlds) so RLS policies can verify ownership
          // Pass skipWorlds=true to prevent saveGalaxy from auto-saving worlds (we'll do it manually)
          await saveGalaxy(newGalaxy, updatedUniverse.id, true);
          
          // Now save worlds (galaxy must exist in Supabase for RLS to work)
          for (const world of newGalaxy.worlds) {
            try {
              await saveWorld(world, newGalaxy.id);
            } catch (error) {
              console.warn('[Enhanced Onboarding] Error saving world, continuing with localStorage:', error);
              // Continue - saveWorld already handles localStorage fallback
            }
          }
          
          // Add to universe
          updatedUniverse.galaxies.push(newGalaxy);
          console.log('[Enhanced Onboarding] Created galaxy:', newGalaxy.name, 'with', newGalaxy.worlds.length, 'worlds');
        }
        
        // Save updated universe
        await saveUniverse(updatedUniverse);
        setUniverse(updatedUniverse);
        
        // Set the first galaxy as current
        if (updatedUniverse.galaxies.length > 0) {
          const firstGalaxy = updatedUniverse.galaxies[0];
          saveCurrentGalaxyId(firstGalaxy.id);
          setCurrentGalaxy(firstGalaxy);
          console.log('[Enhanced Onboarding] Set current galaxy:', firstGalaxy.name);
        }
        
        console.log('[Enhanced Onboarding] Created galaxies/worlds:', updatedUniverse.galaxies.length, 'galaxies');
      } else {
        console.log('[Enhanced Onboarding] No releases to create, setting universe');
        setUniverse(existingUniverse);
      }
      // Create team for the universe (for team collaboration features)
      try {
        if (isSupabaseConfigured() && existingUniverse) {
          const teamName = `${account?.creatorName || 'User'}'s Team`;
          const teamResponse = await fetch('/api/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              universeId: existingUniverse.id,
              name: teamName,
            }),
          });
          const teamData = await teamResponse.json();
          if (teamData.success && teamData.team) {
            console.log('[Enhanced Onboarding] Created team:', teamData.team.name);

            // Create initial tasks (invite team + brainstorm content)
            const hasTeam = profile.hasTeam || false;
            const firstGalaxy = existingUniverse.galaxies[0];
            if (firstGalaxy) {
              await fetch('/api/team/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'init',
                  teamId: teamData.team.id,
                  galaxyId: firstGalaxy.id,
                  hasTeam,
                }),
              });
              console.log('[Enhanced Onboarding] Created initial tasks');
            }
          }
        }
      } catch (teamError) {
        console.warn('[Enhanced Onboarding] Team creation skipped (non-critical):', teamError);
      }
    } catch (error) {
      console.error('[Enhanced Onboarding] Error creating universe/galaxies:', error);
      // Still try to set universe even if there was an error
      const fallbackUniverse = await loadUniverse();
      if (fallbackUniverse) {
        setUniverse(fallbackUniverse);
      }
    } finally {
      // Always hide onboarding and clear loading
      setShowEnhancedOnboarding(false);
      setIsLoading(false);
      
      // Trigger post-onboarding conversation with calendar walkthrough (only if requested)
      if (shouldShowPostOnboarding) {
        setSkipToCalendar(false); // Reset so we show the full walkthrough
        setShowPostOnboarding(true);
        console.log('[Enhanced Onboarding] Complete, starting post-onboarding conversation');
      } else {
        console.log('[Enhanced Onboarding] Complete, skipping post-onboarding (already done)');
      }
    }
  };

  // Step 3: Galaxy Creation
  const handleGalaxyCreated = async (galaxyData: Partial<Galaxy>) => {
    if (!universe) {
      console.error('Cannot create galaxy: universe is null');
      return;
    }

    setIsLoading(true);
    console.log('[Galaxy Creation] Starting galaxy creation...');

    const newGalaxy: Galaxy = {
      id: `galaxy-${Date.now()}`,
      name: galaxyData.name || 'Unnamed Galaxy',
      universeId: universe.id,
      releaseDate: galaxyData.releaseDate,
      visualLandscape: galaxyData.visualLandscape || { images: [], colorPalette: [] },
      worlds: [], // Will be created as greyed out worlds
      createdAt: new Date().toISOString(),
    };

    try {
      console.log('[Galaxy Creation] Saving galaxy to storage...');
      // Save galaxy (with timeout protection)
      await Promise.race([
        saveGalaxy(newGalaxy, universe.id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save timeout after 3 seconds')), 3000)
        )
      ]).catch((error) => {
        console.warn('[Galaxy Creation] Save timeout or error, continuing:', error);
      });
      
      console.log('[Galaxy Creation] Updating universe...');
      // Update universe
      const updatedUniverse: Universe = {
        ...universe,
        galaxies: [...universe.galaxies, newGalaxy],
      };
      
      await Promise.race([
        saveUniverse(updatedUniverse),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Universe save timeout')), 2000)
        )
      ]).catch((error) => {
        console.warn('[Galaxy Creation] Universe save timeout, continuing:', error);
      });
      
      setUniverse(updatedUniverse);
      
      // Set as current galaxy
      saveCurrentGalaxyId(newGalaxy.id);
      setCurrentGalaxy(newGalaxy);
      console.log('[Galaxy Creation] Galaxy created successfully');
    } catch (error) {
      console.error('[Galaxy Creation] Error creating galaxy:', error);
      // Still set the galaxy even if save fails, so user can continue
      setCurrentGalaxy(newGalaxy);
      const updatedUniverse: Universe = {
        ...universe,
        galaxies: [...universe.galaxies, newGalaxy],
      };
      setUniverse(updatedUniverse);
    } finally {
      console.log('[Galaxy Creation] Clearing loading state');
      setIsLoading(false);
    }
  };

  // Step 3: World Creation
  const handleWorldCreated = async (worldData: Partial<World>) => {
    if (!currentGalaxy) return;

    const worldId = worldData.id || `world-${Date.now()}`;
    
    // Update snapshot strategy with correct worldId
    let snapshotStrategy = worldData.snapshotStrategy;
    if (snapshotStrategy) {
      snapshotStrategy = {
        ...snapshotStrategy,
        worldId: worldId,
        snapshots: snapshotStrategy.snapshots.map(snapshot => ({
          ...snapshot,
          worldId: worldId,
        })),
      };
    }

    const newWorld: World = {
      id: worldId,
      name: worldData.name || 'Unnamed World',
      galaxyId: currentGalaxy.id,
      releaseDate: worldData.releaseDate || new Date().toISOString().split('T')[0],
      color: worldData.color || '#FFFFFF', // Ensure color is always set
      visualLandscape: worldData.visualLandscape || { images: [], colorPalette: [] },
      snapshotStrategy: snapshotStrategy,
      isPublic: false,
      isReleased: false,
      createdAt: new Date().toISOString(),
    };
    
    // Save world
    await saveWorld(newWorld, currentGalaxy.id);

    // Update galaxy with new world
    const updatedGalaxy: Galaxy = {
      ...currentGalaxy,
      worlds: [...currentGalaxy.worlds, newWorld],
    };
    
    // Save galaxy
    await saveGalaxy(updatedGalaxy, currentGalaxy.universeId);
    
    // Update universe to include updated galaxy
    if (universe) {
      const updatedUniverse: Universe = {
        ...universe,
        galaxies: universe.galaxies.map(g => g.id === updatedGalaxy.id ? updatedGalaxy : g).concat(
          universe.galaxies.find(g => g.id === updatedGalaxy.id) ? [] : [updatedGalaxy]
        ),
      };
      await saveUniverse(updatedUniverse);
      setUniverse(updatedUniverse);
      // Update currentGalaxy AFTER universe to ensure consistency
      setCurrentGalaxy(updatedGalaxy);
    } else {
      // If no universe, still update currentGalaxy
      setCurrentGalaxy(updatedGalaxy);
    }
  };

  // Delete Galaxy Handler
  const handleDeleteGalaxy = async () => {
    console.log('[Delete Galaxy] Starting deletion:', { galaxyId: currentGalaxy?.id, universeId: universe?.id });
    
    if (!currentGalaxy || !universe) {
      console.error('[Delete Galaxy] Missing currentGalaxy or universe');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${currentGalaxy.name}"? This will also delete all ${currentGalaxy.worlds.length} world${currentGalaxy.worlds.length !== 1 ? 's' : ''} and all snapshots in this galaxy. This action cannot be undone.`)) {
      console.log('[Delete Galaxy] User cancelled deletion');
      return;
    }

    try {
      const galaxyIdToDelete = currentGalaxy.id;
      const universeIdToUpdate = universe.id;
      
      console.log('[Delete Galaxy] Calling deleteGalaxy function...');
      await deleteGalaxy(galaxyIdToDelete, universeIdToUpdate);
      console.log('[Delete Galaxy] Galaxy deleted from storage');
      
      // Update universe - remove the deleted galaxy
      const updatedUniverse: Universe = {
        ...universe,
        galaxies: universe.galaxies.filter(g => g.id !== galaxyIdToDelete),
      };
      console.log('[Delete Galaxy] Updated universe:', { 
        oldGalaxyCount: universe.galaxies.length, 
        newGalaxyCount: updatedUniverse.galaxies.length 
      });
      
      await saveUniverse(updatedUniverse);
      console.log('[Delete Galaxy] Universe saved');
      
      // Update state - clear current galaxy first, then update universe
      // This ensures the render logic correctly shows EmptyUniverseView or universe view
      setCurrentGalaxy(null);
      saveCurrentGalaxyId('');
      setUniverse(updatedUniverse);
      console.log('[Delete Galaxy] State updated successfully');
    } catch (error) {
      console.error('[Delete Galaxy] Error deleting galaxy:', error);
      alert('Failed to delete galaxy. Please try again.');
    }
  };

  // Delete World Handler
  const handleDeleteWorld = async (worldId: string) => {
    console.log('[Delete World] Starting deletion:', { worldId, currentGalaxy: currentGalaxy?.id, universe: universe?.id });
    
    if (!currentGalaxy || !universe) {
      console.error('[Delete World] Missing currentGalaxy or universe');
      return;
    }
    
    const world = currentGalaxy.worlds.find(w => w.id === worldId);
    if (!world) {
      console.error('[Delete World] World not found:', worldId);
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${world.name}"? This will also delete all snapshots for this world. This action cannot be undone.`)) {
      console.log('[Delete World] User cancelled deletion');
      return;
    }

    try {
      console.log('[Delete World] Calling deleteWorld function...');
      await deleteWorld(worldId, currentGalaxy.id);
      console.log('[Delete World] World deleted from storage');
      
      // Update galaxy
      const updatedGalaxy: Galaxy = {
        ...currentGalaxy,
        worlds: currentGalaxy.worlds.filter(w => w.id !== worldId),
      };
      console.log('[Delete World] Updated galaxy:', { 
        oldWorldCount: currentGalaxy.worlds.length, 
        newWorldCount: updatedGalaxy.worlds.length 
      });
      
      await saveGalaxy(updatedGalaxy, universe.id);
      console.log('[Delete World] Galaxy saved');
      
      // Update universe
      const updatedUniverse: Universe = {
        ...universe,
        galaxies: universe.galaxies.map(g => g.id === currentGalaxy.id ? updatedGalaxy : g),
      };
      await saveUniverse(updatedUniverse);
      console.log('[Delete World] Universe saved');
      
      setUniverse(updatedUniverse);
      setCurrentGalaxy(updatedGalaxy);
      console.log('[Delete World] State updated successfully');
    } catch (error) {
      console.error('[Delete World] Error deleting world:', error);
      alert('Failed to delete world. Please try again.');
    }
  };

  // Switch active galaxy (for multi-galaxy navigation)
  const handleSwitchGalaxy = (index: number) => {
    if (index < 0 || index >= allGalaxyEntries.length) return;
    const entry = allGalaxyEntries[index];
    setActiveGalaxyIdx(index);
    setCurrentGalaxy(entry.galaxy);
    setUniverse(entry.universe);
    saveCurrentGalaxyId(entry.galaxy.id);
    // Persist last-viewed galaxy for this session
    if (typeof window !== 'undefined') {
      localStorage.setItem('last_active_galaxy_id', entry.galaxy.id);
    }
  };

  // Sign out function - clears session and state
  const handleSignOut = async () => {
    console.log('[handleSignOut] Signing out...');
    
    // Sign out from Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('[handleSignOut] Error signing out from Supabase:', error);
      }
    }
    
    // Clear ALL state
    setAccount(null);
    setUniverse(null);
    setCurrentGalaxy(null);
    setShowEnhancedOnboarding(false);
    setShowPostOnboarding(false);
    setSkipToCalendar(false);
    setIsLoading(false);
    
    // Clear ALL localStorage items so the new user starts fresh
    if (typeof window !== 'undefined') {
      localStorage.removeItem('multiverse_account');
      localStorage.removeItem('multiverse_universe');
      localStorage.removeItem('multiverse_current_galaxy');
      // NOTE: Keep multiverse_team_info — it's needed when the same user signs back in
      // It will be overwritten if a different user accepts an invitation
      localStorage.removeItem('postOnboarding_inProgress');
      // Also clear Supabase auth keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase.auth')) {
          localStorage.removeItem(key);
        }
      });
    }
    
    console.log('[handleSignOut] Signed out successfully');
  };

  const handleDeleteAccount = async () => {
    console.log('[handleDeleteAccount] Deleting account...');
    // clearAllData is already called in GalaxyView before this callback
    // Just sign out and reset state
    await handleSignOut();
    console.log('[handleDeleteAccount] Account deleted and signed out');
  };

  // Clear all data function (for testing)
  const handleClearAllData = async () => {
    if (confirm('Are you sure you want to clear all data? This will sign you out and delete everything. This action cannot be undone.')) {
      console.log('[handleClearAllData] Starting data clear...');
      
      // Clear all data
      await clearAllData();
      
      // Clear state immediately
      setAccount(null);
      setUniverse(null);
      setCurrentGalaxy(null);
      
      // Wait a moment to ensure everything is cleared
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force clear any remaining localStorage items
      if (typeof window !== 'undefined') {
        // Clear all multiverse-related keys
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('multiverse_') || key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      console.log('[handleClearAllData] Data cleared, reloading...');
      
      // Reload page to reset state - use window.location.href to force a hard reload
      window.location.href = window.location.origin + window.location.pathname;
    }
  };

  // Handle post-onboarding completion - transition to calendar/strategy view
  const handlePostOnboardingComplete = async (strategy: any) => {
    console.log('[Post-Onboarding] Strategy selected:', strategy);
    setShowPostOnboarding(false);
    
    // Create the universe and galaxies based on onboarding data
    if (account?.onboardingProfile) {
      setIsLoading(true);
      try {
        // Pass false to prevent restarting post-onboarding after OAuth
        await handleEnhancedOnboardingComplete(account.onboardingProfile, false);
      } catch (error) {
        console.error('[Post-Onboarding] Error creating universe:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    // TODO: Store the strategy and use it to pre-fill the calendar
    // For now, just transition to the galaxy view
  };

  // Render based on current state
  if (isInitializing) {
    return <LoadingScreen message="Loading The Multiverse..." />;
  }

  if (isLoading) {
    return <LoadingScreen message="Building out your galaxy..." />;
  }

  // Show post-onboarding conversation (dev mode or after completing onboarding)
  if (showPostOnboarding && account) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-start p-8 bg-black overflow-y-auto">
        <div className="w-full max-w-7xl">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-star-wars text-yellow-400 mb-4">
              The Multiverse
            </h1>
            <p className="text-gray-400 font-star-wars text-lg">
              Your Content Strategy
            </p>
          </div>
          <PostOnboardingConversation
            creatorName={account.creatorName}
            onboardingProfile={account.onboardingProfile || DEV_TEST_DATA.onboardingProfile}
            onComplete={handlePostOnboardingComplete}
            skipToCalendar={skipToCalendar}
          />
        </div>
      </main>
    );
  }

  // Show enhanced onboarding if active (even if account exists)
  if (showEnhancedOnboarding && account) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-black">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-star-wars text-yellow-400 mb-4">
              The Multiverse
            </h1>
            <p className="text-gray-400 font-star-wars text-lg">
              Build Your Visual Universe
            </p>
          </div>
          <ConversationalOnboarding
            creatorName={account.creatorName}
            onComplete={handleEnhancedOnboardingComplete}
          />
        </div>
      </main>
    );
  }

  // If no account, show signup form
  if (!account) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-black">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-star-wars text-yellow-400 mb-4">
              The Multiverse
            </h1>
            <p className="text-gray-400 font-star-wars text-lg">
              Build Your Visual Universe
            </p>
          </div>
          <CreatorOnboardingForm onSuccess={handleAccountCreated} />
          {/* Clear all data button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleClearAllData}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400 font-star-wars rounded text-sm transition-colors"
            >
              🗑️ Delete All Account Data
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (currentGalaxy) {
    const updatedUniverse: Universe = universe ? {
      ...universe,
      galaxies: universe.galaxies.some(g => g.id === currentGalaxy.id)
        ? universe.galaxies.map(g => g.id === currentGalaxy.id ? currentGalaxy : g)
        : [...universe.galaxies, currentGalaxy],
    } : {
      id: `universe-${Date.now()}`,
      name: account ? `The ${account.creatorName}verse` : 'Universe',
      creatorId: account?.creatorName || '',
      createdAt: new Date().toISOString(),
      galaxies: [currentGalaxy],
    };

    return (
      <GalaxyViewWrapper
        galaxy={currentGalaxy}
        universe={updatedUniverse}
        artistProfile={account?.onboardingProfile as ArtistProfile | undefined}
        onUpdateWorld={handleWorldCreated}
        onDeleteGalaxy={handleDeleteGalaxy}
        onDeleteWorld={handleDeleteWorld}
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
        allGalaxies={allGalaxyEntries.length > 1 ? allGalaxyEntries : undefined}
        activeGalaxyIndex={activeGalaxyIdx}
        onSwitchGalaxy={handleSwitchGalaxy}
      />
    );
  }

  if (universe) {
    // TEMPORARY: Disabled for testing
    return (
      <div className="flex items-center justify-center w-full h-screen bg-black text-white">
        <div className="text-center p-8">
          <h1 className="text-3xl mb-4 font-bold">Your Universe</h1>
          <p className="text-xl mb-2">Universe: {universe.name}</p>
          <p className="text-gray-400">3D view temporarily disabled for testing</p>
          <p className="text-sm text-gray-500 mt-4">{universe.galaxies?.length || 0} galaxies in this universe</p>
          <p className="text-xs text-gray-600 mt-2">Create a galaxy to get started</p>
        </div>
      </div>
    );
  }

  // Fallback: shouldn't reach here, but show loading just in case
  return <LoadingScreen message="Setting up your universe..." />;
}
