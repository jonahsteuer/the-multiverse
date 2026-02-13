'use client';

import { useState, useRef, useEffect } from 'react';
import type { TeamMemberRecord, TeamRole } from '@/types';

interface TaskAssignmentDropdownProps {
  taskId: string;
  taskTitle: string;
  teamMembers: TeamMemberRecord[];
  currentAssigneeId?: string;
  teamId: string;
  onAssign: (taskId: string, userId: string) => void;
  onInviteNew?: () => void;
  onClose: () => void;
  anchorPosition?: { top: number; left: number };
}

/** Get role badge color */
function getRoleBadgeColor(role: TeamRole): string {
  switch (role) {
    case 'admin': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'manager': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'videographer': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'editor': return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'artist': return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  }
}

/** Get role emoji */
function getRoleEmoji(role: TeamRole): string {
  switch (role) {
    case 'admin': return '👑';
    case 'manager': return '📋';
    case 'videographer': return '🎬';
    case 'editor': return '✂️';
    case 'artist': return '🎵';
    default: return '🤝';
  }
}

export function TaskAssignmentDropdown({
  taskId,
  taskTitle,
  teamMembers,
  currentAssigneeId,
  teamId,
  onAssign,
  onInviteNew,
  onClose,
  anchorPosition,
}: TaskAssignmentDropdownProps) {
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAssign = async (userId: string) => {
    setIsAssigning(userId);
    try {
      const response = await fetch('/api/team/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          taskId,
          teamId,
          assigneeUserId: userId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onAssign(taskId, userId);
        onClose();
      }
    } catch (err) {
      console.error('[TaskAssignment] Failed to assign:', err);
    } finally {
      setIsAssigning(null);
    }
  };

  const style: React.CSSProperties = anchorPosition
    ? { position: 'fixed', top: anchorPosition.top, left: anchorPosition.left, zIndex: 60 }
    : {};

  return (
    <div ref={dropdownRef} style={style} className="w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
      {/* Header */}
      <div className="p-3 border-b border-gray-700/50">
        <div className="text-xs text-gray-400 uppercase tracking-wide">Assign to</div>
        <div className="text-sm text-white font-medium truncate mt-0.5">{taskTitle}</div>
      </div>

      {/* Member List */}
      <div className="max-h-60 overflow-y-auto">
        {teamMembers.map((member) => {
          const isCurrent = member.userId === currentAssigneeId;
          const isLoading = isAssigning === member.userId;

          return (
            <button
              key={member.id}
              onClick={() => !isCurrent && handleAssign(member.userId)}
              disabled={isCurrent || !!isAssigning}
              className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left ${
                isCurrent ? 'bg-purple-500/10' : ''
              } ${isAssigning ? 'opacity-50' : ''}`}
            >
              {/* Avatar placeholder */}
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">
                {getRoleEmoji(member.role)}
              </div>

              {/* Name + role */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{member.displayName}</div>
                <span className={`text-xs px-1.5 py-0.5 rounded border ${getRoleBadgeColor(member.role)}`}>
                  {member.role}
                </span>
              </div>

              {/* Status indicators */}
              {isCurrent && (
                <span className="text-xs text-purple-400 flex-shrink-0">Current</span>
              )}
              {isLoading && (
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Invite New Option */}
      {onInviteNew && (
        <div className="border-t border-gray-700/50">
          <button
            onClick={onInviteNew}
            className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-dashed border-purple-500/50 flex items-center justify-center text-sm flex-shrink-0">
              +
            </div>
            <div className="text-sm text-purple-300">Invite someone new</div>
          </button>
        </div>
      )}
    </div>
  );
}

