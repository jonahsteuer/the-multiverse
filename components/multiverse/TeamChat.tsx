'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TeamMemberRecord } from '@/types';
import { VoiceInput } from './VoiceInput';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamChannel {
  id: string;
  team_id: string;
  name: string | null;
  channel_type: 'group' | 'dm';
  member_ids: string[];
  created_at: string;
}

export interface TeamMessage {
  id: string;
  channel_id: string;
  team_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: 'text' | 'footage-share' | 'mark-response' | 'task-card' | 'post-slots-confirm';
  metadata: Record<string, any>;
  created_at: string;
}

interface TeamChatProps {
  teamId: string;
  galaxyId: string;
  galaxyName: string;
  releaseDate?: string;
  currentUserId: string;
  currentUserName: string;
  teamMembers: TeamMemberRecord[];
  isAdmin: boolean;
  // Jump to a specific channel (e.g. from notification)
  initialChannelId?: string;
  onUnreadChange?: (count: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamChat({
  teamId,
  galaxyId,
  galaxyName,
  releaseDate,
  currentUserId,
  currentUserName,
  teamMembers,
  isAdmin,
  initialChannelId,
  onUnreadChange,
}: TeamChatProps) {
  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>(initialChannelId || '');
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showMic, setShowMic] = useState(false);
  const [markThinking, setMarkThinking] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const realtimeRef = useRef<any>(null);

  const activeChannel = channels.find(c => c.id === activeChannelId);

  // ── Load / create channels ───────────────────────────────────────────────

  const ensureGroupChannel = useCallback(async (sb: any): Promise<TeamChannel | null> => {
    const groupChannelId = `channel-${teamId}-group`;

    // First: try to load the channel the current user can see (post-RLS-fix: team members can see group channels)
    const { data: existing } = await sb
      .from('team_channels')
      .select('*')
      .eq('team_id', teamId)
      .eq('channel_type', 'group')
      .single();

    if (existing) {
      // Add self to member_ids if not already present (late-joiner support)
      if (!existing.member_ids.includes(currentUserId)) {
        const newIds = [...existing.member_ids, currentUserId];
        await sb.from('team_channels').update({ member_ids: newIds }).eq('id', existing.id);
        existing.member_ids = newIds;
      }
      return existing as TeamChannel;
    }

    // Fallback: try loading by explicit ID in case RLS filtered the query above
    // (pre-fix scenario: user not yet in member_ids, can't see the channel)
    const { data: byId } = await sb
      .from('team_channels')
      .select('*')
      .eq('id', groupChannelId)
      .single();

    if (byId) {
      // Channel exists — add self to member_ids
      if (!byId.member_ids.includes(currentUserId)) {
        const newIds = [...byId.member_ids, currentUserId];
        await sb.from('team_channels').update({ member_ids: newIds }).eq('id', byId.id);
        byId.member_ids = newIds;
      }
      return byId as TeamChannel;
    }

    // Channel doesn't exist yet — create it with all known team members
    const allIds = [...new Set([...teamMembers.map(m => m.userId), currentUserId])];
    const { data: created, error } = await sb.from('team_channels').insert({
      id: groupChannelId,
      team_id: teamId,
      name: `${galaxyName} Team`,
      channel_type: 'group',
      member_ids: allIds,
    }).select().single();

    if (error) {
      // Duplicate key = channel was just created by another member — fetch it
      if (error.code === '23505') {
        const { data: retry } = await sb.from('team_channels').select('*').eq('id', groupChannelId).single();
        if (retry) {
          if (!retry.member_ids.includes(currentUserId)) {
            const newIds = [...retry.member_ids, currentUserId];
            await sb.from('team_channels').update({ member_ids: newIds }).eq('id', retry.id);
            retry.member_ids = newIds;
          }
          return retry as TeamChannel;
        }
      }
      console.error('[TeamChat] create group channel error:', error);
      return null;
    }
    return created as TeamChannel;
  }, [teamId, currentUserId, teamMembers, galaxyName]);

  useEffect(() => {
    if (!teamId || !currentUserId) return;
    (async () => {
      setLoadingChannels(true);
      try {
        const { supabase } = await import('@/lib/supabase');
        const group = await ensureGroupChannel(supabase);

        // Load all channels the current user belongs to
        const { data: allChannels } = await supabase
          .from('team_channels')
          .select('*')
          .eq('team_id', teamId)
          .contains('member_ids', [currentUserId])
          .order('created_at', { ascending: true });

        const list: TeamChannel[] = allChannels || [];
        setChannels(list);

        // Set active channel
        if (initialChannelId && list.find(c => c.id === initialChannelId)) {
          setActiveChannelId(initialChannelId);
        } else if (group) {
          setActiveChannelId(group.id);
        } else if (list.length > 0) {
          setActiveChannelId(list[0].id);
        }
      } catch (err) {
        console.error('[TeamChat] loadChannels error:', err);
      } finally {
        setLoadingChannels(false);
      }
    })();
  }, [teamId, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load messages for active channel ────────────────────────────────────

  useEffect(() => {
    if (!activeChannelId) return;
    setLoadingMessages(true);
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase
          .from('team_messages')
          .select('*')
          .eq('channel_id', activeChannelId)
          .order('created_at', { ascending: true })
          .limit(100);
        setMessages((data as TeamMessage[]) || []);
      } catch (err) {
        console.error('[TeamChat] loadMessages error:', err);
      } finally {
        setLoadingMessages(false);
      }
    })();
  }, [activeChannelId]);

  // ── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    if (!activeChannelId) return;
    let sub: any;
    (async () => {
      const { supabase } = await import('@/lib/supabase');
      sub = supabase
        .channel(`chat-${activeChannelId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `channel_id=eq.${activeChannelId}`,
        }, (payload: any) => {
          const msg = payload.new as TeamMessage;
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        })
        .subscribe();
      realtimeRef.current = sub;
    })();
    return () => {
      if (realtimeRef.current) {
        import('@/lib/supabase').then(({ supabase }) => supabase.removeChannel(realtimeRef.current));
      }
    };
  }, [activeChannelId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────

  const sendMessage = async (content: string, type: TeamMessage['message_type'] = 'text', metadata: Record<string, any> = {}) => {
    if (!content.trim() || !activeChannelId) return;
    setSending(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const msg: Omit<TeamMessage, 'id'> = {
        channel_id: activeChannelId,
        team_id: teamId,
        sender_id: currentUserId,
        sender_name: currentUserName,
        content: content.trim(),
        message_type: type,
        metadata,
        created_at: new Date().toISOString(),
      };
      await supabase.from('team_messages').insert(msg);
      setInput('');
    } catch (err) {
      console.error('[TeamChat] sendMessage error:', err);
    } finally {
      setSending(false);
    }
  };

  // ── Call Mark ────────────────────────────────────────────────────────────

  const callMark = async () => {
    if (markThinking) return;
    setMarkThinking(true);
    try {
      // Build context from last 10 messages
      const recentMessages = messages.slice(-10);
      const contextText = recentMessages
        .map(m => `${m.sender_name}: ${m.content}`)
        .join('\n');

      const { supabase } = await import('@/lib/supabase');

      // Post a "Mark is thinking" placeholder in chat UI (optimistic)
      const thinkingId = `mark-thinking-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: thinkingId,
        channel_id: activeChannelId,
        team_id: teamId,
        sender_id: 'mark',
        sender_name: 'Mark',
        content: '...',
        message_type: 'mark-response',
        metadata: {},
        created_at: new Date().toISOString(),
      }]);

