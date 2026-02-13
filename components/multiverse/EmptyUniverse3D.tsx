'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Universe } from '@/types';

// Dynamically import the entire 3D view to prevent SSR
// Use .client.tsx version which has direct Three.js imports (only loaded at runtime)
const EmptyUniverse3DView = dynamic(
  () => import('./EmptyUniverse3DView.client').then((mod) => mod.EmptyUniverse3DView),
  { 
    ssr: false,
    loading: () => (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="text-yellow-400 font-star-wars text-xl">Loading universe...</div>
      </div>
    )
  }
);

interface EmptyUniverse3DProps {
  universe: Universe;
  onCreateGalaxy?: (galaxyData: any) => void;
}

export function EmptyUniverse3D({ universe, onCreateGalaxy }: EmptyUniverse3DProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Ensure we're fully client-side before rendering Three.js
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="text-yellow-400 font-star-wars text-xl">Loading universe...</div>
      </div>
    );
  }

  return <EmptyUniverse3DView universe={universe} onCreateGalaxy={onCreateGalaxy} />;
}

