'use client';

import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import type { Galaxy, World } from '@/types';

// Lazy load ALL Three.js components only on client (including the core THREE library)
// This prevents Next.js from analyzing Three.js during compilation
// We'll load these dynamically using import() in useEffect
let THREE: any;
let Canvas: any;
let useFrame: any;
let OrbitControls: any;
let Stars: any;
let Text: any;

interface DistantGalaxyInfo {
  galaxy: Galaxy;
  artistName: string;
  index: number;
  onSwitch: () => void;
}

interface Galaxy3DViewProps {
  galaxy: Galaxy;
  onWorldClick?: (world: World) => void;
  distantGalaxies?: DistantGalaxyInfo[];
  onPrevGalaxy?: () => void;
  onNextGalaxy?: () => void;
  showGalaxyNav?: boolean;
}

// Sun in center
function Sun() {
  const meshRef = useRef<any>(null);

  if (!useFrame || !THREE) return null;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.5, 32, 32]} />
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFD700"
        emissiveIntensity={1.5}
      />
      <pointLight intensity={3} distance={30} decay={2} />
    </mesh>
  );
}

// Individual World orbiting around sun
function WorldSphere({
  world,
  angle,
  distance,
  onClick,
}: {
  world: World;
  angle: number;
  distance: number;
  onClick: () => void;
}) {
  const meshRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);
  const orbitRef = useRef<any>(null);

  if (!useFrame || !THREE) return null;

  useFrame((state: any) => {
    if (orbitRef.current) {
      // Orbit around sun - each world has its own speed based on distance
      const time = state.clock.getElapsedTime();
      const speed = 0.3 / (distance / 4); // Closer worlds orbit faster
      orbitRef.current.position.x = Math.cos(angle + time * speed) * distance;
      orbitRef.current.position.z = Math.sin(angle + time * speed) * distance;
    }
    if (meshRef.current) {
      // Spin on axis
      meshRef.current.rotation.y += 0.03;
    }
  });

  // Only grey out worlds that are explicitly marked as unreleased
  // Newly created worlds should show in their selected color immediately
  // Grey out only if the world is explicitly marked as not public AND not released
  // For now, show all worlds in their color (greyed out state can be added later for specific use cases)
  const isGreyedOut = false; // Show all worlds in their selected color
  const color = world.color || '#FFFFFF';

  return (
    <group ref={orbitRef}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.4 : 1.2}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={isGreyedOut ? '#000000' : color}
          emissiveIntensity={isGreyedOut ? 0 : 0.8}
          opacity={isGreyedOut ? 0.5 : 1}
          transparent={isGreyedOut}
        />
      </mesh>
      {/* World Name Label - Above the world */}
      {!isGreyedOut && Text && (
        <Text
          position={[0, 1.8, 0]}
          fontSize={0.4}
          color="#FFD700"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {world.name}
        </Text>
      )}
      {/* Hover indicator */}
      {hovered && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[1.3, 1.5, 32]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.5}
            transparent
            opacity={0.6}
            side={THREE?.DoubleSide || 2}
          />
        </mesh>
      )}
    </group>
  );
}

// Distant galaxy cluster — renders as a faint mini star system far from the main galaxy
function DistantGalaxyCluster({
  info,
  position,
}: {
  info: DistantGalaxyInfo;
  position: [number, number, number];
}) {
  const groupRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  if (!useFrame || !THREE) return null;

  useFrame((state: any) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      // Gentle slow rotation of the whole cluster
      groupRef.current.rotation.y = t * 0.05;
    }
  });

  // Pick a subtle cluster color based on the first world color, or default to a cool blue-white
  const clusterColor = info.galaxy.worlds[0]?.color || '#8888ff';

  // Evenly space 2-4 tiny worlds around the mini-sun
  const miniWorldCount = Math.min(Math.max(info.galaxy.worlds.length, 1), 4);
  const miniWorlds = Array.from({ length: miniWorldCount }, (_, i) => ({
    angle: (i / miniWorldCount) * Math.PI * 2,
    distance: 1.8 + i * 0.5,
    color: info.galaxy.worlds[i]?.color || clusterColor,
  }));

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={() => info.onSwitch()}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Mini sun */}
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={hovered ? '#ffffaa' : '#ffee88'}
          emissive={hovered ? '#ffee88' : '#ffcc44'}
          emissiveIntensity={hovered ? 1.2 : 0.6}
          transparent
          opacity={hovered ? 0.95 : 0.75}
        />
        <pointLight intensity={hovered ? 1.2 : 0.5} distance={6} decay={2} />
      </mesh>

      {/* Tiny orbiting worlds */}
      {miniWorlds.map((mw, i) => (
        <TinyOrbitingWorld key={i} angle={mw.angle} distance={mw.distance} color={mw.color} hovered={hovered} />
      ))}

      {/* Faint orbit ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 1.85, 32]} />
        <meshStandardMaterial
          color="#aabbff"
          emissive="#aabbff"
          emissiveIntensity={0.08}
          transparent
          opacity={hovered ? 0.35 : 0.12}
          side={THREE?.DoubleSide || 2}
        />
      </mesh>

      {/* Label */}
      {Text && (
        <Text
          position={[0, 2.6, 0]}
          fontSize={0.55}
          color={hovered ? '#FFD700' : '#aaccff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
          fillOpacity={hovered ? 1 : 0.7}
        >
          {info.artistName || info.galaxy.name}
        </Text>
      )}
      {/* Tap-to-visit hint on hover */}
      {hovered && Text && (
        <Text
          position={[0, -1.5, 0]}
          fontSize={0.38}
          color="#FFD700"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          tap to visit
        </Text>
      )}
    </group>
  );
}

