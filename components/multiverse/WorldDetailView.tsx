'use client';

import { useState } from 'react';
import type { World, ShootDay, Universe, Snapshot, ArtistProfile } from '@/types';
import { ReminderSettingsComponent } from './ReminderSettings';
import { EnhancedCalendar } from './EnhancedCalendar';
import { SnapshotStarter } from './SnapshotStarter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { saveWorld, loadWorld } from '@/lib/storage';

interface WorldDetailViewProps {
  world: World;
  universe: Universe; // Pass universe for master schedule
  artistProfile?: ArtistProfile; // Artist profile for snapshot suggestions
  onClose: () => void;
  onUpdate?: (world: World) => void;
  onDelete?: (worldId: string) => void;
}

export function WorldDetailView({ world, universe, artistProfile, onClose, onUpdate, onDelete }: WorldDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'snapshot-starter' | 'snapshot-schedule' | 'settings'>('snapshot-starter');
  const [currentWorld, setCurrentWorld] = useState<World>(world);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-black/95 border-yellow-500/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-star-wars text-yellow-400 mb-2">
                {currentWorld.name}
              </CardTitle>
              <CardDescription className="text-gray-400 font-star-wars">
                Release Date: {new Date(currentWorld.releaseDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {onDelete && (
                <Button
                  onClick={async () => {
                    console.log('[WorldDetailView] Delete button clicked for world:', world.id);
                    if (confirm(`Are you sure you want to delete "${world.name}"? This will also delete all snapshots for this world. This action cannot be undone.`)) {
                      console.log('[WorldDetailView] User confirmed deletion, calling onDelete');
                      await onDelete(world.id);
                      onClose();
                    } else {
                      console.log('[WorldDetailView] User cancelled deletion');
                    }
                  }}
                  variant="outline"
                  className="font-star-wars border-red-600/50 text-red-400 hover:bg-red-600/20"
                >
                  🗑️ Erase World
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="outline"
                className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              >
                Close
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-yellow-500/30 overflow-x-auto">
            <button
              onClick={() => setActiveTab('snapshot-starter')}
              className={`px-4 py-2 font-star-wars transition-colors whitespace-nowrap ${
                activeTab === 'snapshot-starter'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-gray-400 hover:text-yellow-500/70'
              }`}
            >
              Snapshot Starter
            </button>
            <button
              onClick={() => setActiveTab('snapshot-schedule')}
              className={`px-4 py-2 font-star-wars transition-colors whitespace-nowrap ${
                activeTab === 'snapshot-schedule'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-gray-400 hover:text-yellow-500/70'
              }`}
            >
              Snapshot Schedule
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 font-star-wars transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'text-yellow-400 border-b-2 border-yellow-400'
                  : 'text-gray-400 hover:text-yellow-500/70'
              }`}
            >
              Settings
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === 'snapshot-starter' && (
              <SnapshotStarter
                world={currentWorld}
                universe={universe}
                artistProfile={artistProfile}
                onSnapshotApproved={async (snapshot) => {
                  // Add snapshot to world's snapshot strategy
                  const updatedStrategy = currentWorld.snapshotStrategy || {
                    id: `snapshot-strategy-${Date.now()}`,
                    worldId: currentWorld.id,
                    snapshots: [],
                    generatedAt: new Date().toISOString(),
                  };

                  const updatedWorld: World = {
                    ...currentWorld,
                    snapshotStrategy: {
                      ...updatedStrategy,
                      snapshots: [...updatedStrategy.snapshots, snapshot],
                    },
                  };

                  setCurrentWorld(updatedWorld);
                  await saveWorld(updatedWorld, currentWorld.galaxyId);
                  if (onUpdate) onUpdate(updatedWorld);
                }}
                onSnapshotUpdated={async (snapshot) => {
                  const updatedStrategy = currentWorld.snapshotStrategy;
                  if (!updatedStrategy) return;

                  const updatedWorld: World = {
                    ...currentWorld,
                    snapshotStrategy: {
                      ...updatedStrategy,
                      snapshots: updatedStrategy.snapshots.map((s) =>
                        s.id === snapshot.id ? snapshot : s
                      ),
                    },
                  };

                  setCurrentWorld(updatedWorld);
                  await saveWorld(updatedWorld, currentWorld.galaxyId);
                  if (onUpdate) onUpdate(updatedWorld);
                }}
                onSnapshotDeleted={async (snapshotId) => {
                  const updatedStrategy = currentWorld.snapshotStrategy;
                  if (!updatedStrategy) return;

                  const updatedWorld: World = {
                    ...currentWorld,
                    snapshotStrategy: {
                      ...updatedStrategy,
                      snapshots: updatedStrategy.snapshots.filter((s) => s.id !== snapshotId),
                    },
                  };

                  setCurrentWorld(updatedWorld);
                  await saveWorld(updatedWorld, currentWorld.galaxyId);
                  if (onUpdate) onUpdate(updatedWorld);
                }}
              />
            )}

            {activeTab === 'snapshot-schedule' && (
              <EnhancedCalendar
                songName={currentWorld.name}
                releaseDate={currentWorld.releaseDate || ''}
                showGoogleSync={true}
                onTaskComplete={(taskId) => {
                  console.log('[WorldDetailView] Task completed:', taskId);
                }}
              />
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* World Info */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-yellow-500/30 bg-black/50">
                    <CardHeader>
                      <CardTitle className="text-lg font-star-wars text-yellow-400">
                        World Color
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div
                          className="w-24 h-24 rounded-lg border-2 border-yellow-500 shadow-lg"
                          style={{ backgroundColor: currentWorld.color }}
                        />
                        <div>
                          <p className="text-white font-mono">{currentWorld.color}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-yellow-500/30 bg-black/50">
                    <CardHeader>
                      <CardTitle className="text-lg font-star-wars text-yellow-400">
                        Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${currentWorld.isReleased ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <span className="text-white">
                            {currentWorld.isReleased ? 'Released' : 'Unreleased'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${currentWorld.isPublic ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <span className="text-white">
                            {currentWorld.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Snapshot Strategy Summary */}
                {currentWorld.snapshotStrategy && (
                  <Card className="border-yellow-500/30 bg-black/50">
                    <CardHeader>
                      <CardTitle className="text-lg font-star-wars text-yellow-400">
                        Snapshot Strategy
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-white">
                          <span className="text-yellow-400 font-star-wars">
                            {currentWorld.snapshotStrategy.snapshots.length}
                          </span>{' '}
                          snapshots scheduled
                        </p>
                        <p className="text-gray-400 text-sm">
                          Generated: {new Date(currentWorld.snapshotStrategy.generatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Visual Landscape */}
                {currentWorld.visualLandscape.images.length > 0 && (
                  <Card className="border-yellow-500/30 bg-black/50">
                    <CardHeader>
                      <CardTitle className="text-lg font-star-wars text-yellow-400">
                        Visual References
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        {currentWorld.visualLandscape.images.map((imageUrl, index) => (
                          <img
                            key={index}
                            src={imageUrl}
                            alt={`Reference ${index + 1}`}
                            className="w-full h-32 object-cover rounded border border-yellow-500/30"
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Reminder Settings */}
                <ReminderSettingsComponent
                  userId={`user-${currentWorld.id}`}
                  onSave={(settings) => {
                    console.log('Reminder settings saved:', settings);
                    // TODO: Save to backend
                  }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

