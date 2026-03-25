'use client';

import React from 'react';
import type { ClipFrames, ClipInfo } from '@/app/api/mark-edit/route';

interface ClipSwapDrawerProps {
  /** Index currently sitting at clips[0] of this piece */
  currentClipIndex: number;
  clipInfos: ClipInfo[];
  clipFrames: ClipFrames[];
  onSwap: (newClipIndex: number) => void;
  onClose: () => void;
}

export function ClipSwapDrawer({
  currentClipIndex,
  clipInfos,
  clipFrames,
  onSwap,
  onClose,
}: ClipSwapDrawerProps) {
  // Build a quick lookup: clipIndex → first frame dataUri
  const thumbMap = React.useMemo(() => {
    const m: Record<number, string> = {};
    for (const cf of clipFrames) {
      if (cf.frames.length > 0) m[cf.clipIndex] = cf.frames[0].dataUri;
    }
    return m;
  }, [clipFrames]);

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Drawer panel */}
      <div
        className="w-full max-w-lg bg-gray-950 border border-yellow-500/20 rounded-t-2xl p-4 pb-8"
        style={{ animation: 'slideInUp 180ms ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
            Swap Hook Clip
          </p>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ✕
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mb-3">
          Choose which clip opens this piece. The current hook moves to its original position.
        </p>

        <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
          {clipInfos.map((info) => {
            const isActive = info.index === currentClipIndex;
            const thumb = thumbMap[info.index];
            return (
              <button
                key={info.index}
                onClick={() => { if (!isActive) { onSwap(info.index); } }}
                disabled={isActive}
                className={`relative rounded-lg overflow-hidden border transition-all ${
                  isActive
                    ? 'border-yellow-500/60 opacity-50 cursor-default'
                    : 'border-yellow-500/20 hover:border-yellow-500/50 bg-black cursor-pointer'
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-video relative bg-gray-900">
                  {thumb ? (
                    <img src={thumb} alt={info.name} className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-gray-700 text-xs">#{info.index}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                </div>
                {/* Label */}
                <div className="absolute bottom-1 left-1.5 right-1.5 flex items-end justify-between">
                  <span className="text-[8px] text-yellow-400/80 font-star-wars truncate max-w-[60px]">
                    {info.name.replace(/\.[^.]+$/, '').slice(0, 12)}
                  </span>
                  <span className="text-[8px] text-gray-500 font-mono">
                    #{info.index}
                  </span>
                </div>
                {isActive && (
                  <div className="absolute top-1 right-1 bg-yellow-500/80 rounded text-[8px] text-black px-1 font-bold">
                    hook
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
