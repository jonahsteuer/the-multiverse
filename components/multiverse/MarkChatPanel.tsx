import { useState, useRef, useEffect } from 'react';
import { MarkContext } from '@/lib/mark-knowledge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MarkChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: MarkContext;
}

// Global audio instance for TTS
let currentAudio: HTMLAudioElement | null = null;

// ElevenLabs TTS with Mark's voice
const speakWithElevenLabs = async (
  text: string,
  onStart?: () => void,
  onEnd?: () => void
) => {
  try {
    // Stop any current audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    onStart?.();

    // Use a different voice for Mark (more mature, experienced)
    const markVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam - deep, experienced voice

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
    
    // Create and play audio
    const audioBlob = new Blob(
      [Uint8Array.from(atob(audio), c => c.charCodeAt(0))],
      { type: 'audio/mpeg' }
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

// Browser Web Speech API TTS fallback
const speakWithBrowser = (text: string, onEnd?: () => void) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  
  window.speechSynthesis.cancel();
  
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Remove emojis
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '') // Remove markdown
    .replace(/\*/g, '')
    .trim();
  
  if (!cleanText) {
    onEnd?.();
    return;
  }
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  
  // Try to find a deeper male voice for Mark
  const voices = window.speechSynthesis.getVoices();
  const markVoice = voices.find(v => 
    v.name.includes('Male') || 
    v.name.includes('Daniel') || 
    v.name.includes('David')
  );
  
  if (markVoice) {
    utterance.voice = markVoice;
  }
  
  utterance.rate = 1.0;
  utterance.pitch = 0.8; // Lower pitch for experienced vet vibe
  utterance.volume = 1.0;
  
  utterance.onend = () => {
    onEnd?.();
  };
  
  utterance.onerror = () => {
    console.error('[Mark TTS] Browser speech error');
    onEnd?.();
  };
  
  window.speechSynthesis.speak(utterance);
};

export function MarkChatPanel({ isOpen, onClose, context }: MarkChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey, it's Mark. What do you need help with?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Speak initial greeting when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 1 && voiceEnabled) {
      const speak = () => {
        if (process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
          speakWithElevenLabs(
            messages[0].content,
            () => setIsSpeaking(true),
            () => setIsSpeaking(false)
          );
        } else {
          speakWithBrowser(messages[0].content, () => setIsSpeaking(false));
        }
      };
      // Small delay to ensure panel is visible
      setTimeout(speak, 300);
    }
  }, [isOpen]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
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

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak Mark's response
      speak(data.message);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    
    // Stop any current speech
    if (!newState) {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
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
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isSpeaking ? "Listening to Mark..." : "Ask Mark anything..."}
              disabled={isLoading || isSpeaking}
              rows={2}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isSpeaking}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              Send
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}

