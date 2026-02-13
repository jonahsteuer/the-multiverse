'use client';

import { useState, useEffect } from 'react';
import type { TeamTask, TeamMemberRecord } from '@/types';

interface TodoListProps {
  teamId: string;
  galaxyId: string;
  tasks: TeamTask[];
  teamMembers: TeamMemberRecord[];
  currentUserId?: string;
  isAdmin: boolean;
  onTaskClick: (task: TeamTask) => void;
  onAssignTask?: (taskId: string) => void;
}

/** Format task due date for display */
function formatDueDate(dateStr: string, timeStr: string): string {
  const now = new Date();
  const taskDate = new Date(dateStr + 'T00:00:00');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));

  // Format time for display
  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  if (taskDate.getTime() === today.getTime()) {
    return formatTime(timeStr); // "9:30 PM"
  }
  if (taskDate.getTime() === tomorrow.getTime()) {
    return `Tomorrow ${formatTime(timeStr)}`;
  }
  if (taskDate <= endOfWeek) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[taskDate.getDay()]; // "Wed"
  }
  // Further out — show date
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[taskDate.getMonth()]} ${taskDate.getDate()}`;
}

/** Get emoji for task type */
function getTaskEmoji(type: string): string {
  switch (type) {
    case 'invite_team': return '👥';
    case 'brainstorm': return '💡';
    case 'prep': return '📝';
    case 'film': return '🎬';
    case 'edit': return '✂️';
    case 'review': return '👁️';
    case 'post': return '📱';
    case 'release': return '🚀';
    case 'shoot': return '📸';
    default: return '✨';
  }
}

/** Get status color */
function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'text-gray-400';
    case 'in_progress': return 'text-yellow-400';
    case 'completed': return 'text-green-400';
    default: return 'text-gray-400';
  }
}

export function TodoList({
  teamId,
  galaxyId,
  tasks,
  teamMembers,
  currentUserId,
  isAdmin,
  onTaskClick,
  onAssignTask,
}: TodoListProps) {
  // Only show non-completed tasks, filtered for this galaxy
  const visibleTasks = tasks.filter(
    t => t.status !== 'completed' &&
    (t.galaxyId === galaxyId || !t.galaxyId) &&
    // If not admin, only show own tasks + shared events
    (isAdmin || t.assignedTo === currentUserId || t.taskCategory === 'event')
  );

  // Separate tasks and events
  const personalTasks = visibleTasks.filter(t => t.taskCategory === 'task');
  const sharedEvents = visibleTasks.filter(t => t.taskCategory === 'event');

  if (visibleTasks.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">📋</span>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Your Tasks</h3>
        </div>
        <div className="text-center py-4 text-gray-500 text-sm">
          No tasks right now ✨
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
      {/* Personal Tasks */}
      {personalTasks.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📋</span>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Your Tasks</h3>
            <span className="text-xs text-gray-500 ml-auto">{personalTasks.length}</span>
          </div>
          <div className="space-y-1.5">
            {personalTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                teamMembers={teamMembers}
                isAdmin={isAdmin}
                onClick={() => onTaskClick(task)}
                onAssign={onAssignTask ? () => onAssignTask(task.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Shared Events */}
      {sharedEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📅</span>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Upcoming Events</h3>
            <span className="text-xs text-gray-500 ml-auto">{sharedEvents.length}</span>
          </div>
          <div className="space-y-1.5">
            {sharedEvents.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                teamMembers={teamMembers}
                isAdmin={isAdmin}
                onClick={() => onTaskClick(task)}
                isEvent
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Task Item Sub-component
// ============================================================================

function TaskItem({
  task,
  teamMembers,
  isAdmin,
  onClick,
  onAssign,
  isEvent = false,
}: {
  task: TeamTask;
  teamMembers: TeamMemberRecord[];
  isAdmin: boolean;
  onClick: () => void;
  onAssign?: () => void;
  isEvent?: boolean;
}) {
  const assignee = task.assignedTo
    ? teamMembers.find(m => m.userId === task.assignedTo)
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-all group text-left"
    >
      {/* Checkbox / Event icon */}
      <div className={`flex-shrink-0 w-5 h-5 rounded ${
        isEvent
          ? 'bg-blue-500/20 border border-blue-500/30 flex items-center justify-center'
          : 'border-2 border-gray-600 group-hover:border-purple-400 transition-colors rounded'
      }`}>
        {isEvent && <span className="text-[10px]">📅</span>}
      </div>

      {/* Task emoji + title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{getTaskEmoji(task.type)}</span>
          <span className="text-sm text-white truncate">{task.title}</span>
        </div>
        {assignee && isAdmin && (
          <div className="text-xs text-gray-500 mt-0.5">
            Assigned to {assignee.displayName}
          </div>
        )}
      </div>

      {/* Due date */}
      <div className="flex-shrink-0 text-xs text-gray-400">
        {formatDueDate(task.date, task.startTime)}
      </div>

      {/* Assign button (admin only, non-invite tasks) */}
      {isAdmin && onAssign && task.type !== 'invite_team' && !task.assignedTo && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAssign();
          }}
          className="flex-shrink-0 text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded border border-purple-500/30 hover:border-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Assign
        </button>
      )}
    </button>
  );
}

