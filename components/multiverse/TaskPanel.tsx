'use client';

import { useState, useRef, useEffect } from 'react';
import type { TeamTask, TeamMemberRecord } from '@/types';
import { MarkContext } from '@/lib/mark-knowledge';
import { updateTask } from '@/lib/team';

// ── helpers ──────────────────────────────────────────────────────────────────

function getTaskTypeLabel(type: string): string {
  switch (type) {
    case 'invite_team':  return 'Team Setup';
    case 'brainstorm':   return 'Brainstorm';
    case 'prep':         return 'Prep';
    case 'film':         return 'Film';
    case 'edit':         return 'Edit';
    case 'review':       return 'Review';
    case 'post':         return 'Post';
    case 'release':      return 'Release';
    case 'shoot':        return 'Shoot';
    default:             return 'Task';
  }
}

function getTaskTypeColor(type: string): string {
  switch (type) {
    case 'invite_team':  return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'brainstorm':   return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'film':
    case 'shoot':        return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'edit':         return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'review':       return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    case 'post':         return 'bg-green-500/20 text-green-300 border-green-500/40';
    default:             return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function formatTaskDate(dateStr: string, startTime: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const [h, m] = startTime.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ── Mark mini-chat ────────────────────────────────────────────────────────────

interface MarkMessage {
  role: 'user' | 'assistant';
  content: string;
}

function MarkMiniChat({
  context,
  initialPrompt,
}: {
  context: MarkContext;
  initialPrompt?: string;
}) {
  const [messages, setMessages] = useState<MarkMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send initial prompt when provided
  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      sendMessage(initialPrompt, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const sendMessage = async (text: string, isAuto = false) => {
    const userMsg: MarkMessage = { role: 'user', content: text };
    const updatedMessages = isAuto ? [userMsg] : [...messages, userMsg];
    if (!isAuto) setMessages(prev => [...prev, userMsg]);
    else setMessages([userMsg]);
    setIsLoading(true);
    setInput('');

    try {
      const res = await fetch('/api/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, context }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || data.reply || "I'm here — what do you need?";
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Having trouble connecting right now. Try again in a sec." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 py-2 min-h-0">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 text-sm py-4">
            Ask Mark anything about this task
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <span className="text-xs mr-2 mt-1 flex-shrink-0">🎯</span>
            )}
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
              msg.role === 'user'
                ? 'bg-purple-600/40 text-white'
                : 'bg-gray-800 text-gray-100'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <span className="text-xs mr-2 mt-1">🎯</span>
            <div className="bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-400">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 pt-3 mt-2">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask Mark..."
            rows={2}
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-sm transition-colors self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main TaskPanel ────────────────────────────────────────────────────────────

interface TaskPanelProps {
  task: TeamTask;
  teamMembers: TeamMemberRecord[];
  markContext: MarkContext;
  onClose: () => void;
  onTaskUpdated?: (updated: TeamTask) => void;
}

export function TaskPanel({ task: initialTask, teamMembers, markContext, onClose, onTaskUpdated }: TaskPanelProps) {
  const [task, setTask] = useState(initialTask);
  const [showMark, setShowMark] = useState(false);
  const [markPrompt, setMarkPrompt] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState(task.description || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const isBrainstorm = task.type === 'brainstorm';

  // For brainstorm tasks: auto-open Mark in brainstorm mode
  useEffect(() => {
    if (isBrainstorm) {
      const releaseName = (markContext.currentRelease?.name) || 'your upcoming release';
      const genreRaw = markContext.artistProfile?.genre;
      const artistGenre = Array.isArray(genreRaw)
        ? genreRaw.join(', ')
        : (typeof genreRaw === 'string' ? genreRaw : '');
      const prompt = `Let's brainstorm content ideas for ${releaseName}${artistGenre ? ` (${artistGenre})` : ''}. I need TikTok/Instagram Reel ideas that stop the scroll. Give me 5 specific concepts with a first-frame visual description and why it works for my sound.`;
      setMarkPrompt(prompt);
      setShowMark(true);
    }
  }, [isBrainstorm, markContext]);

  const handleSaveNotes = async () => {
    if (!task.id || task.id.startsWith('default-')) return;
    setSavingNotes(true);
    try {
      await updateTask(task.id, { description: notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (e) {
      console.error('[TaskPanel] Failed to save notes:', e);
    } finally {
      setSavingNotes(false);
    }
  };

  const assignee = task.assignedTo ? teamMembers.find(m => m.userId === task.assignedTo) : null;

  return (
    <div className="fixed inset-0 z-[200] flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-gray-950 border-l border-gray-800 flex flex-col h-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getTaskTypeColor(task.type)}`}>
                {getTaskTypeLabel(task.type)}
              </span>
              {assignee && (
                <span className="text-[11px] text-gray-500">
                  → {assignee.displayName}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-white leading-snug">{task.title}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {formatTaskDate(task.date, task.startTime)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-500 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!showMark ? (
            <div className="p-5 space-y-5">
              {/* Task description */}
              {task.description && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What to do</h3>
                  <p className="text-sm text-gray-200 leading-relaxed">{task.description}</p>
                </div>
              )}

              {/* Notes area */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes / Links</h3>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes, Drive links, or context..."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="mt-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {savingNotes ? 'Saving...' : notesSaved ? '✓ Saved' : 'Save notes'}
                </button>
              </div>

              {/* Ask Mark button */}
              <button
                onClick={() => setShowMark(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all"
              >
                <span>🎯</span>
                <span>Ask Mark for help</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full p-4" style={{ minHeight: 0 }}>
              {/* Back button */}
              {!isBrainstorm && (
                <button
                  onClick={() => { setShowMark(false); setMarkPrompt(undefined); }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white mb-3 transition-colors"
                >
                  ← Back to task
                </button>
              )}

              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🎯</span>
                <span className="text-sm font-semibold text-white">Mark</span>
                {isBrainstorm && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded-full">
                    Brainstorm mode
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0">
                <MarkMiniChat
                  context={markContext}
                  initialPrompt={markPrompt}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