// Tiny orbiting world for the distant cluster
function TinyOrbitingWorld({
  angle,
  distance,
  color,
  hovered,
}: {
  angle: number;
  distance: number;
  color: string;
  hovered: boolean;
}) {
  const orbitRef = useRef<any>(null);

  if (!useFrame || !THREE) return null;

  useFrame((state: any) => {
    if (orbitRef.current) {
      const t = state.clock.getElapsedTime();
      const speed = 0.25 / distance;
      orbitRef.current.position.x = Math.cos(angle + t * speed) * distance;
      orbitRef.current.position.z = Math.sin(angle + t * speed) * distance;
    }
  });

  return (
    <group ref={orbitRef}>
      <mesh>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.9 : 0.4}
          transparent
          opacity={hovered ? 0.9 : 0.6}
        />
      </mesh>
    </group>
  );
}

// Main 3D Scene
function Scene({ galaxy, onWorldClick, distantGalaxies }: Galaxy3DViewProps) {
  // Don't render if Three.js isn't loaded
  if (!THREE || !OrbitControls || !Stars || !useFrame) {
    return null;
  }

  // Calculate orbital positions for worlds - each on its own concentric orbit
  // Use useMemo to recalculate when galaxy.worlds changes
  const worldData = useMemo(() => {
    return galaxy.worlds.map((world, index) => {
    // Each world gets its own orbit distance (concentric orbits)
    // First world at distance 5, each subsequent world 2 units farther
    const baseDistance = 5;
    const distance = baseDistance + (index * 2);
    
    // Distribute worlds evenly around their orbit
    // Each world starts at a different angle for visual variety
    const angle = (index * 0.618) * Math.PI * 2; // Golden angle for better distribution
    
    return { world, angle, distance };
    });
  }, [galaxy.worlds, galaxy.worlds.length]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      <Stars radius={50} depth={30} count={2000} factor={4} fade speed={1} />

      {/* Main galaxy group — shifted down so todo list (top-left) doesn't overlap */}
      <group position={[0, -3, 0]}>
        {/* Sun in center */}
        <Sun />

        {/* Worlds orbiting - each on its own concentric orbit */}
        {worldData.map(({ world, angle, distance }, index) => (
          <WorldSphere
            key={world.id}
            world={world}
            angle={angle}
            distance={distance}
            onClick={() => onWorldClick?.(world)}
          />
        ))}

        {/* Orbital rings (visual guides) */}
        {worldData.map(({ distance }, index) => (
          <mesh key={`ring-${index}`} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[distance - 0.1, distance + 0.1, 64]} />
            <meshStandardMaterial
              color="#FFD700"
              emissive="#FFD700"
              emissiveIntensity={0.1}
              transparent
              opacity={0.2}
              side={THREE?.DoubleSide || 2}
            />
          </mesh>
        ))}
      </group>

      {/* Distant galaxies — faint clusters in the background */}
      {distantGalaxies && distantGalaxies.map((info, i) => {
        // Distribute distant galaxies evenly around the scene at ~65 units away
        const angle = (i / Math.max(distantGalaxies.length, 1)) * Math.PI * 2 + Math.PI / 4;
        const dist = 60 + i * 8;
        const pos: [number, number, number] = [
          Math.cos(angle) * dist,
          (i % 3) * 4 - 4, // slight vertical variation
          Math.sin(angle) * dist,
        ];
        return <DistantGalaxyCluster key={info.galaxy.id} info={info} position={pos} />;
      })}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={distantGalaxies && distantGalaxies.length > 0 ? 80 : 30}
        maxPolarAngle={Math.PI * 0.75}
        minPolarAngle={Math.PI * 0.1}
        autoRotate={false}
      />
    </>
  );
}

