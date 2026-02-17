'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoSubmit?: boolean; // Auto-submit when speech ends
  autoStartAfterDisabled?: boolean; // Auto-start mic when disabled becomes false (bot stops speaking)
}

// Trigger phrases that auto-send the message (longer phrases first for priority)
const SEND_TRIGGER_PHRASES = [
  'send it now',
  'send that now',
  'next question',
  "that's it send",
  'okay send',
  'ok send',
  'send it',
  'send that',
  "that's it",
  'thats it',
  "that's all",
  'thats all',
  "i'm done",
  'im done',
  'go ahead',
  'submit',
  'done',
  'send',
  'next',
];

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function VoiceInput({ 
  onTranscript, 
  placeholder = "Click the mic or type your response...",
  disabled = false,
  autoSubmit = true,
  autoStartAfterDisabled = false
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasDisabledRef = useRef(disabled);
  const pendingSubmitRef = useRef<string | null>(null);
  const transcriptRef = useRef<string>(''); // Keep ref in sync with state for callbacks
  const onTranscriptRef = useRef(onTranscript); // Ref to avoid stale closure
  
  // Keep refs in sync
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);
  
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Track previous disabled state for auto-start feature
  const prevDisabledRef = useRef(disabled);

  // Check for browser support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsSupported(false);
        setInputMode('text');
      }
    }
  }, []);

  // Initialize speech recognition
  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => {
          const newTranscript = prev + finalTranscript;
          
          // Update ref immediately so onend has access to current value
          transcriptRef.current = newTranscript;
          
          // Check for trigger phrases at the end of the transcript
          const lowerTranscript = newTranscript.toLowerCase().trim();
          
          // Remove common punctuation that might appear after words
          const cleanLower = lowerTranscript.replace(/[.,!?]+$/, '').trim();
          
          for (const trigger of SEND_TRIGGER_PHRASES) {
            // Check if transcript ends with the trigger phrase
            // Also check with the trigger being a separate word (space before it)
            const endsWithTrigger = cleanLower.endsWith(trigger) || cleanLower.endsWith(' ' + trigger);
            
            if (endsWithTrigger) {
              // Find where to cut - account for the trigger phrase
              let cutIndex = newTranscript.length;
              const lowerNew = newTranscript.toLowerCase();
              
              // Find the last occurrence of the trigger
              const triggerIndex = lowerNew.lastIndexOf(trigger);
              if (triggerIndex > 0) {
                cutIndex = triggerIndex;
              }
              
              // Remove the trigger phrase and clean up
              const cleanedTranscript = newTranscript.slice(0, cutIndex).trim();
              
              // Only trigger if we have meaningful content (more than just the trigger)
              if (cleanedTranscript && cleanedTranscript.length >= 3) {
                console.log('[VoiceInput] Trigger phrase detected:', trigger);
                console.log('[VoiceInput] Content to submit:', cleanedTranscript);
                pendingSubmitRef.current = cleanedTranscript;
                transcriptRef.current = cleanedTranscript; // Update ref too
                // Stop recognition and submit
                setTimeout(() => {
                  recognition.stop();
                }, 100);
                return cleanedTranscript;
              }
              
              // If no meaningful content, don't trigger - just remove the trigger word
              // and let them keep talking
              return newTranscript;
            }
          }
          
          return newTranscript;
        });
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access or use text input.');
        setInputMode('text');
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Try again or use text input.');
      } else {
        setError(`Error: ${event.error}. Try again or use text input.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      
      // Use refs to get current values (avoid stale closure)
      const currentTranscript = transcriptRef.current;
      const currentPending = pendingSubmitRef.current;
      
      console.log('[VoiceInput] Recognition ended. Pending:', currentPending, 'Transcript:', currentTranscript);
      
      // Check if we have a pending submit from trigger phrase
      if (currentPending) {
        console.log('[VoiceInput] Submitting via trigger:', currentPending);
        pendingSubmitRef.current = null;
        onTranscriptRef.current(currentPending);
        setTranscript('');
        transcriptRef.current = '';
        setInterimTranscript('');
      }
      // Otherwise, if autoSubmit is on, submit what we have
      else if (autoSubmit && currentTranscript.trim()) {
        console.log('[VoiceInput] Auto-submitting:', currentTranscript.trim());
        onTranscriptRef.current(currentTranscript.trim());
        setTranscript('');
        transcriptRef.current = '';
        setInterimTranscript('');
      } else {
        console.log('[VoiceInput] Recognition ended, no auto-submit.');
      }
    };

    return recognition;
  }, [autoSubmit]); // Removed transcript - using transcriptRef instead

  const startListening = useCallback(() => {
    if (disabled) return;
    
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    
    const recognition = initRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to start recognition:', e);
        setError('Failed to start voice input. Please try again.');
      }
    }
  }, [disabled, initRecognition]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Stop listening when disabled (e.g., when bot is speaking)
  useEffect(() => {
    if (disabled && isListening) {
      stopListening();
    }
  }, [disabled, isListening, stopListening]);
  
  // Auto-start mic when disabled transitions from true to false
  useEffect(() => {
    // Only run when disabled changes
    const wasDisabled = prevDisabledRef.current;
    prevDisabledRef.current = disabled;
    
    // Detect transition: was disabled, now enabled
    if (autoStartAfterDisabled && wasDisabled && !disabled) {
      console.log('[VoiceInput] Bot finished speaking, auto-starting mic...');
      // Longer delay to ensure audio is fully stopped (Mark needs more time)
      const timer = setTimeout(() => {
        if (inputMode === 'voice' && isSupported && !isListening) {
          console.log('[VoiceInput] Starting listening...');
          startListening();
        }
      }, 1000); // Increased from 600ms to 1000ms
      return () => clearTimeout(timer);
    }
  }, [disabled, autoStartAfterDisabled, inputMode, isSupported, isListening, startListening]);

  const handleSubmit = useCallback(() => {
    const finalText = transcript.trim();
    if (finalText) {
      onTranscript(finalText);
      setTranscript('');
      setInterimTranscript('');
    }
  }, [transcript, onTranscript]);

  const handleTextSubmit = useCallback(() => {
    const finalText = transcript.trim();
    if (finalText) {
      onTranscript(finalText);
      setTranscript('');
    }
  }, [transcript, onTranscript]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  }, [handleTextSubmit]);

  // Display text (current transcript + interim)
  const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '');

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setInputMode('voice')}
          disabled={!isSupported}
          className={`text-sm px-3 py-1 rounded-full transition-colors ${
            inputMode === 'voice'
              ? 'bg-yellow-500 text-black font-medium'
              : 'text-gray-400 hover:text-yellow-400'
          } ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          🎤 Voice
        </button>
        <button
          type="button"
          onClick={() => setInputMode('text')}
          className={`text-sm px-3 py-1 rounded-full transition-colors ${
            inputMode === 'text'
              ? 'bg-yellow-500 text-black font-medium'
              : 'text-gray-400 hover:text-yellow-400'
          }`}
        >
          ⌨️ Text
        </button>
        {!isSupported && (
          <span className="text-xs text-gray-500 ml-2">
            (Voice not supported in this browser)
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Voice Mode */}
      {inputMode === 'voice' && (
        <div className="space-y-3">
          {/* Mic Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={disabled}
              className={`relative w-20 h-20 rounded-full transition-all duration-300 ${
                isListening
                  ? 'bg-red-500 shadow-lg shadow-red-500/50 scale-110'
                  : 'bg-yellow-500 hover:bg-yellow-400 hover:scale-105'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Pulse animation when listening */}
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
                  <span className="absolute inset-2 rounded-full bg-red-400 animate-pulse opacity-50" />
                </>
              )}
              <span className="relative text-3xl">
                {isListening ? '🔴' : '🎤'}
              </span>
            </button>
          </div>

          {/* Status Text */}
          <p className="text-center text-sm text-gray-400">
            {isListening ? (
              <span className="text-red-400 font-medium">Listening... say "send it" or "that's it" when done</span>
            ) : (
              'Tap the mic to speak'
            )}
          </p>

          {/* Editable Transcript Display */}
          {(transcript || interimTranscript) && (
            <div className="space-y-2">
              <div className="bg-black/50 border border-yellow-500/30 rounded-lg p-4">
                {isListening ? (
                  // While listening, show non-editable with interim
                  <p className="text-white">
                    {transcript}
                    {interimTranscript && (
                      <span className="text-gray-400 italic"> {interimTranscript}</span>
                    )}
                  </p>
                ) : (
                  // When stopped, show editable textarea
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="w-full bg-transparent text-white resize-none focus:outline-none min-h-[60px]"
                    placeholder="Edit your message..."
                  />
                )}
              </div>
              {!isListening && (
                <p className="text-xs text-gray-500">Edit your message above, then send</p>
              )}
            </div>
          )}

          {/* Manual Submit (if autoSubmit is off or user wants to edit) */}
          {transcript && !autoSubmit && !isListening && (
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSubmit}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
              >
                Send
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setTranscript('');
                  setInterimTranscript('');
                }}
                variant="outline"
                className="border-yellow-500/30 text-yellow-400"
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Text Mode */}
      {inputMode === 'text' && (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className="bg-black/50 border-yellow-500/30 text-white placeholder:text-gray-500 min-h-[100px] resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Press Enter to send, Shift+Enter for new line</span>
            <Button
              type="button"
              onClick={handleTextSubmit}
              disabled={!transcript.trim() || disabled}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

