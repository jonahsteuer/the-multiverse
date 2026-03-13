'use client';

import { useState } from 'react';
import type { TeamMemberRecord } from '@/types';
import { sendItemWithNotes } from '@/lib/team';

interface SendWithNotesModalProps {
  teamId: string;
  galaxyId: string;
  itemName: string;
  sourceType: 'post_edit' | 'footage';
  sourceId: string;
  senderName: string;
  senderUserId?: string;
  teamMembers: TeamMemberRecord[];
  onClose: () => void;
  onSent: () => void;
  zIndexClass?: string;
}

export function SendWithNotesModal({
  teamId,
  galaxyId,
  itemName,
  sourceType,
  sourceId,
  senderName,
  senderUserId,
  teamMembers,
  onClose,
  onSent,
  zIndexClass = 'z-[70]',
}: SendWithNotesModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState(teamMembers[0]?.userId || '');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function postToGroupChat(noteText: string) {
    try {
      const { supabase } = await import('@/lib/supabase');
      const channelId = `channel-${teamId}-group`;
      const userId = senderUserId || 'unknown';
      await supabase.from('team_messages').insert({
        channel_id: channelId,
        team_id: teamId,
        sender_id: userId,
        sender_name: senderName,
        content: noteText,
        message_type: 'task-card',
        metadata: { itemName, sourceType, sourceId },
      });
    } catch (err) {
      console.warn('[SendWithNotes] Could not post to group chat:', err);
    }
  }

  async function handleSend() {
    if (!selectedMemberId) { setError('Please select a recipient.'); return; }
    if (!note.trim()) { setError('Add a note before sending.'); return; }
    setIsSending(true);
    setError('');
    try {
      const ok = await sendItemWithNotes(
        teamId,
        galaxyId,
        selectedMemberId,
        senderName,
        itemName,
        sourceType,
        sourceId,
        note.trim(),
      );
      if (ok) {
        // TC7: also post to group chat
        await postToGroupChat(note.trim());
        setSent(true);
        setTimeout(() => onSent(), 1200);
      } else {
        setError('Failed to send. Try again.');
      }
    } catch {
      setError('Failed to send. Try again.');
    } finally {
      setIsSending(false);
    }
  }

  const recipientName = teamMembers.find(m => m.userId === selectedMemberId)?.displayName
    || teamMembers.find(m => m.userId === selectedMemberId)?.role
    || 'teammate';

  return (
    <div
      className={`fixed inset-0 bg-black/60 ${zIndexClass} flex items-center justify-center p-4`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-white font-medium">Sent to {recipientName}</p>
            <p className="text-xs text-gray-400 mt-1">Posted to team chat & their todo list</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">Send with notes</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{itemName}</p>
            </div>

            {/* Recipient selector */}
            {teamMembers.length > 1 ? (
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Send to</label>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.userId}>
                      {m.displayName || m.role}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-3 px-3 py-2.5 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <p className="text-xs text-gray-500">Sending to</p>
                <p className="text-sm text-white font-medium">
                  {teamMembers[0]?.displayName || teamMembers[0]?.role}
                </p>
              </div>
            )}

            {/* Note */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Your note</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add feedback, questions, or instructions..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleSend}
                disabled={isSending}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
