'use client';

import dynamic from 'next/dynamic';
import type { Galaxy, Universe, World, ArtistProfile, GalaxyEntry } from '@/types';

const GalaxyView = dynamic(
  () => import('./GalaxyView').then(mod => ({ default: mod.GalaxyView })),
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

interface GalaxyViewWrapperProps {
  galaxy: Galaxy;
  universe: Universe;
  artistProfile?: ArtistProfile;
  onUpdateWorld?: (worldData: Partial<World>) => void;
  onDeleteGalaxy?: () => void;
  onDeleteWorld?: (worldId: string) => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => void;
  allGalaxies?: GalaxyEntry[];
  activeGalaxyIndex?: number;
  onSwitchGalaxy?: (index: number) => void;
}

export function GalaxyViewWrapper(props: GalaxyViewWrapperProps) {
  return <GalaxyView {...props} />;
}

