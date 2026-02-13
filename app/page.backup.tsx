'use client';

import { useState, useEffect } from 'react';
import { CreatorOnboardingForm } from '@/components/multiverse/CreatorOnboardingForm';
import { EnhancedOnboardingForm } from '@/components/multiverse/EnhancedOnboardingForm';
import { ConversationalOnboarding } from '@/components/multiverse/ConversationalOnboarding';
import { EmptyUniverseView } from '@/components/multiverse/EmptyUniverseView';
import { GalaxyView } from '@/components/multiverse/GalaxyView';
import { LoadingScreen } from '@/components/multiverse/LoadingScreen';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { loadAccount, loadUniverse, saveUniverse, saveGalaxy, saveWorld, loadCurrentGalaxyId, saveCurrentGalaxyId, deleteGalaxy, deleteWorld, clearAllData, saveAccount } from '@/lib/storage';
import type { CreatorAccountData, Universe, Galaxy, World } from '@/types';

// ============================================================================
// DEV MODE: Set to true to skip onboarding with test data
// ============================================================================
const DEV_SKIP_ONBOARDING = false; // Normal onboarding enabled
const DEV_TEST_DATA = {
  creatorName: 'Leon Tax',
  email: 'leon@test.com',
  releases: [
    {
      type: 'single',
      name: 'Will I Find You',
      releaseDate: '2026-03-01',
      isReleased: false,
      songs: ['Will I Find You']
    },
    {
      type: 'ep',
      name: 'Moving Fast and Slow',
      releaseDate: '2026-03-22',
      isReleased: false,
      songs: ['Will I Find You', 'Break My Chain', 'Set You Free']
    }
  ]
};
// ============================================================================

