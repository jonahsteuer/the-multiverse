/**
 * Shared TTS utilities for Mark's voice.
 * Used by both MarkChatPanel and BrainstormContent.
 */

// Global audio instance — only one Mark voice plays at a time
let currentAudio: HTMLAudioElement | null = null;

// ElevenLabs TTS with Mark's voice (Adam — deep, experienced)
export const speakWithElevenLabs = async (
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
) => {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    onStart?.();

    const markVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId: markVoiceId }),
    });

    if (!response.ok) {
      console.error('[Mark TTS] API error:', response.status);
      onEnd?.();
      return;
    }

    const { audio } = await response.json();

    const audioBlob = new Blob(
      [Uint8Array.from(atob(audio), c => c.charCodeAt(0))],
      { type: 'audio/mpeg' },
    );
    const audioUrl = URL.createObjectURL(audioBlob);

    currentAudio = new Audio(audioUrl);
    currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      onEnd?.();
    };
    currentAudio.onerror = () => {
      console.error('[Mark TTS] Audio playback error');
      onEnd?.();
    };

    await currentAudio.play();
  } catch (error) {
    console.error('[Mark TTS] Error:', error);
    onEnd?.();
  }
};

const MALE_VOICE_NAMES = [
  'Alex', 'Daniel', 'Fred', 'Oliver', 'Tom', 'Aaron', 'Arthur',
  'David', 'Mark', 'Richard',
  'Google UK English Male', 'Google US English Male',
];

let cachedMaleVoice: SpeechSynthesisVoice | null | undefined = undefined;

export function resetMaleVoiceCache() { cachedMaleVoice = undefined; }

export function getMaleVoice(): SpeechSynthesisVoice | null {
  if (cachedMaleVoice !== undefined) return cachedMaleVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  for (const name of MALE_VOICE_NAMES) {
    const v = voices.find(v => v.name === name || v.name.startsWith(name));
    if (v) { cachedMaleVoice = v; return v; }
  }
  const maleFallback = voices.find(v => v.name.toLowerCase().includes('male'));
  cachedMaleVoice = maleFallback || null;
  return cachedMaleVoice;
}

export const speakWithBrowser = (text: string, onEnd?: () => void) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim();

  if (!cleanText) { onEnd?.(); return; }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const maleVoice = getMaleVoice();
  if (maleVoice) utterance.voice = maleVoice;
  utterance.rate = 1.0;
  utterance.pitch = 0.7;
  utterance.volume = 1.0;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => { console.error('[Mark TTS] Browser speech error'); onEnd?.(); };

  window.speechSynthesis.speak(utterance);
};

/** Stop any currently playing Mark audio */
export const stopMarkSpeech = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

/** Speak text using ElevenLabs if key available, otherwise browser fallback */
export const speakAsMarkVoice = (
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
) => {
  if (process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
    speakWithElevenLabs(text, onStart, onEnd);
  } else {
    onStart?.();
    speakWithBrowser(text, onEnd);
  }
};
