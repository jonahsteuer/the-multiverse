/**
 * Storage utilities - uses Supabase if configured, falls back to localStorage
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { CreatorAccountData, Universe, Galaxy, World } from '@/types';

const STORAGE_KEYS = {
  ACCOUNT: 'multiverse_account',
  UNIVERSE: 'multiverse_universe',
  CURRENT_GALAXY: 'multiverse_current_galaxy',
} as const;

// ============================================================================
// Account Storage
// ============================================================================

export async function saveAccount(account: CreatorAccountData): Promise<void> {
  console.log('[saveAccount] Starting save for:', account.creatorName);
  console.log('[saveAccount] Onboarding complete:', account.onboardingComplete);
  console.log('[saveAccount] Has onboarding profile:', !!account.onboardingProfile);
  
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('[saveAccount] 🔄 Saving to Supabase for user:', user.id);
        // Save to Supabase profiles table
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            creator_name: account.creatorName,
            email: account.email,
            user_type: account.userType,
            spotify_linked: account.spotifyLinked || false,
            instagram_linked: account.instagramLinked || false,
            onboarding_complete: account.onboardingComplete || false,
            onboarding_profile: account.onboardingProfile || null,
            updated_at: new Date().toISOString(),
          });
        if (error) {
          console.error('[saveAccount] ❌ Supabase save error:', error);
        } else {
          console.log('[saveAccount] ✅ ACCOUNT SAVED TO SUPABASE:', account.creatorName);
          if (account.onboardingProfile) {
            console.log('[saveAccount] ✅ ONBOARDING DATA STORED IN SUPABASE');
          }
        }
      } else {
        console.warn('[saveAccount] ⚠️ No authenticated user - cannot save to Supabase');
      }
    } catch (error) {
      console.error('[saveAccount] ❌ Supabase save failed:', error);
    }
  } else {
    console.warn('[saveAccount] ⚠️ Supabase not configured - using localStorage only');
  }
  
  // Always save to localStorage as backup
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.ACCOUNT, JSON.stringify(account));
    console.log('[saveAccount] 💾 Also saved to localStorage as backup');
  }
}

export async function loadAccount(): Promise<CreatorAccountData | null> {
  console.log('[loadAccount] Loading account...');
  
  // Try localStorage first to get password and onboarding status
  let localStorageAccount: CreatorAccountData | null = null;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNT);
    if (stored) {
      localStorageAccount = JSON.parse(stored);
      console.log('[loadAccount] Found localStorage account:', localStorageAccount?.creatorName);
    }
  }
  
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('[loadAccount] 🔄 Loading from Supabase for user:', user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('[loadAccount] ❌ Supabase load error:', error);
        } else if (data) {
          console.log('[loadAccount] ✅ ACCOUNT LOADED FROM SUPABASE:', data.creator_name);
          console.log('[loadAccount] Onboarding complete in Supabase:', data.onboarding_complete);
          console.log('[loadAccount] Has onboarding profile in Supabase:', !!data.onboarding_profile);
          // Merge Supabase data with localStorage data (for password and onboarding status)
          return {
            creatorName: data.creator_name,
            email: data.email,
            password: localStorageAccount?.password || '', // Get password from localStorage
            userType: data.user_type as CreatorAccountData['userType'],
            spotifyLinked: data.spotify_linked,
            instagramLinked: data.instagram_linked,
            onboardingComplete: data.onboarding_complete || localStorageAccount?.onboardingComplete || false, // Get from Supabase or localStorage
            onboardingProfile: data.onboarding_profile || localStorageAccount?.onboardingProfile || null, // Get from Supabase or localStorage
          };
        }
      } else {
        console.log('[loadAccount] ⚠️ No authenticated user');
      }
    } catch (error) {
      console.error('[loadAccount] ❌ Supabase load failed:', error);
    }
  } else {
    console.log('[loadAccount] ⚠️ Supabase not configured');
  }
  
  // Fallback to localStorage
  console.log('[loadAccount] 📦 Using localStorage fallback');
  return localStorageAccount;
}

export async function clearAccount(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Sign out from Supabase
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.warn('Error signing out from Supabase:', error);
    }
  }
  
  // Clear localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.ACCOUNT);
    localStorage.removeItem(STORAGE_KEYS.UNIVERSE);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_GALAXY);
  }
}

export async function clearAllData(): Promise<void> {
  console.log('[clearAllData] Clearing all stored data...');
  
  // Clear Supabase data if configured (do this before signing out)
  if (isSupabaseConfigured()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get all universes for this user
        const { data: universesData } = await supabase
          .from('universes')
          .select('id')
          .eq('creator_id', user.id);
        
        if (universesData && universesData.length > 0) {
          // For each universe, get galaxies
          for (const universe of universesData) {
            const { data: galaxiesData } = await supabase
              .from('galaxies')
              .select('id')
              .eq('universe_id', universe.id);
            
            if (galaxiesData && galaxiesData.length > 0) {
              // For each galaxy, delete worlds
              for (const galaxy of galaxiesData) {
                await supabase.from('worlds').delete().eq('galaxy_id', galaxy.id);
              }
              // Delete galaxies
              await supabase.from('galaxies').delete().eq('universe_id', universe.id);
            }
          }
          // Delete universes
          await supabase.from('universes').delete().eq('creator_id', user.id);
        }
        
        // Delete profile
        await supabase.from('profiles').delete().eq('id', user.id);
      }
      
      // Sign out (this clears the session)
      await supabase.auth.signOut();
      
      // Wait a bit to ensure signout completes
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn('Error clearing Supabase data:', error);
    }
  }
  
  // Clear ALL localStorage (be thorough)
  if (typeof window !== 'undefined') {
    // Clear our specific keys
    localStorage.removeItem(STORAGE_KEYS.ACCOUNT);
    localStorage.removeItem(STORAGE_KEYS.UNIVERSE);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_GALAXY);
    
    // Also clear any Supabase session storage
    try {
      // Supabase stores session in localStorage with key pattern
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Error clearing Supabase localStorage:', e);
    }
  }
  
  console.log('[clearAllData] All data cleared');
}

// ============================================================================
// Universe Storage
// ============================================================================

// Track if we're currently saving a universe to prevent circular calls
let isSavingUniverse = false;

export async function saveUniverse(universe: Universe, skipGalaxies: boolean = false): Promise<void> {
  // Prevent infinite recursion
  if (isSavingUniverse) {
    console.warn('[saveUniverse] Already saving universe, skipping to prevent recursion');
    return;
  }
  
  isSavingUniverse = true;
  
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Save universe
          const { error: universeError } = await supabase
            .from('universes')
            .upsert({
              id: universe.id,
              creator_id: user.id,
              name: universe.name,
              created_at: universe.createdAt,
              updated_at: new Date().toISOString(),
            });
          
          if (universeError) {
            console.error('[saveUniverse] ❌ Error saving universe to Supabase:', {
              error: universeError,
              code: universeError.code,
              message: universeError.message,
              details: universeError.details,
              hint: universeError.hint,
              universeId: universe.id,
              creatorId: user.id,
            });
            console.error('[saveUniverse] Full error:', JSON.stringify(universeError, null, 2));
          } else {
            console.log('[saveUniverse] Successfully saved universe to Supabase:', universe.id);
            // Save galaxies only if not skipping (to prevent recursion)
            if (!skipGalaxies) {
              for (const galaxy of universe.galaxies) {
                await saveGalaxy(galaxy, universe.id, true); // Skip worlds to prevent recursion
              }
            }
          }
        }
      } catch (error) {
        console.warn('[saveUniverse] Supabase save failed, using localStorage:', error);
      }
    }
  } catch (error) {
    console.warn('[saveUniverse] Error in saveUniverse, continuing with localStorage:', error);
  } finally {
    isSavingUniverse = false;
  }
  
  // Always save to localStorage as backup
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.UNIVERSE, JSON.stringify(universe));
  }
}

export async function loadUniverse(): Promise<Universe | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.warn('[loadUniverse] Auth error:', authError);
      }
      if (user) {
        const { data: universeData, error: universeError } = await supabase
          .from('universes')
          .select('id, name, creator_id, created_at')
          .eq('creator_id', user.id)
          .single();
        
        if (universeError) {
          console.warn('[loadUniverse] Error loading universe from Supabase:', universeError);
        } else if (universeData) {
          console.log('[loadUniverse] Loaded universe from Supabase:', universeData.id);
          // Load galaxies
          const { data: galaxiesData, error: galaxiesError } = await supabase
            .from('galaxies')
            .select('id, name, universe_id, release_date, visual_landscape, created_at')
            .eq('universe_id', universeData.id)
            .order('created_at', { ascending: true });
          
          if (galaxiesError) {
            console.warn('[loadUniverse] Error loading galaxies from Supabase:', galaxiesError);
          }
          
          const galaxies: Galaxy[] = [];
          if (galaxiesData) {
            for (const galaxyData of galaxiesData) {
              const galaxy = await loadGalaxy(galaxyData.id);
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
          
          // Update localStorage with data from Supabase
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.UNIVERSE, JSON.stringify(universe));
          }
          
          return universe;
        }
      } else {
        console.warn('[loadUniverse] No authenticated user, falling back to localStorage');
      }
    } catch (error) {
      console.warn('[loadUniverse] Supabase load failed, trying localStorage:', error);
    }
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEYS.UNIVERSE);
    if (stored) {
      console.log('[loadUniverse] Loaded universe from localStorage');
      return JSON.parse(stored);
    }
  }
  
  return null;
}

// ============================================================================
// Galaxy Storage
// ============================================================================

// Track if we're currently saving a galaxy to prevent circular calls
let isSavingGalaxy = false;

export async function saveGalaxy(galaxy: Galaxy, universeId: string, skipWorlds: boolean = false): Promise<void> {
  // Prevent infinite recursion
  if (isSavingGalaxy) {
    console.warn('[saveGalaxy] Already saving galaxy, skipping to prevent recursion');
    return;
  }
  
  isSavingGalaxy = true;
  
  try {
    if (isSupabaseConfigured()) {
      try {
        const { error: galaxyError } = await supabase
          .from('galaxies')
          .upsert({
            id: galaxy.id,
            universe_id: universeId,
            name: galaxy.name,
            release_date: galaxy.releaseDate || null,
            visual_landscape: galaxy.visualLandscape,
            created_at: galaxy.createdAt,
            updated_at: new Date().toISOString(),
          });
        
        if (galaxyError) {
          console.error('[saveGalaxy] Error saving galaxy to Supabase:', {
            error: galaxyError,
            code: galaxyError.code,
            message: galaxyError.message,
            details: galaxyError.details,
            hint: galaxyError.hint,
            galaxyId: galaxy.id,
            universeId: universeId,
          });
          console.error('[saveGalaxy] Full error object:', JSON.stringify(galaxyError, null, 2));
        } else {
          console.log('[saveGalaxy] Successfully saved galaxy to Supabase:', galaxy.id);
          if (!skipWorlds) {
            // Save worlds only if not skipping (to prevent recursion)
            for (const world of galaxy.worlds) {
              await saveWorld(world, galaxy.id);
            }
          }
        }
      } catch (error) {
        console.warn('Supabase save failed, using localStorage:', error);
      }
    }
  } catch (error) {
    console.warn('Error in saveGalaxy, continuing with localStorage:', error);
  } finally {
    isSavingGalaxy = false;
  }
  
  // Always update localStorage directly (avoid calling saveUniverse which would call saveGalaxy again)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.UNIVERSE);
      if (stored) {
        const universe = JSON.parse(stored);
        const updatedGalaxies = universe.galaxies.filter((g: Galaxy) => g.id !== galaxy.id);
        updatedGalaxies.push(galaxy);
        universe.galaxies = updatedGalaxies;
        localStorage.setItem(STORAGE_KEYS.UNIVERSE, JSON.stringify(universe));
      }
    } catch (error) {
      console.warn('[saveGalaxy] Error updating localStorage:', error);
    }
  }
}

export async function loadGalaxy(galaxyId: string): Promise<Galaxy | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data: galaxyData, error: galaxyError } = await supabase
        .from('galaxies')
        .select('id, name, universe_id, release_date, visual_landscape, created_at')
        .eq('id', galaxyId)
        .single();
      
      if (galaxyError) {
        console.warn('[loadGalaxy] Error loading galaxy from Supabase:', galaxyError);
      } else if (galaxyData) {
        // Load worlds directly from database (don't call loadWorld to avoid recursion)
        const { data: worldsData, error: worldsError } = await supabase
          .from('worlds')
          .select('id, name, galaxy_id, release_date, color, visual_landscape, snapshot_strategy, is_public, is_released, created_at')
          .eq('galaxy_id', galaxyId)
          .order('created_at', { ascending: true });
        
        if (worldsError) {
          console.warn('[loadGalaxy] Error loading worlds from Supabase:', worldsError);
        }
        
        const worlds: World[] = [];
        if (worldsData) {
          for (const worldData of worldsData) {
            worlds.push({
              id: worldData.id,
              name: worldData.name,
              galaxyId: worldData.galaxy_id,
              releaseDate: worldData.release_date,
              color: worldData.color,
              visualLandscape: worldData.visual_landscape as World['visualLandscape'],
              snapshotStrategy: worldData.snapshot_strategy as World['snapshotStrategy'] || undefined,
              isPublic: worldData.is_public,
              isReleased: worldData.is_released,
              createdAt: worldData.created_at,
            });
          }
        }
        
        return {
          id: galaxyData.id,
          name: galaxyData.name,
          universeId: galaxyData.universe_id,
          releaseDate: galaxyData.release_date || undefined,
          visualLandscape: galaxyData.visual_landscape as Galaxy['visualLandscape'],
          worlds,
          createdAt: galaxyData.created_at,
        };
      }
    } catch (error) {
      console.warn('[loadGalaxy] Supabase load failed, trying localStorage:', error);
    }
  }
  
  // Fallback: try to get from localStorage universe
  const universe = await loadUniverse();
  if (universe) {
    return universe.galaxies.find(g => g.id === galaxyId) || null;
  }
  
  return null;
}

// ============================================================================
// World Storage
// ============================================================================

// Track recently saved worlds to prevent infinite loops
const recentlySavedWorlds = new Set<string>();
const SAVE_COOLDOWN_MS = 2000; // 2 second cooldown between saves of the same world

export async function saveWorld(world: World, galaxyId: string): Promise<void> {
  // Prevent saving the same world multiple times in quick succession
  if (recentlySavedWorlds.has(world.id)) {
    console.warn('[saveWorld] Skipping duplicate save for world:', world.id);
    return;
  }
  
  recentlySavedWorlds.add(world.id);
  setTimeout(() => {
    recentlySavedWorlds.delete(world.id);
  }, SAVE_COOLDOWN_MS);
  
  if (isSupabaseConfigured()) {
    try {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.warn('[saveWorld] Auth error:', authError);
      }
      if (!user) {
        console.warn('[saveWorld] User not authenticated, skipping Supabase save');
      } else {
        const { error: worldError } = await supabase
          .from('worlds')
          .upsert({
            id: world.id,
            galaxy_id: galaxyId,
            name: world.name,
            release_date: world.releaseDate,
            color: world.color,
            visual_landscape: world.visualLandscape,
            snapshot_strategy: world.snapshotStrategy || null,
            is_public: world.isPublic,
            is_released: world.isReleased,
            created_at: world.createdAt,
            updated_at: new Date().toISOString(),
          });
        
        if (worldError) {
          // If it's a 403/RLS error, provide helpful message but don't throw
          if (worldError.code === '42501' || worldError.code === 'PGRST301' || worldError.message?.includes('permission denied') || worldError.message?.includes('row-level security') || worldError.message?.includes('RLS')) {
            console.warn('[saveWorld] RLS Policy Error (403) - Falling back to localStorage.');
            console.warn('[saveWorld] User ID:', user.id, '| Galaxy ID:', galaxyId, '| World ID:', world.id);
            console.warn('[saveWorld] Note: Galaxy must exist in Supabase before saving worlds. Make sure saveGalaxy is called first.');
            // Don't log full error details for RLS errors to reduce noise
          } else {
            console.error('[saveWorld] Error saving world to Supabase:', {
              error: worldError,
              code: worldError.code,
              message: worldError.message,
              details: worldError.details,
              hint: worldError.hint,
              worldId: world.id,
              galaxyId: galaxyId,
              userId: user.id,
            });
          }
          // Continue to localStorage fallback - don't throw
        } else {
          // Only log success once per world to reduce noise
          // (cooldown prevents multiple logs)
        }
      }
    } catch (error) {
      console.warn('[saveWorld] Supabase save failed, using localStorage:', error);
    }
  }
  
  // Update localStorage directly (avoid circular dependency with saveGalaxy)
  if (typeof window !== 'undefined') {
    try {
      const universe = await loadUniverse();
      if (universe) {
        // Find the galaxy and update its worlds
        const galaxy = universe.galaxies.find(g => g.id === galaxyId);
        if (galaxy) {
          const updatedWorlds = galaxy.worlds.filter(w => w.id !== world.id);
          updatedWorlds.push(world);
          galaxy.worlds = updatedWorlds;
          // Save universe with updated galaxy
          await saveUniverse(universe);
        }
      }
    } catch (error) {
      console.warn('[saveWorld] Error updating localStorage:', error);
    }
  }
}

export async function loadWorld(worldId: string): Promise<World | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data: worldData } = await supabase
        .from('worlds')
        .select('*')
        .eq('id', worldId)
        .single();
      
      if (worldData) {
        return {
          id: worldData.id,
          name: worldData.name,
          galaxyId: worldData.galaxy_id,
          releaseDate: worldData.release_date,
          color: worldData.color,
          visualLandscape: worldData.visual_landscape as World['visualLandscape'],
          snapshotStrategy: worldData.snapshot_strategy as World['snapshotStrategy'] || undefined,
          isPublic: worldData.is_public,
          isReleased: worldData.is_released,
          createdAt: worldData.created_at,
        };
      }
    } catch (error) {
      console.warn('Supabase load failed, trying localStorage:', error);
    }
  }
  
  // Fallback: try to get from localStorage
  const universe = await loadUniverse();
  if (universe) {
    for (const galaxy of universe.galaxies) {
      const world = galaxy.worlds.find(w => w.id === worldId);
      if (world) return world;
    }
  }
  
  return null;
}

// ============================================================================
// Current Galaxy (for navigation state)
// ============================================================================

export function saveCurrentGalaxyId(galaxyId: string | null): void {
  if (typeof window !== 'undefined') {
    if (galaxyId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_GALAXY, galaxyId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_GALAXY);
    }
  }
}

export function loadCurrentGalaxyId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_GALAXY);
  }
  return null;
}

// ============================================================================
// Delete Functions
// ============================================================================

export async function deleteGalaxy(galaxyId: string, universeId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      // Delete all worlds in the galaxy first
      const { data: worldsData } = await supabase
        .from('worlds')
        .select('id')
        .eq('galaxy_id', galaxyId);
      
      if (worldsData) {
        for (const world of worldsData) {
          await deleteWorld(world.id, galaxyId);
        }
      }
      
      // Delete the galaxy
      const { error } = await supabase
        .from('galaxies')
        .delete()
        .eq('id', galaxyId);
      
      if (error) {
        console.warn('Error deleting galaxy from Supabase:', error);
      }
    } catch (error) {
      console.warn('Supabase delete failed, using localStorage:', error);
    }
  }
  
  // Update localStorage universe
  try {
    const universe = await loadUniverse();
    if (universe) {
      const updatedGalaxies = universe.galaxies.filter(g => g.id !== galaxyId);
      const updatedUniverse = { ...universe, galaxies: updatedGalaxies };
      await saveUniverse(updatedUniverse);
      console.log('[deleteGalaxy] Updated localStorage universe, removed galaxy:', galaxyId);
    } else {
      console.warn('[deleteGalaxy] No universe found in localStorage');
    }
  } catch (error) {
    console.warn('[deleteGalaxy] Error updating localStorage:', error);
  }
}

export async function deleteWorld(worldId: string, galaxyId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('worlds')
        .delete()
        .eq('id', worldId);
      
      if (error) {
        console.warn('Error deleting world from Supabase:', error);
      }
    } catch (error) {
      console.warn('Supabase delete failed, using localStorage:', error);
    }
  }
  
  // Update localStorage galaxy
  try {
    const universe = await loadUniverse();
    if (universe) {
      const galaxy = universe.galaxies.find(g => g.id === galaxyId);
      if (galaxy) {
        const updatedWorlds = galaxy.worlds.filter(w => w.id !== worldId);
        const updatedGalaxy = { ...galaxy, worlds: updatedWorlds };
        await saveGalaxy(updatedGalaxy, universe.id);
      }
    }
  } catch (error) {
    console.warn('Error updating localStorage for world deletion:', error);
  }
}

