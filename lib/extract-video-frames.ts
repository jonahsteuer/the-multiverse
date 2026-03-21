/**
 * Extract evenly-spaced keyframes from a local video (object URL) using the Canvas API.
 * Returns objects with base64 JPEG + timestamp label, suitable for Claude vision.
 *
 * Frame count scales with duration: ~1 frame per 1.5 seconds, min 6, max 15.
 * Always includes first and last frame for full context.
 */

export interface VideoFrame {
  dataUri: string;   // base64 JPEG data URI
  timeSec: number;   // seconds into video
  label: string;     // formatted "0:03"
}

function formatTimeSec(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function extractFrames(
  videoUrl: string,
  duration: number,
  quality = 0.75,
  maxWidthPx = 720,
): Promise<VideoFrame[]> {
  const count = Math.min(15, Math.max(6, Math.ceil(duration / 1.5)));

  return new Promise(resolve => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve([]); return; }

    const frames: VideoFrame[] = [];

    // Sample positions: always include 0s and (duration-0.5)s, evenly distributed between
    const positions: number[] = [0.1];
    for (let i = 1; i < count - 1; i++) {
      positions.push((i / (count - 1)) * (duration * 0.95));
    }
    positions.push(Math.max(0, duration - 0.5));
    // Deduplicate and sort
    const unique = [...new Set(positions.map(p => Math.round(p * 10) / 10))].sort((a, b) => a - b);

    let idx = 0;

    const captureNext = () => {
      if (idx >= unique.length) { resolve(frames); return; }
      video.currentTime = unique[idx];
    };

    video.addEventListener('loadedmetadata', () => {
      const scale = Math.min(1, maxWidthPx / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      captureNext();
    });

    video.addEventListener('seeked', () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/jpeg', quality);
      const timeSec = unique[idx];
      frames.push({ dataUri, timeSec, label: formatTimeSec(timeSec) });
      idx++;
      captureNext();
    });

    video.addEventListener('error', () => resolve(frames));
    setTimeout(() => resolve(frames), 20_000);
  });
}