export function Galaxy3DView({ galaxy, onWorldClick, distantGalaxies, onPrevGalaxy, onNextGalaxy, showGalaxyNav }: Galaxy3DViewProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Dynamically load Three.js modules only on client side
    // Using dynamic import() - webpack will bundle these but only when needed
    if (typeof window !== 'undefined' && !THREE) {
      const loadModules = async () => {
        try {
          console.log('[Galaxy3DView] Starting to load Three.js modules...');
          
          // Use dynamic imports - these will be code-split by webpack
          // The key is that we're importing at runtime, not at module level
          const threePromise = import('three').catch(err => {
            console.error('[Galaxy3DView] Failed to load three:', err);
            throw err;
          });
          
          const fiberPromise = import('@react-three/fiber').catch(err => {
            console.error('[Galaxy3DView] Failed to load @react-three/fiber:', err);
            throw err;
          });
          
          const dreiPromise = import('@react-three/drei').catch(err => {
            console.error('[Galaxy3DView] Failed to load @react-three/drei:', err);
            throw err;
          });
          
          console.log('[Galaxy3DView] Waiting for all imports...');
          const [threeModule, fiberModule, dreiModule] = await Promise.all([
            threePromise,
            fiberPromise,
            dreiPromise
          ]);
          
          console.log('[Galaxy3DView] Imports completed, extracting exports...');
          
          // Extract exports - handle both default and named exports
          THREE = (threeModule as any).default || threeModule;
          console.log('[Galaxy3DView] THREE loaded:', !!THREE);
          
          // @react-three/fiber exports Canvas and useFrame as named exports
          const fiber = fiberModule.default || fiberModule;
          Canvas = fiber.Canvas || (fiberModule as any).Canvas;
          useFrame = fiber.useFrame || (fiberModule as any).useFrame;
          console.log('[Galaxy3DView] Fiber loaded - Canvas:', !!Canvas, 'useFrame:', !!useFrame);
          
          // @react-three/drei exports as named exports
          const drei = dreiModule.default || dreiModule;
          OrbitControls = drei.OrbitControls || (dreiModule as any).OrbitControls;
          Stars = drei.Stars || (dreiModule as any).Stars;
          Text = drei.Text || (dreiModule as any).Text;
          console.log('[Galaxy3DView] Drei loaded - OrbitControls:', !!OrbitControls, 'Stars:', !!Stars, 'Text:', !!Text);
          
          if (!Canvas || !useFrame || !OrbitControls) {
            const missing = [];
            if (!Canvas) missing.push('Canvas');
            if (!useFrame) missing.push('useFrame');
            if (!OrbitControls) missing.push('OrbitControls');
            throw new Error(`Failed to extract required exports: ${missing.join(', ')}`);
          }
          
          console.log('[Galaxy3DView] All modules loaded successfully!');
          setIsReady(true);
        } catch (error: any) {
          console.error('[Galaxy3DView] Error loading Three.js modules:', error);
          console.error('[Galaxy3DView] Error stack:', error?.stack);
          setError(error?.message || 'Failed to load 3D view');
        }
      };
      
      // Add a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        if (!isReady) {
          console.error('[Galaxy3DView] Timeout waiting for Three.js modules to load');
          setError('Timeout loading 3D view. Please refresh the page.');
        }
      }, 10000); // 10 second timeout
      
      loadModules().finally(() => {
        clearTimeout(timeout);
      });
    } else if (typeof window !== 'undefined' && THREE && Canvas) {
      // Already loaded
      console.log('[Galaxy3DView] Modules already loaded');
      setIsReady(true);
    }
  }, [isReady]);

  if (error) {
    return (
      <div className="w-full h-screen bg-black relative flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-red-400 font-star-wars text-xl mb-4">Error Loading 3D View</div>
          <div className="text-gray-400 text-sm mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!isReady || !Canvas) {
    return (
      <div className="w-full h-screen bg-black relative flex items-center justify-center">
        <div className="text-center">
          <div className="text-yellow-400 font-star-wars text-xl mb-2">Initializing 3D...</div>
          <div className="text-gray-400 text-sm">Loading Three.js modules...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black relative">
      {/* Galaxy Title Overlay */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 text-center">
        {/* Navigation arrows — only shown when user is part of multiple galaxies */}
        {showGalaxyNav ? (
          <div className="flex items-center justify-center gap-3 mb-1">
            <button
              onClick={onPrevGalaxy}
              className="p-1.5 rounded-full bg-black/60 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 transition-colors text-lg leading-none"
              title="Previous galaxy"
            >
              ◀
            </button>
            <h1 className="text-4xl font-star-wars text-yellow-400">
              {galaxy.name}
            </h1>
            <button
              onClick={onNextGalaxy}
              className="p-1.5 rounded-full bg-black/60 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 transition-colors text-lg leading-none"
              title="Next galaxy"
            >
              ▶
            </button>
          </div>
        ) : (
          <h1 className="text-4xl font-star-wars text-yellow-400 mb-2">
            {galaxy.name}
          </h1>
        )}
        {galaxy.releaseDate && new Date(galaxy.releaseDate) > new Date() && (
          <div className="text-yellow-400 font-star-wars text-lg">
            Releasing in {Math.ceil((new Date(galaxy.releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
          </div>
        )}
        {galaxy.worlds.length > 0 && (
          <div className="text-gray-400 font-star-wars text-sm mt-1">
            {galaxy.worlds.length} {galaxy.worlds.length === 1 ? 'world' : 'worlds'}
          </div>
        )}
      </div>

      <Canvas
        camera={{ position: [0, 12, 20], fov: 60 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <Scene galaxy={galaxy} onWorldClick={onWorldClick} distantGalaxies={distantGalaxies} />
        </Suspense>
      </Canvas>
    </div>
  );
}
