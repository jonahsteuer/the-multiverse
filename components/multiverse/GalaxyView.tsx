'use client';

import { useState, useEffect } from 'react';
import { connectGoogleCalendar, checkCalendarConnection } from '@/lib/google-oauth';
import dynamic from 'next/dynamic';
import type { Galaxy, World, Universe, ArtistProfile, BrainstormResult } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Dynamically import Galaxy3DWrapper to prevent Next.js from analyzing Three.js during compilation
const Galaxy3DWrapper = dynamic(
  () => import('./Galaxy3DWrapper').then(mod => ({ default: mod.Galaxy3DWrapper })),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-black relative flex items-center justify-center">
        <div className="text-yellow-400 font-star-wars text-xl">Loading 3D view...</div>
      </div>
    )
  }
);

const WorldCreationForm = dynamic(
  () => import('./WorldCreationForm').then(mod => ({ default: mod.WorldCreationForm })),
  { ssr: false }
);

const WorldDetailView = dynamic(
  () => import('./WorldDetailView').then(mod => ({ default: mod.WorldDetailView })),
  { ssr: false }
);

const EnhancedCalendar = dynamic(
  () => import('./EnhancedCalendar').then(mod => ({ default: mod.EnhancedCalendar })),
  { ssr: false }
);

const BrainstormContent = dynamic(
  () => import('./BrainstormContent').then(mod => ({ default: mod.BrainstormContent })),
  { ssr: false }
);

interface GalaxyViewProps {
  galaxy: Galaxy;
  universe: Universe;
  artistProfile?: ArtistProfile;
  onUpdateWorld?: (worldData: Partial<World>) => void;
  onDeleteGalaxy?: () => void;
  onDeleteWorld?: (worldId: string) => void;
  onSignOut?: () => void;
}

