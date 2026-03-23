/**
 * Extract 3 keyframes from a local video (object URL) using the Canvas API.
 * Returns first, middle, and last frames — enough for Mark to understand each clip
 * while staying within the Anthropic API 100-image limit for large clip sets.
 * Max width: 800px (API recommends ≤1.15MP to avoid server-side resize latency).
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
  quality = 0.5,
  maxWidthPx = 400,
): Promise<VideoFrame[]> {
  // Always 3 frames: first (0.1s), middle, last — keeps 29-clip sets within API limits
  // 400px max / 50% quality ≈ 20-40KB/frame → 87 frames for 29 clips ≈ 3MB (under Vercel 4.5MB limit)
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

    const unique = [
      0.1,
      Math.max(0.1, duration / 2),
      Math.max(0.1, duration - 0.5),
    ].map(p => Math.round(p * 10) / 10);

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
