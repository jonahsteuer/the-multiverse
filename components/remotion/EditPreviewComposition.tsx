'use client';

import { AbsoluteFill, OffthreadVideo, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export interface EditClip {
  id: string;
  url: string;         // object URL or remote URL
  startFrom: number;   // seconds into the source clip to start
  duration: number;    // seconds to include
  label?: string;
}

export interface EditPreviewProps {
  clips: EditClip[];
  titleText?: string;
  showTitle?: boolean;
}

// Calculate frame offset for each clip in the timeline
function getClipFrameOffsets(clips: EditClip[], fps: number): number[] {
  const offsets: number[] = [];
  let accumulated = 0;
  for (const clip of clips) {
    offsets.push(accumulated);
    accumulated += Math.round(clip.duration * fps);
  }
  return offsets;
}

function getTotalFrames(clips: EditClip[], fps: number): number {
  return clips.reduce((sum, c) => sum + Math.round(c.duration * fps), 0) || 1;
}

export const EditPreviewComposition: React.FC<EditPreviewProps> = ({
  clips,
  titleText,
  showTitle = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const offsets = getClipFrameOffsets(clips, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {clips.map((clip, i) => {
        const startFrame = offsets[i];
        const durationFrames = Math.round(clip.duration * fps);

        return (
          <Sequence key={clip.id} from={startFrame} durationInFrames={durationFrames}>
            <AbsoluteFill>
              <OffthreadVideo
                src={clip.url}
                startFrom={Math.round(clip.startFrom * fps)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Fade in at start of each clip */}
              <AbsoluteFill
                style={{
                  backgroundColor: '#000',
                  opacity: interpolate(frame - startFrame, [0, 6], [0.8, 0], {
                    extrapolateRight: 'clamp',
                    extrapolateLeft: 'clamp',
                  }),
                  pointerEvents: 'none',
                }}
              />
              {clip.label && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 24,
                    left: 24,
                    color: '#facc15',
                    fontFamily: 'sans-serif',
                    fontSize: 18,
                    fontWeight: 600,
                    opacity: interpolate(frame - startFrame, [0, 15, durationFrames - 15, durationFrames], [0, 1, 1, 0], {
                      extrapolateRight: 'clamp',
                      extrapolateLeft: 'clamp',
                    }),
                  }}
                >
                  {clip.label}
                </div>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {showTitle && titleText && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              color: '#facc15',
              fontSize: 48,
              fontWeight: 700,
              fontFamily: 'sans-serif',
              opacity: interpolate(frame, [0, 20, 60, 80], [0, 1, 1, 0], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              }),
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
            }}
          >
            {titleText}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export { getTotalFrames, getClipFrameOffsets };
