import { useState, useRef, useEffect } from 'react';
import { MarkContext } from '@/lib/mark-knowledge';
import { VoiceInput } from './VoiceInput';
import { saveMarkConversation } from '@/lib/team';
import { speakWithElevenLabs, speakWithBrowser, stopMarkSpeech, resetMaleVoiceCache } from '@/lib/mark-tts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface BrainstormIntakeData {
  songStory: string;
  artistVibe: string;
  comfortLevel: string;
}

interface MarkChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: MarkContext;
  initialMessage?: string; // context-aware greeting spoken when panel opens
  onOpenBrainstorm?: (data?: BrainstormIntakeData) => void; // called when Mark emits [OPEN_BRAINSTORM]
}

// (TTS functions moved to lib/mark-tts.ts)

export function MarkChatPanel({ isOpen, onClose, context, initialMessage, onOpenBrainstorm }: MarkChatPanelProps) {
  // Refresh voice cache when browser voice list loads
  useEffect(() => {
    const refresh = () => { resetMaleVoiceCache(); };
    window.speechSynthesis?.addEventListener('voiceschanged', refresh);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', refresh);
  }, []);
  const DEFAULT_GREETING = "Hey, it's Mark. What do you need help with?";
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: initialMessage || DEFAULT_GREETING,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);
  // Conversation persistence
  const sessionIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBrainstormSessionRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Debounced conversation save via useEffect — React-safe, fires after render
  useEffect(() => {
    if (messages.length < 2) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const serialized = messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));
      const galaxyId = (context as any)?.galaxyId || null;
      const sessionType = isBrainstormSessionRef.current ? 'brainstorm' : 'general';
      const id = await saveMarkConversation(
        context.userId,
        galaxyId,
        sessionType,
        serialized,
        { userName: context.userName, currentRelease: context.currentRelease },
        sessionIdRef.current ?? undefined,
      );
      if (id && !sessionIdRef.current) sessionIdRef.current = id;
    }, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);


  // Reset conversation and speak contextual greeting whenever panel opens
  useEffect(() => {
    if (isOpen && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      const greeting = initialMessage || DEFAULT_GREETING;
      const firstMessage = { role: 'assistant' as const, content: greeting, timestamp: new Date() };
      setMessages([firstMessage]);
      if (voiceEnabled) {
        setTimeout(() => {
          if (process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
            speakWithElevenLabs(greeting, () => setIsSpeaking(true), () => setIsSpeaking(false));
          } else {
            speakWithBrowser(greeting, () => setIsSpeaking(false));
          }
        }, 300);
      }
    } else if (!isOpen) {
      hasOpenedRef.current = false;
      // Reset session so next open gets a fresh conversation ID
      sessionIdRef.current = null;
      isBrainstormSessionRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => { stopMarkSpeech(); };
  }, []);

  const speak = (text: string) => {
    if (!voiceEnabled) return;
    
    if (process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
      speakWithElevenLabs(
        text,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );
    } else {
      speakWithBrowser(text, () => setIsSpeaking(false));
    }
  };

  const handleUserMessage = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: userText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          context,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Mark');
      }

      const data = await response.json();

      // Parse [OPEN_BRAINSTORM]{...} tag — strip it before displaying, extract JSON data
      const rawMessage: string = data.message || '';
      const brainstormMatch = rawMessage.match(/\[OPEN_BRAINSTORM\](\{[\s\S]*?\})?/);
      const hasBrainstormSignal = !!brainstormMatch;
      const cleanMessage = rawMessage.replace(/\[OPEN_BRAINSTORM\](\{[\s\S]*?\})?/g, '').trim();

      let brainstormData: BrainstormIntakeData | undefined;
      if (brainstormMatch?.[1]) {
        try {
          brainstormData = JSON.parse(brainstormMatch[1]);
        } catch {
          // Malformed JSON — still open brainstorm without pre-filled data
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: cleanMessage,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      if (hasBrainstormSignal) isBrainstormSessionRef.current = true;
      speak(cleanMessage);

      if (hasBrainstormSignal && onOpenBrainstorm) {
        setTimeout(() => {
          onClose();
          onOpenBrainstorm(brainstormData);
        }, 1_200);
      }
    } catch (error) {
      console.error('[Mark Chat] Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Try again in a sec.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      speak(errorMessage.content);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    
    // Stop any current speech
    if (!newState) {
      stopMarkSpeech();
      setIsSpeaking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />

      {/* Chat Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-gray-900/95 border-l border-purple-500/20 z-[51] shadow-2xl shadow-black/50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-star-wars text-white">Mark</h2>
            <p className="text-xs text-gray-400">Your strategy assistant</p>
          </div>
          
          {/* Voice Toggle */}
          <button
            onClick={toggleVoice}
            className={`mr-3 p-2 rounded-lg transition-colors ${
              voiceEnabled 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 text-gray-400'
            }`}
            title={voiceEnabled ? 'Voice enabled' : 'Voice disabled'}
          >
            {voiceEnabled ? '🔊' : '🔇'}
          </button>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                {message.role === 'assistant' && isSpeaking && index === messages.length - 1 && (
                  <div className="flex items-center gap-2 mb-2 text-yellow-400 text-xs">
                    <span className="animate-pulse">🎤</span>
                    <span>Speaking...</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-[10px] mt-1 opacity-50">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 text-gray-100 rounded-lg p-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-700/50">
          <VoiceInput
            onTranscript={handleUserMessage}
            disabled={isLoading || isSpeaking}
            autoSubmit={true}
            autoStartAfterDisabled={false}
            placeholder={isSpeaking ? "Listening to Mark..." : "Tap the mic to speak with Mark..."}
          />
        </div>
      </div>
    </>
  );
}