      const res = await fetch('/api/mark-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Called in team chat — respond to the conversation',
          context: {
            galaxyName,
            releaseDate,
            chatHistory: contextText,
            teamMembers: teamMembers.map(m => ({ name: m.displayName, role: m.role })),
            isTeamChat: true,
          },
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.message || "I'm here — what do you need?";

      // Remove thinking placeholder
      setMessages(prev => prev.filter(m => m.id !== thinkingId));

      // Post Mark's real response
      await supabase.from('team_messages').insert({
        channel_id: activeChannelId,
        team_id: teamId,
        sender_id: 'mark',
        sender_name: 'Mark',
        content: reply,
        message_type: 'mark-response',
        metadata: {},
        created_at: new Date().toISOString(),
      });

      // Check if Mark wants to create post slots
      if (data.action === 'create_post_slots' && data.slots) {
        await supabase.from('team_messages').insert({
          channel_id: activeChannelId,
          team_id: teamId,
          sender_id: 'mark',
          sender_name: 'Mark',
          content: `I'll add ${data.slots.length} post slot${data.slots.length !== 1 ? 's' : ''} to your calendar. Confirm?`,
          message_type: 'post-slots-confirm',
          metadata: { slots: data.slots },
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[TeamChat] callMark error:', err);
      setMessages(prev => prev.filter(m => m.sender_id !== 'mark' || m.content !== '...'));
    } finally {
      setMarkThinking(false);
    }
  };

  // ── Confirm post slots (CAL1) ─────────────────────────────────────────────

  const confirmPostSlots = async (slots: Array<{ date: string; type: string; title?: string }>) => {
    try {
      const res = await fetch('/api/team/add-post-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, galaxyId, slots }),
      });
      const data = await res.json();
      if (data.success) {
        await sendMessage(
          `✅ Added ${slots.length} post slot${slots.length !== 1 ? 's' : ''} to the calendar.`,
          'mark-response'
        );
      } else {
        await sendMessage('Failed to add slots — try again.', 'mark-response');
      }
    } catch (err) {
      console.error('[TeamChat] confirmPostSlots error:', err);
    }
  };

  // ── Start DM ──────────────────────────────────────────────────────────────

  const startDM = async (member: TeamMemberRecord) => {
    const dmId = [currentUserId, member.userId].sort().join('-dm-');
    const existing = channels.find(c => c.id === dmId);
    if (existing) { setActiveChannelId(dmId); return; }
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.from('team_channels').insert({
        id: dmId,
        team_id: teamId,
        name: null,
        channel_type: 'dm',
        member_ids: [currentUserId, member.userId],
      }).select().single();
      if (data) {
        setChannels(prev => [...prev, data as TeamChannel]);
        setActiveChannelId(dmId);
      }
    } catch (err) {
      console.error('[TeamChat] startDM error:', err);
    }
  };

  // ── Channel label ────────────────────────────────────────────────────────

  const channelLabel = (ch: TeamChannel) => {
    if (ch.channel_type === 'group') return ch.name || 'Team Chat';
    const otherId = ch.member_ids.find(id => id !== currentUserId);
    return teamMembers.find(m => m.userId === otherId)?.displayName || 'DM';
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loadingChannels) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  // Group messages by day
  const groupedMessages: { day: string; messages: TeamMessage[] }[] = [];
  for (const msg of messages) {
    const day = formatDay(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.day === day) { last.messages.push(msg); }
    else { groupedMessages.push({ day, messages: [msg] }); }
  }

  const otherMembers = teamMembers.filter(m => m.userId !== currentUserId);

