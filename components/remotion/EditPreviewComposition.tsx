'use client';

import { AbsoluteFill, OffthreadVideo, Audio, Sequence, interpolate, useCurrentFrame, staticFile } from 'remotion';

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export interface EditClip {
  id: string;
  url: string;
  startFrom: number;   // seconds into source
  duration: number;    // seconds to include
  label?: string;
}

export interface EditPreviewProps {
  clips: EditClip[];
  audioUrl?: string;        // object URL or remote URL for the song/soundbyte
  audioStartSec?: number;   // where in the audio to start (default 0)
  audioDurationSec?: number; // how much audio to use (default: full edit length)
  titleText?: string;
  showTitle?: boolean;
  aspectRatio?: AspectRatio;
}

export function getCompositionSize(ar: AspectRatio = '9:16'): { width: number; height: number } {
  switch (ar) {
    case '16:9': return { width: 1920, height: 1080 };
    case '1:1':  return { width: 1080, height: 1080 };
    case '4:5':  return { width: 1080, height: 1350 };
    default:     return { width: 1080, height: 1920 }; // 9:16
  }
}

export function getTotalFrames(clips: EditClip[], fps: number): number {
  return clips.reduce((sum, c) => sum + Math.round(c.duration * fps), 0) || 1;
}

function getClipFrameOffsets(clips: EditClip[], fps: number): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (const clip of clips) {
    offsets.push(acc);
    acc += Math.round(clip.duration * fps);
  }
  return offsets;
}

export const EditPreviewComposition: React.FC<EditPreviewProps> = ({
  clips,
  audioUrl,
  audioStartSec = 0,
  audioDurationSec,
  titleText,
  showTitle = false,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const offsets = getClipFrameOffsets(clips, fps);
  const totalFrames = getTotalFrames(clips, fps);
  const totalSecs = totalFrames / fps;
  const audioFrames = Math.round((audioDurationSec ?? totalSecs) * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Video clips */}
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
              {/* Fade in */}
              <AbsoluteFill
                style={{
                  backgroundColor: '#000',
                  opacity: interpolate(frame - startFrame, [0, 6], [0.7, 0], {
                    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
                  }),
                  pointerEvents: 'none',
                }}
              />
              {/* Clip label */}
              {clip.label && (
                <div style={{
                  position: 'absolute', bottom: 28, left: 24,
                  color: '#facc15', fontFamily: 'sans-serif', fontSize: 20, fontWeight: 700,
                  opacity: interpolate(
                    frame - startFrame,
                    [0, 12, durationFrames - 12, durationFrames],
                    [0, 1, 1, 0],
                    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
                  ),
                  textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                }}>
                  {clip.label}
                </div>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Audio track */}
      {audioUrl && (
        <Sequence from={0} durationInFrames={audioFrames}>
          <Audio
            src={audioUrl}
            startFrom={Math.round(audioStartSec * fps)}
            volume={1}
          />
        </Sequence>
      )}

      {/* Title card */}
      {showTitle && titleText && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
          <div style={{
            color: '#facc15', fontSize: 52, fontWeight: 800, fontFamily: 'sans-serif',
            textAlign: 'center', padding: '0 40px',
            opacity: interpolate(frame, [0, 20, 60, 80], [0, 1, 1, 0], {
              extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
            }),
            textShadow: '0 2px 16px rgba(0,0,0,0.9)',
          }}>
            {titleText}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