export default function Home() {
  const [account, setAccount] = useState<CreatorAccountData | null>(null);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [currentGalaxy, setCurrentGalaxy] = useState<Galaxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showEnhancedOnboarding, setShowEnhancedOnboarding] = useState(false);

  // Load data on mount
  useEffect(() => {
    const initializeApp = async () => {
      setIsInitializing(true);
      
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
              // Auto-populate Leon Tax account with onboarding data if incomplete
              if (loadedAccount.creatorName === 'Leon Tax' && !loadedAccount.onboardingComplete) {
                console.log('[Initialize] Auto-populating Leon Tax account with onboarding data...');
                const leonOnboardingData = {
                  genre: ["indie pop", "folk elements"],
                  musicalInspiration: ["Dominic Fike", "Bon Iver"],
                  visualAesthetic: "natural_organic",
                  visualStyleDescription: "aesthetic performance shots in nature, mini music videos in natural settings",
                  releases: [
                    {
                      type: "single",
                      name: "Will I Find You",
                      releaseDate: "2026-03-01",
                      isReleased: false,
                      songs: ["Will I Find You"]
                    },
                    {
                      type: "ep",
                      name: "Moving Fast and Slow",
                      releaseDate: "2026-03-22",
                      isReleased: false,
                      songs: ["Will I Find You", "Break My Chain", "Set You Free"]
                    }
                  ],
                  hasBestPosts: true,
                  bestPostDescription: "June 6th post for 'Breathe Me In' - 1.2k views, storytelling with contrast between hopeful prom proposal footage and 'she did me dirty' caption, mixed iPhone and performance footage",
                  platforms: ["tiktok", "instagram"],
                  currentPostingFrequency: "less_than_weekly",
                  desiredPostingFrequency: "2-3x_week",
                  enjoyedContentFormats: ["aesthetic performance shots in nature", "mini music videos"],
                  equipment: "phone_basic",
                  timeBudgetHoursPerWeek: 6,
                  preferredDays: ["friday", "saturday", "sunday"],
                  hasExistingAssets: true,
                  existingAssetsDescription: "Yosemite footage with girlfriend - nature performance shots by river on camcorder",
                  hasTeam: true,
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
                  
                  // Try to restore current galaxy
                  const savedGalaxyId = loadCurrentGalaxyId();
                  if (savedGalaxyId) {
                    const galaxy = loadedUniverse.galaxies.find(g => g.id === savedGalaxyId);
                    if (galaxy) {
                      setCurrentGalaxy(galaxy);
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
            // Auto-populate Leon Tax account with onboarding data if incomplete
            if (loadedAccount.creatorName === 'Leon Tax' && !loadedAccount.onboardingComplete) {
              console.log('[Initialize] Auto-populating Leon Tax account with onboarding data...');
              const leonOnboardingData = {
                genre: ["indie pop", "folk elements"],
                musicalInspiration: ["Dominic Fike", "Bon Iver"],
                visualAesthetic: "natural_organic",
                visualStyleDescription: "aesthetic performance shots in nature, mini music videos in natural settings",
                releases: [
                  {
                    type: "single",
                    name: "Will I Find You",
                    releaseDate: "2026-03-01",
                    isReleased: false,
                    songs: ["Will I Find You"]
                  },
                  {
                    type: "ep",
                    name: "Moving Fast and Slow",
                    releaseDate: "2026-03-22",
                    isReleased: false,
                    songs: ["Will I Find You", "Break My Chain", "Set You Free"]
                  }
                ],
                hasBestPosts: true,
                bestPostDescription: "June 6th post for 'Breathe Me In' - 1.2k views, storytelling with contrast between hopeful prom proposal footage and 'she did me dirty' caption, mixed iPhone and performance footage",
                platforms: ["tiktok", "instagram"],
                currentPostingFrequency: "less_than_weekly",
                desiredPostingFrequency: "2-3x_week",
                enjoyedContentFormats: ["aesthetic performance shots in nature", "mini music videos"],
                equipment: "phone_basic",
                timeBudgetHoursPerWeek: 6,
                preferredDays: ["friday", "saturday", "sunday"],
                hasExistingAssets: true,
                existingAssetsDescription: "Yosemite footage with girlfriend - nature performance shots by river on camcorder",
                hasTeam: true,
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
                  }
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
        console.error('Error loading app data:', error);
      } finally {
        setIsInitializing(false);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Step 1: Account Creation
  const handleAccountCreated = async (accountData: CreatorAccountData) => {
    setAccount(accountData);
    // Show enhanced onboarding after account creation
    setShowEnhancedOnboarding(true);
  };

  // Step 2: Enhanced Onboarding (Artist Profile)
  const handleEnhancedOnboardingComplete = async (profile: any) => {
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
            
            // Save the world
            await saveWorld(newWorld, newGalaxy.id);
          }
          
          // Save the galaxy
          await saveGalaxy(newGalaxy, updatedUniverse.id);
          
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
      console.log('[Enhanced Onboarding] Complete, loading cleared');
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

  // Render based on current state
  if (isInitializing) {
    return <LoadingScreen message="Loading The Multiverse..." />;
  }

  if (isLoading) {
    return <LoadingScreen message="Building out your galaxy..." />;
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
          {/* Debug: Clear all data button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleClearAllData}
              className="text-xs text-gray-500 hover:text-red-400 underline"
            >
              Clear All Data (Testing)
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (currentGalaxy) {
    // Ensure universe includes current galaxy
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
      <GalaxyView
        galaxy={currentGalaxy}
        universe={updatedUniverse}
        onUpdateWorld={handleWorldCreated}
        onDeleteGalaxy={handleDeleteGalaxy}
        onDeleteWorld={handleDeleteWorld}
        onSignOut={handleClearAllData}
      />
    );
  }

  if (universe) {
    return (
      <EmptyUniverseView
        universe={universe}
        onCreateGalaxy={handleGalaxyCreated}
        onSignOut={handleClearAllData}
      />
    );
  }

  // Fallback: shouldn't reach here, but show loading just in case
  return <LoadingScreen message="Setting up your universe..." />;
}