  return (
    <div className="flex flex-col h-full">
      {/* Channel sidebar (only show if >1 channel) */}
      {channels.length > 1 && (
        <div className="flex gap-1 px-1 pb-2 border-b border-gray-700/50 overflow-x-auto">
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannelId(ch.id)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                ch.id === activeChannelId
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {ch.channel_type === 'group' ? '# ' : '@ '}{channelLabel(ch)}
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 min-h-0">
        {loadingMessages ? (
          <div className="flex justify-center py-6">
            <div className="text-xs text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-sm text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-600 mt-1">Send the first message or call Mark for help</p>
          </div>
        ) : (
          groupedMessages.map(({ day, messages: dayMsgs }) => (
            <div key={day}>
              <div className="flex items-center gap-2 px-2 mb-2">
                <div className="flex-1 h-px bg-gray-700/50" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{day}</span>
                <div className="flex-1 h-px bg-gray-700/50" />
              </div>
              <div className="space-y-1">
                {dayMsgs.map((msg, idx) => {
                  const isMark = msg.sender_id === 'mark';
                  const isMe = msg.sender_id === currentUserId;
                  const showSender = idx === 0 || dayMsgs[idx - 1]?.sender_id !== msg.sender_id;

                  // Task card
                  if (msg.message_type === 'task-card' && msg.metadata?.itemName) {
                    return (
                      <div key={msg.id} className="mx-2 rounded-xl border border-blue-500/30 bg-blue-900/20 p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-300">{msg.sender_name}</span>
                          <span className="text-[10px] text-gray-500">shared</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📎</span>
                          <div>
                            <p className="text-sm font-medium text-white">{msg.metadata.itemName}</p>
                            <p className="text-[11px] text-gray-400">{msg.metadata.sourceType}</p>
                          </div>
                        </div>
                        {msg.content && (
                          <p className="text-xs text-gray-300 border-t border-blue-500/20 pt-1.5">{msg.content}</p>
                        )}
                        <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                      </div>
                    );
                  }

                  // Post slots confirmation card
                  if (msg.message_type === 'post-slots-confirm' && msg.metadata?.slots) {
                    return (
                      <div key={msg.id} className="mx-2 rounded-xl border border-purple-500/30 bg-purple-900/20 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white">M</div>
                          <span className="text-xs font-semibold text-purple-300">Mark</span>
                        </div>
                        <p className="text-sm text-white">{msg.content}</p>
                        <div className="space-y-1">
                          {msg.metadata.slots.map((slot: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                              <span className="capitalize">{slot.type}</span>
                              <span className="text-gray-500">·</span>
                              <span>{new Date(slot.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            </div>
                          ))}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => confirmPostSlots(msg.metadata.slots)}
                              className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              ✓ Confirm
                            </button>
                            <button
                              onClick={() => sendMessage('Never mind, skip the slots.', 'text')}
                              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                      </div>
                    );
                  }

                  // Standard message
                  return (
                    <div key={msg.id} className={`flex flex-col px-2 ${isMe ? 'items-end' : 'items-start'}`}>
                      {showSender && !isMe && (
                        <div className="flex items-center gap-1.5 mb-0.5 ml-1">
                          {isMark ? (
                            <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-[8px] font-bold text-white">M</div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[8px] font-bold text-white">
                              {msg.sender_name[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className={`text-[10px] font-semibold ${isMark ? 'text-purple-400' : 'text-gray-400'}`}>
                            {msg.sender_name}
                          </span>
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : isMark
                              ? 'bg-purple-900/60 border border-purple-500/30 text-purple-100 rounded-bl-sm'
                              : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                        }`}
                      >
                        {msg.content === '...' ? (
                          <div className="flex gap-1 py-0.5">
                            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                      <span className="text-[9px] text-gray-600 mt-0.5 mx-1">{formatTime(msg.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Start DM buttons (only show in group chat if multiple members) */}
      {activeChannel?.channel_type === 'group' && otherMembers.length > 0 && channels.length === 1 && (
        <div className="px-2 pb-2 flex gap-1 flex-wrap">
          {otherMembers.map(member => (
            <button
              key={member.id}
              onClick={() => startDM(member)}
              className="text-[10px] px-2 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              DM {member.displayName || member.role} →
            </button>
          ))}
        </div>
      )}

      {/* Call Mark button */}
      <div className="px-2 pb-1.5">
        <button
          onClick={callMark}
          disabled={markThinking}
          className="w-full py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-[8px] font-bold text-white">M</div>
          {markThinking ? 'Mark is thinking...' : 'Call Mark'}
        </button>
      </div>

      {/* Input area */}
      <div className="px-2 pb-2 space-y-1.5">
        {showMic && (
          <div className="rounded-xl overflow-hidden border border-gray-700">
            <VoiceInput
              onTranscript={(text) => {
                setInput(prev => prev + (prev ? ' ' : '') + text);
                setShowMic(false);
              }}
              autoStartAfterDisabled={false}
              placeholder="Speak your message..."
            />
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            onClick={() => setShowMic(v => !v)}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              showMic ? 'bg-red-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
            }`}
            title="Voice input"
          >
            🎤
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) sendMessage(input);
              }
            }}
            placeholder="Message..."
            rows={1}
            className="flex-1 bg-gray-800/80 border border-gray-600/50 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
            style={{ minHeight: '36px', maxHeight: '80px' }}
          />
          <button
            onClick={() => { if (input.trim()) sendMessage(input); }}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white flex items-center justify-center transition-colors text-sm"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
