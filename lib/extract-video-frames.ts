/**
 * Extract evenly-spaced keyframes from a local video (object URL) using the Canvas API.
 * Returns base64 JPEG data URIs suitable for Claude vision.
 */
export async function extractFrames(
  videoUrl: string,
  duration: number,
  count = 4,
  quality = 0.7,
  maxWidthPx = 640,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve([]); return; }

    const frames: string[] = [];
    // Sample at 10%, 30%, 50%, 70%, 90% of duration
    const positions = Array.from({ length: count }, (_, i) =>
      ((i + 1) / (count + 1)) * duration,
    );
    let idx = 0;

    const captureNext = () => {
      if (idx >= positions.length) { resolve(frames); return; }
      video.currentTime = positions[idx];
    };

    video.addEventListener('loadedmetadata', () => {
      // Scale canvas to fit within maxWidthPx
      const scale = Math.min(1, maxWidthPx / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      captureNext();
    });

    video.addEventListener('seeked', () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', quality));
      idx++;
      captureNext();
    });

    video.addEventListener('error', () => {
      // Don't fail — just return whatever we captured
      resolve(frames);
    });

    // Timeout safety — 15 seconds max
    const timeout = setTimeout(() => resolve(frames), 15_000);
    video.addEventListener('loadeddata', () => clearTimeout(timeout));
  });
}
