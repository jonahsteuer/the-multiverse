'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Galaxy, World } from '@/types';

// Dynamically import the entire 3D view to prevent SSR
const Galaxy3DView = dynamic(
  () => import('./Galaxy3DView').then((mod) => mod.Galaxy3DView),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-black relative flex items-center justify-center">
        <div className="text-yellow-400 font-star-wars text-xl">Loading galaxy...</div>
      </div>
    )
  }
);

interface DistantGalaxyInfo {
  galaxy: Galaxy;
  artistName: string;
  index: number;
  onSwitch: () => void;
}

interface Galaxy3DWrapperProps {
  galaxy: Galaxy;
  onWorldClick?: (world: World) => void;
  distantGalaxies?: DistantGalaxyInfo[];
  onPrevGalaxy?: () => void;
  onNextGalaxy?: () => void;
  showGalaxyNav?: boolean;
}

export function Galaxy3DWrapper({ galaxy, onWorldClick, distantGalaxies, onPrevGalaxy, onNextGalaxy, showGalaxyNav }: Galaxy3DWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-screen bg-black relative flex items-center justify-center">
        <div className="text-yellow-400 font-star-wars text-xl">Loading galaxy...</div>
      </div>
    );
  }

  return (
    <Galaxy3DView
      key={`galaxy-3d-${galaxy.id}-${galaxy.worlds.length}`}
      galaxy={galaxy}
      onWorldClick={onWorldClick}
      distantGalaxies={distantGalaxies}
      onPrevGalaxy={onPrevGalaxy}
      onNextGalaxy={onNextGalaxy}
      showGalaxyNav={showGalaxyNav}
    />
  );
}

