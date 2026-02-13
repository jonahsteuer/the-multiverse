'use client';

import type { Universe } from '@/types';
import { GalaxyCreationForm } from './GalaxyCreationForm';
import { useState } from 'react';

interface EmptyUniverseViewProps {
  universe: Universe;
  onCreateGalaxy?: (galaxyData: any) => void;
  onSignOut?: () => void;
}

// TEMPORARY: Non-3D version to prevent compilation hangs
// TODO: Re-enable 3D view once we fix the compilation issue
export function EmptyUniverseView({ universe, onCreateGalaxy, onSignOut }: EmptyUniverseViewProps) {
  const [showGalaxyForm, setShowGalaxyForm] = useState(false);

  const handleCreateGalaxy = (galaxyData: any) => {
    if (onCreateGalaxy) {
      onCreateGalaxy(galaxyData);
    }
    setShowGalaxyForm(false);
  };

  if (showGalaxyForm) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <GalaxyCreationForm
          universeId={universe.id}
          onSuccess={handleCreateGalaxy}
          onCancel={() => setShowGalaxyForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center">
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
      
      {/* Simple 2D placeholder instead of 3D view */}
      <div className="text-center">
        <h1 className="text-5xl font-star-wars text-yellow-400 mb-8">
          {universe.name}
        </h1>
        <p className="text-gray-400 mb-8 text-lg">
          Your universe is empty. Create your first galaxy to get started.
        </p>
        <button
          onClick={() => setShowGalaxyForm(true)}
          className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars font-bold rounded text-xl"
        >
          + Create Galaxy
        </button>
      </div>
    </div>
  );
}
