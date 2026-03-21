'use client';

/**
 * Detect mouth openness per video frame using MediaPipe Face Mesh.
 * Returns a value 0–1 per frame where 1 = fully open, 0 = closed.
 *
 * Mouth landmarks used (MediaPipe Face Mesh indices):
 *   Upper lip top:  13
 *   Lower lip bot:  14
 *   Left corner:    78
 *   Right corner:   308
 */

export interface MouthSample {
  timeSec: number;
  openness: number; // 0 (closed) → 1 (fully open)
}

function landmarkDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function computeOpenness(landmarks: { x: number; y: number }[]): number {
  const upper = landmarks[13];
  const lower = landmarks[14];
  const leftCorner = landmarks[78];
  const rightCorner = landmarks[308];
  if (!upper || !lower || !leftCorner || !rightCorner) return 0;
  const vertical = landmarkDistance(upper, lower);
  const horizontal = landmarkDistance(leftCorner, rightCorner);
  if (horizontal === 0) return 0;
  // Normalise by mouth width — typical open ratio is 0.4–0.8
  return Math.min(1, (vertical / horizontal) * 2.5);
}

export async function detectMouthOpennessInVideo(
  videoUrl: string,
  duration: number,
  sampleRateFps = 10,
  onProgress?: (pct: number) => void,
): Promise<MouthSample[]> {
  // Dynamically import MediaPipe to avoid SSR issues
  const { FaceMesh } = await import('@mediapipe/face_mesh');

  return new Promise((resolve, reject) => {
    const results: MouthSample[] = [];
    const sampleInterval = 1 / sampleRateFps;
    const totalSamples = Math.floor(duration * sampleRateFps);
    let sampleIdx = 0;

    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.crossOrigin = 'anonymous';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const faceMesh = new FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((faceMeshResults: any) => {
      const timeSec = sampleIdx * sampleInterval;
      let openness = 0;
      if (faceMeshResults.multiFaceLandmarks?.[0]) {
        openness = computeOpenness(faceMeshResults.multiFaceLandmarks[0]);
      }
      results.push({ timeSec, openness });
      sampleIdx++;
      onProgress?.(sampleIdx / totalSamples);

      if (sampleIdx < totalSamples) {
        video.currentTime = sampleIdx * sampleInterval;
      } else {
        faceMesh.close();
        resolve(results);
      }
    });

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = 0;
    });

    video.addEventListener('seeked', async () => {
      ctx.drawImage(video, 0, 0);
      await faceMesh.send({ image: canvas });
    });

    video.addEventListener('error', () => reject(new Error('Video load failed')));

    // Timeout safety
    setTimeout(() => resolve(results), 120_000);
  });
}

/**
 * Given mouth openness samples and an audio soundbyte (startSec, endSec),
 * find the best alignment offset (in seconds) by correlating lip movement
 * to expected vocal activity in the soundbyte window.
 * Returns the suggested videoStartSec to use when trimming the clip.
 */
export function findLipSyncOffset(
  samples: MouthSample[],
  soundbyteStartSec: number,
  soundbyteDurationSec: number,
): { videoStartSec: number; confidence: number } {
  // Find the window in the video where mouth activity matches expected vocal density
  // Vocal segments = samples where openness > 0.25
  const windowSize = soundbyteDurationSec;
  let bestOffset = 0;
  let bestScore = -Infinity;

  const step = 0.1;
  const videoEnd = samples[samples.length - 1]?.timeSec ?? 0;

  for (let t = 0; t <= videoEnd - windowSize; t += step) {
    const windowSamples = samples.filter(
      s => s.timeSec >= t && s.timeSec < t + windowSize,
    );
    if (windowSamples.length < 3) continue;
    // Score = density of open-mouth frames (singer is likely singing here)
    const score =
      windowSamples.filter(s => s.openness > 0.25).length / windowSamples.length;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = t;
    }
  }

  return { videoStartSec: bestOffset, confidence: bestScore };
}
