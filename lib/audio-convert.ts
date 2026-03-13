/**
 * Client-side audio → MP3 converter.
 *
 * Uses the browser's Web Audio API to decode any supported audio format
 * (WAV, M4A, AAC, OGG, FLAC, MP3) into raw PCM, then re-encodes as MP3
 * at 128 kbps using lamejs. Runs entirely in the browser — no server needed.
 *
 * Typical results:
 *   4-min WAV  (200 MB) → ~3.8 MB MP3
 *   4-min M4A  ( 20 MB) → ~3.8 MB MP3
 *   4-min FLAC ( 50 MB) → ~3.8 MB MP3
 */

export type ConvertProgress = (phase: 'decoding' | 'encoding', pct: number) => void;

export async function convertToMp3(
  file: File,
  onProgress?: ConvertProgress,
): Promise<File> {
  // If it's already an MP3, return as-is (no re-encoding needed)
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'mp3') return file;

  onProgress?.('decoding', 0);

  // ── 1. Decode to PCM via Web Audio API ────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close();
  }

  onProgress?.('decoding', 100);
  onProgress?.('encoding', 0);

  // ── 2. Down-mix to mono if necessary (lamejs handles stereo too) ──────────
  const numChannels = Math.min(decoded.numberOfChannels, 2); // max stereo
  const sampleRate  = decoded.sampleRate;                    // e.g. 44100
  const bitRate     = 128;                                   // kbps

  const leftPCM  = decoded.getChannelData(0);
  const rightPCM = numChannels > 1 ? decoded.getChannelData(1) : leftPCM;

  // ── 3. Encode with lamejs ──────────────────────────────────────────────────
  // Dynamic import keeps lamejs out of the SSR bundle
  const lamejs = (await import('@breezystack/lamejs')).default;
  const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitRate);

  const CHUNK = 1152; // lamejs requires multiples of 1152 samples
  const mp3Chunks: Uint8Array[] = [];
  const totalSamples = leftPCM.length;

  const toInt16 = (f32: Float32Array, start: number, end: number): Int16Array => {
    const buf = new Int16Array(end - start);
    for (let i = start; i < end; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      buf[i - start] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return buf;
  };

  for (let i = 0; i < totalSamples; i += CHUNK) {
    const end = Math.min(i + CHUNK, totalSamples);
    const left  = toInt16(leftPCM,  i, end);
    const right = numChannels > 1 ? toInt16(rightPCM, i, end) : left;
    // lamejs returns Int8Array but runtime value is Uint8Array — cast to Uint8Array
    const chunk = numChannels > 1
      ? new Uint8Array((encoder.encodeBuffer(left, right) as unknown as Uint8Array).buffer)
      : new Uint8Array((encoder.encodeBuffer(left) as unknown as Uint8Array).buffer);
    if (chunk.length > 0) mp3Chunks.push(chunk);

    // Report progress every ~5%
    if (i % (Math.floor(totalSamples / 20) * CHUNK) < CHUNK) {
      onProgress?.('encoding', Math.round((i / totalSamples) * 100));
    }
  }

  const finalChunk = new Uint8Array((encoder.flush() as unknown as Uint8Array).buffer);
  if (finalChunk.length > 0) mp3Chunks.push(finalChunk);

  onProgress?.('encoding', 100);

  // ── 4. Assemble Blob → File ────────────────────────────────────────────────
  const blob = new Blob(mp3Chunks as unknown as BlobPart[], { type: 'audio/mpeg' });
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.mp3`, { type: 'audio/mpeg' });
}