export function GalaxyView({ galaxy, universe, artistProfile, onUpdateWorld, onDeleteGalaxy, onDeleteWorld, onSignOut }: GalaxyViewProps) {
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [showWorldForm, setShowWorldForm] = useState(false);
  const [showWorldDetail, setShowWorldDetail] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [brainstormResult, setBrainstormResult] = useState<BrainstormResult | null>(null);
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false);

  // Check Google Calendar connection status when calendar modal opens
  useEffect(() => {
    if (showCalendar) {
      checkCalendarConnection().then(setIsGoogleCalendarConnected);
    }
  }, [showCalendar]);

  const handleWorldClick = (world: World) => {
    // If world has a name (has been created), show detail view
    // Otherwise, show creation form
    if (world.name && world.name !== 'Unnamed World') {
      setSelectedWorld(world);
      setShowWorldDetail(true);
    } else {
      setSelectedWorld(world);
      setShowWorldForm(true);
    }
  };

  const handleWorldCreated = (worldData: Partial<World>) => {
    // TODO: Save world to database
    // For now, just close the form and let parent handle it
    setShowWorldForm(false);
    setSelectedWorld(null);
    
    // Call parent callback if provided
    if (onUpdateWorld) {
      onUpdateWorld(worldData);
    }
  };

  const handleWorldUpdate = (updatedWorld: World) => {
    // Update the world in the galaxy
    // TODO: Save to database
    if (onUpdateWorld) {
      onUpdateWorld(updatedWorld);
    }
    setShowWorldDetail(false);
    setSelectedWorld(null);
  };

  const handleWorldDelete = async (worldId: string) => {
    console.log('[GalaxyView] handleWorldDelete called for world:', worldId);
    if (onDeleteWorld) {
      console.log('[GalaxyView] Calling onDeleteWorld handler');
      await onDeleteWorld(worldId);
    } else {
      console.warn('[GalaxyView] onDeleteWorld handler not provided');
    }
    setShowWorldDetail(false);
    setSelectedWorld(null);
  };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 3D Galaxy View */}
      <Galaxy3DWrapper
        key={`galaxy-${galaxy.id}-${galaxy.worlds.length}`}
        galaxy={galaxy}
        onWorldClick={handleWorldClick}
      />

      {/* Info Panel */}
      <div className="absolute top-4 left-4 z-10 bg-black/80 border border-yellow-500/30 rounded-lg p-4 max-w-xs">
        <h2 className="text-xl font-star-wars text-yellow-400 mb-2">{galaxy.name}</h2>
        <p className="text-sm text-gray-400 mb-2">
          {galaxy.worlds.length} world{galaxy.worlds.length !== 1 ? 's' : ''} created
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Click on a world to view timeline, shoot days, and calendar sync
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setShowCalendar(true)}
              className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars font-bold rounded text-sm"
            >
              View Calendar
            </button>
            {onDeleteGalaxy && (
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[GalaxyView] Erase Galaxy button clicked for galaxy:', galaxy.id, galaxy.name);
                  console.log('[GalaxyView] Galaxy has', galaxy.worlds.length, 'worlds');
                  await onDeleteGalaxy();
                }}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-star-wars font-bold rounded text-sm"
                title={`Erase Galaxy "${galaxy.name}" (${galaxy.worlds.length} world${galaxy.worlds.length !== 1 ? 's' : ''})`}
              >
                🗑️
              </button>
            )}
          </div>
          {/* Brainstorm Content Button */}
          <button
            onClick={() => setShowBrainstorm(true)}
            className={`w-full px-3 py-2 font-star-wars font-bold rounded text-sm transition-all ${
              brainstormResult
                ? 'bg-green-600/30 border border-green-500/50 text-green-300 hover:bg-green-600/40'
                : 'bg-purple-600 hover:bg-purple-700 text-white animate-pulse'
            }`}
          >
            {brainstormResult ? '✅ Content Brainstormed' : '🧠 Brainstorm Content'}
          </button>
        </div>
      </div>

      {/* Sign Out Button (top right) */}
      {onSignOut && (
        <div className="absolute top-4 right-4 z-10 bg-black/80 border border-yellow-500/30 rounded-lg p-2">
          <button
            onClick={onSignOut}
            className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars font-bold rounded text-sm"
            title="Sign Out"
          >
            🚪 Sign Out
          </button>
        </div>
      )}

      {/* Create World Button (if there are empty slots) */}
      {galaxy.worlds.length < 10 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={() => setShowWorldForm(true)}
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars font-bold rounded-lg transition-all shadow-lg"
          >
            + Create World
          </button>
        </div>
      )}

      {/* World Creation Form */}
      {showWorldForm && (
        <WorldCreationForm
          galaxyId={galaxy.id}
          galaxyVisualLandscape={galaxy.visualLandscape}
          onSuccess={handleWorldCreated}
          onCancel={() => {
            setShowWorldForm(false);
            setSelectedWorld(null);
          }}
        />
      )}

      {/* World Detail View */}
      {showWorldDetail && selectedWorld && (
        <WorldDetailView
          world={selectedWorld}
          universe={universe}
          artistProfile={artistProfile}
          onClose={() => {
            setShowWorldDetail(false);
            setSelectedWorld(null);
          }}
          onUpdate={handleWorldUpdate}
          onDelete={handleWorldDelete}
        />
      )}

      {/* Calendar View */}
      {showCalendar && (
        <>
          {/* Backdrop - Click to close */}
          <div 
            className="fixed inset-0 bg-black/90 z-50" 
            onClick={() => setShowCalendar(false)}
          />
          
          {/* Calendar Modal */}
          <div className="fixed inset-0 z-[51] flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
            <Card 
              className="w-full max-w-6xl bg-gray-900 border-gray-700 pointer-events-auto"
              onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
            >
              <CardHeader className="relative">
                <div className="flex items-center justify-between gap-4 pr-24">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl text-white">Snapshot Calendar</CardTitle>
                    <CardDescription className="text-gray-400">
                      {galaxy.name} - All Worlds
                    </CardDescription>
                  </div>
                </div>
                {/* Action Buttons - Positioned absolutely in top right */}
                <div className="absolute top-6 right-6 flex gap-2 z-10">
                  {!isGoogleCalendarConnected && (
                    <Button
                      onClick={() => connectGoogleCalendar()}
                      variant="outline"
                      className="font-star-wars border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      📅 Sync Google Calendar
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowCalendar(false)}
                    variant="outline"
                    className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <EnhancedCalendar
                  songName={galaxy.name}
                  releaseDate={galaxy.releaseDate || ''}
                  showGoogleSync={false}
                  artistProfile={artistProfile}
                  brainstormResult={brainstormResult || undefined}
                  onTaskComplete={(taskId) => {
                    console.log('[GalaxyView] Task completed:', taskId);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Brainstorm Content Modal */}
      {showBrainstorm && (
        <BrainstormContent
          galaxyId={galaxy.id}
          galaxyName={galaxy.name}
          scheduledPosts={getBrainstormPosts()}
          artistProfile={artistProfile}
          preferredDays={artistProfile?.preferredDays || ['saturday', 'sunday']}
          onComplete={(result) => {
            console.log('[GalaxyView] Brainstorm completed:', result);
            setBrainstormResult(result);
            setShowBrainstorm(false);
          }}
          onClose={() => setShowBrainstorm(false)}
        />
      )}
    </div>
  );

  // Helper to extract scheduled posts for the brainstorm component
  function getBrainstormPosts() {
    // Generate the same posts that EnhancedCalendar would generate
    // This gives the brainstorm component access to what's on the calendar
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const posts: { id: string; index: number; title: string; type: 'teaser' | 'promo' | 'audience-builder'; date: string; startTime: string; endTime: string }[] = [];

    const releases = (artistProfile as any)?.releases || [];
    const strategyDesc = ((artistProfile as any)?.releaseStrategyDescription || '').toLowerCase();

    // Generate 28 days of dates
    const allDays: { date: Date; dateStr: string; weekNum: number; dayOfWeek: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      allDays.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        weekNum: Math.floor(i / 7),
        dayOfWeek: date.getDay(),
      });
    }

    const prefDays = artistProfile?.preferredDays || ['saturday', 'sunday'];
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Collect posting phase posts (weeks 3-4)
    let postCount = 0;
    for (let weekNum = 2; weekNum < 4; weekNum++) {
      const weekDays = allDays.filter(d => d.weekNum === weekNum);
      const sortedDays = [...weekDays].sort((a, b) => {
        const aPreferred = prefDays.includes(dayNames[a.dayOfWeek]) ? 0 : 1;
        const bPreferred = prefDays.includes(dayNames[b.dayOfWeek]) ? 0 : 1;
        if (aPreferred !== bPreferred) return aPreferred - bPreferred;
        return a.dayOfWeek - b.dayOfWeek;
      });

      let postsThisWeek = 0;
      let taskCount = 0;
      for (const day of sortedDays) {
        if (postsThisWeek >= 3) break;
        const shouldPost = taskCount % 2 === 0;
        if (shouldPost) {
          // Determine post type (same logic as EnhancedCalendar)
          let postType: 'audience-builder' | 'teaser' | 'promo' = 'audience-builder';
          const postDate = new Date(day.date);

          // Check for upcoming releases (teaser)
          for (const release of releases) {
            if (!release.releaseDate || release.releaseDate === 'TBD' || release.releaseDate === null) continue;
            const releaseDate = new Date(release.releaseDate);
            const daysUntilRelease = Math.floor((releaseDate.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilRelease > 0 && daysUntilRelease <= 14) {
              postType = 'teaser';
              break;
            }
          }

          if (postType === 'audience-builder') {
            // Check for recent releases (promo)
            for (const release of releases) {
              if (!release.releaseDate || release.releaseDate === 'TBD' || release.releaseDate === null) continue;
              const releaseDate = new Date(release.releaseDate);
              const daysSinceRelease = Math.floor((postDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceRelease > 0 && daysSinceRelease <= 30) {
                postType = 'promo';
                break;
              }
            }
          }

          if (postType === 'audience-builder' && strategyDesc.includes('promote') && strategyDesc.includes('bit')) {
            postType = postsThisWeek % 4 === 0 ? 'promo' : 'audience-builder';
          }

          const postTypeLabel = postType.charAt(0).toUpperCase() + postType.slice(1).replace('-', ' ');
          posts.push({
            id: `post-w${weekNum + 1}-${taskCount}`,
            index: postCount,
            title: `${postTypeLabel} Post`,
            type: postType,
            date: day.dateStr,
            startTime: '10:00',
            endTime: '10:30',
          });
          postCount++;
          postsThisWeek++;
        }
        taskCount++;
      }
    }

    return posts;
  }
}
