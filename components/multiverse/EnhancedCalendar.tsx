'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { ArtistProfile, BrainstormResult, TeamTask, TeamMemberRecord, TeamPermission } from '@/types';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GoogleEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location?: string;
}

interface ScheduledTask {
  id: string;
  title: string;
  description: string;
  type: 'prep' | 'audience-builder' | 'teaser' | 'promo' | 'release' | 'edit' | 'shoot';
  date: string;
  startTime: string; // e.g., "10:00"
  endTime: string;   // e.g., "11:00"
  completed: boolean;
  contentFormat?: string; // e.g., "Music Video Snippet" — from brainstorm
  isPostEvent?: boolean;  // true for shared calendar post/release events
}

interface CalendarDay {
  date: Date;
  tasks: ScheduledTask[];
  googleEvents: GoogleEvent[];
  isToday: boolean;
  isPast: boolean;
}

// Shared event data that gets saved to Supabase for team members
export interface SharedCalendarEvent {
  title: string;
  description: string;
  type: 'audience-builder' | 'teaser' | 'promo' | 'release';
  date: string;
  startTime: string;
  endTime: string;
}

interface EnhancedCalendarProps {
  songName: string;
  releaseDate: string;
  onTaskComplete?: (taskId: string) => void;
  onClose?: () => void;
  showGoogleSync?: boolean;
  artistProfile?: ArtistProfile;
  brainstormResult?: BrainstormResult; // Content format assignments from brainstorm
  // Team / role-based props
  teamTasks?: TeamTask[]; // Tasks from the team system
  teamMembers?: TeamMemberRecord[];
  currentUserId?: string;
  userPermissions?: TeamPermission; // 'full' (admin) or 'member'
  onTaskReschedule?: (taskId: string, newDate: string, startTime: string, endTime: string) => void;
  onAssignTask?: (taskId: string) => void;
  // Callback: fires when admin calendar generates shared events (posts + release day)
  onSharedEventsGenerated?: (events: SharedCalendarEvent[]) => void;
  // Callback: fires when a post event card is clicked (open PostDetailModal)
  onPostCardClick?: (taskId: string) => void;
  // Callback: fires when a non-post task is clicked (open TaskPanel)
  onNonPostTaskClick?: (taskId: string) => void;
  // Callback: fires when user right-clicks a calendar task to assign it
  onTaskContextMenu?: (taskId: string, x: number, y: number) => void;
}

// ============================================================
// HAS RAW FOOTAGE task templates (artist has unedited clips, no finalized posts)
// Flow: Review footage → Send to editor → Review edits → Upload → Finalize → Brainstorm → Shoot plan
// ============================================================
function buildRawFootagePrepTasks(
  roughClipCount: number,
  editorName?: string,
): {
  week1: { title: string; description: string; duration: number }[];
  week2: { title: string; description: string; duration: number }[];
} {
  const batchOne = Math.min(10, roughClipCount);
  const batchTwo = Math.max(0, roughClipCount - 10);
  const editorNote = editorName ? ` to ${editorName}` : '';

  const week1: { title: string; description: string; duration: number }[] = [
    {
      title: `Review & organize existing footage`,
      description: `Go through your ${roughClipCount} rough clips. Pick the ${batchOne} strongest and flag any that need specific edits before they're post-ready.`,
      duration: 45,
    },
  ];

  if (editorName) {
    week1.push({
      title: `Send first batch to ${editorName} for editing (posts 1–${batchOne})`,
      description: `Forward your top ${batchOne} clips${editorNote} with any notes on cuts, color, or vibe. Include the post dates you're targeting.`,
      duration: 20,
    });
  } else {
    week1.push({
      title: `Edit first batch (posts 1–${batchOne})`,
      description: `Cut your top ${batchOne} rough clips into post-ready videos. Aim for 15–30 seconds each.`,
      duration: Math.min(batchOne * 15, 120),
    });
  }

  week1.push({
    title: `Finalize any posts ready to go live`,
    description: editorName
      ? `Any clips you already know look good — write captions and schedule them now. Don't wait for the full batch.`
      : `Do a final pass on the clips you just edited. Write captions and confirm scheduling.`,
    duration: 25,
  });

  const week2: { title: string; description: string; duration: number }[] = [];

  if (editorName) {
    week2.push({
      title: `Review ${editorName}'s edits (posts 1–${batchOne})`,
      description: `${editorName} has finished the first batch. Review, leave any final notes, and approve what's ready.`,
      duration: 30,
    });
  }

  week2.push({
    title: `Upload & finalize posts 1–${batchOne}`,
    description: `Link the approved clips to their scheduled post slots and write captions. These should be ready to go live.`,
    duration: 30,
  });

  if (batchTwo > 0) {
    if (editorName) {
      week2.push({
        title: `Send second batch to ${editorName} for editing (posts ${batchOne + 1}–${roughClipCount})`,
        description: `Forward your remaining ${batchTwo} clips${editorNote} with edit notes for the next wave of posts.`,
        duration: 20,
      });
    } else {
      week2.push({
        title: `Edit second batch (posts ${batchOne + 1}–${roughClipCount})`,
        description: `Edit your remaining ${batchTwo} clips into post-ready videos.`,
        duration: Math.min(batchTwo * 15, 90),
      });
    }
  }

  week2.push({
    title: `Brainstorm next content batch`,
    description: `Your existing footage has a runway of ${roughClipCount} posts. Start thinking about what to shoot next to keep the momentum going.`,
    duration: 45,
  });

  if (editorName) {
    week2.push({
      title: `Plan shoot day (assign to ${editorName})`,
      description: `Coordinate with ${editorName} on a shoot date. Share location ideas and a shot list based on your brainstorm.`,
      duration: 30,
    });
  }

  return { week1, week2 };
}

// ============================================================
// CONTENT-LIGHT task templates (artist has < 10 edited clips)
// Flow: Brainstorm → Plan shoot → Shoot → Edit → Upload → Finalize
// ============================================================
function buildContentLightPrepTasks(editorName?: string): {
  week1: { title: string; description: string; duration: number }[];
  week2: { title: string; description: string; duration: number }[];
} {
  const editLabel = editorName ? ` — assign to ${editorName}` : '';
  return {
    week1: [
      {
        title: 'Brainstorm content ideas',
        description: 'Come up with 6–10 post concepts for your upcoming release. Think about hooks, settings, and what fits your sound.',
        duration: 45,
      },
      {
        title: 'Plan shoot day',
        description: 'Map out your shoot day: locations, outfits, shot list. Coordinate with your team if needed.',
        duration: 30,
      },
      {
        title: 'Shoot day',
        description: 'Film everything on your shot list. Capture plenty of B-roll — stories alone eat through content fast.',
        duration: 150,
      },
    ],
    week2: [
      {
        title: `Edit batch 1 (Posts 1-3)${editLabel}`,
        description: editorName
          ? `Send footage to ${editorName} for first 3 posts. Include any specific notes about cuts or vibe.`
          : 'Cut your first 3 posts from the shoot footage. Aim for 15–30 seconds each.',
        duration: 75,
      },
      {
        title: `Edit batch 2 (Posts 4-6)${editLabel}`,
        description: editorName
          ? `${editorName} continues editing posts 4–6.`
          : 'Edit your next 3 posts. Vary the energy between clips.',
        duration: 75,
      },
      {
        title: 'Upload post edits',
        description: 'Link each edited video to its scheduled post slot in the calendar.',
        duration: 30,
      },
      {
        title: 'Review & finalize posts',
        description: 'Final pass on all posts. Write captions, add hashtags, and confirm everything looks right before the first post goes live.',
        duration: 45,
      },
    ],
  };
}

// ============================================================
// CONTENT-READY task templates (artist has 10+ edited clips)
// Flow: Upload → Send edit notes → Finalize → Review edits → Brainstorm → Plan shoot
// ============================================================
function buildContentReadyPrepTasks(
  editedClipCount: number,
  hasRawFootage: boolean,
  editorName?: string,
): {
  week1: { title: string; description: string; duration: number }[];
  week2: { title: string; description: string; duration: number }[];
} {
  const batchSize = 10;
  const totalBatches = Math.ceil(Math.min(editedClipCount, 30) / batchSize); // cap at 30 clips shown
  const week1: { title: string; description: string; duration: number }[] = [];
  const week2: { title: string; description: string; duration: number }[] = [];

  // Week 1: Upload + send to editor (editor turn-around takes time)
  // Week 2: Finalize (once edits are back / approved)
  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize + 1;
    const end = Math.min((i + 1) * batchSize, editedClipCount);

    week1.push({
      title: `Upload edits ${start}–${end}`,
      description: `Upload ${end - start + 1} edited clips. Once uploaded you can review them and send any that need revision back to your editor.`,
      duration: 30,
    });

    if (editorName) {
      week1.push({
        title: `Send edits back to ${editorName} with notes`,
        description: `Review the uploaded clips. Write revision notes on any that need work, then send them back to ${editorName}. Skip the ones that look ready — those go straight to finalizing.`,
        duration: 20,
      });
    }
  }

  // Week 2: Finalize (after editor revisions come back OR for approved clips)
  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize + 1;
    const end = Math.min((i + 1) * batchSize, editedClipCount);

    week2.push({
      title: `Finalize posts ${start}–${end}`,
      description: editorName
        ? `Posts without revision notes are ready to go. Write captions and confirm scheduling for each.`
        : `Do a final pass on posts ${start}–${end}. Write captions, add hashtags, confirm everything looks right.`,
      duration: 25,
    });
  }

  // If editor: add a review task for their revised edits (week 2)
  if (editorName) {
    week2.push({
      title: `Review ${editorName}'s revised edits`,
      description: `${editorName} has addressed your notes. Review the updated clips and finalize any remaining posts.`,
      duration: 30,
    });
  }

  // Raw footage / music video editing task
  if (hasRawFootage) {
    week2.push({
      title: 'Edit MV footage into post clips',
      description: 'Cut music video footage into 15–30 second post-ready clips. Aim for 3–5 strong cuts.',
      duration: 90,
    });
  }

  // Brainstorm for next content batch once existing clips are uploaded
  week2.push({
    title: 'Brainstorm next content batch',
    description: 'You\'ve uploaded your existing clips — now think ahead. What ideas do you want to shoot next? List 5–8 concepts.',
    duration: 45,
  });

  if (editorName) {
    week2.push({
      title: `Plan shoot day (assign to ${editorName})`,
      description: `Set a shoot date with ${editorName}. Share the location ideas and shot list from your brainstorm.`,
      duration: 30,
    });
  }

  return { week1, week2 };
}

// Posting weeks (3-4): Include posting + ongoing content tasks
const POSTING_TASKS_LIGHT = [
  { title: '🎬 Film new content', description: 'Capture content for next cycle', duration: 120, type: 'prep' },
  { title: '✂️ Quick edit', description: 'Edit and prep upcoming posts', duration: 90, type: 'prep' },
  { title: '💡 Brainstorm ideas', description: 'Plan content for future weeks', duration: 60, type: 'prep' },
  { title: '📱 Engage with audience', description: 'Respond to comments, build community', duration: 45, type: 'prep' },
];
const POSTING_TASKS_READY = [
  { title: '📱 Engage with audience', description: 'Respond to comments, build community and reply to DMs', duration: 45, type: 'prep' },
  { title: '📊 Review post performance', description: 'Check which posts performed best and note what worked', duration: 30, type: 'prep' },
];


const POST_TYPES = {
  'audience-builder': { emoji: '🌱', color: 'green', description: 'Build connection with your audience' },
  'teaser': { emoji: '👀', color: 'purple', description: 'Build anticipation for your release' },
  'promo': { emoji: '🎵', color: 'yellow', description: 'Promote your released music' },
};

// Draggable Task Component with Time Editing
function DraggableTask({ 
  task, 
  isExpanded, 
  onToggle, 
  onComplete,
  onTimeChange,
  formatTime, 
  getTaskColor,
  onPostClick,
  onNonPostClick,
  onContextMenuAssign,
}: {
  task: ScheduledTask;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete?: (id: string) => void;
  onTimeChange?: (taskId: string, startTime: string, endTime: string) => void;
  formatTime: (time: string) => string;
  getTaskColor: (type: string) => string;
  onPostClick?: () => void;
  onNonPostClick?: () => void;
  onContextMenuAssign?: (taskId: string, x: number, y: number) => void;
}) {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editedStartTime, setEditedStartTime] = useState(task.startTime);
  const [editedEndTime, setEditedEndTime] = useState(task.endTime);
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  // Calculate duration in minutes
  const calculateDuration = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  };

  // Format time from minutes since midnight
  const formatTimeFromMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleStartTimeChange = (newStart: string) => {
    const duration = calculateDuration(editedStartTime, editedEndTime);
    const [startH, startM] = newStart.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = startMinutes + duration;
    const newEnd = formatTimeFromMinutes(endMinutes);
    
    setEditedStartTime(newStart);
    setEditedEndTime(newEnd);
  };

  const handleEndTimeChange = (newEnd: string) => {
    const duration = calculateDuration(editedStartTime, editedEndTime);
    const [endH, endM] = newEnd.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    const startMinutes = endMinutes - duration;
    const newStart = formatTimeFromMinutes(startMinutes);
    
    setEditedStartTime(newStart);
    setEditedEndTime(newEnd);
  };

  const handleSaveTime = () => {
    onTimeChange?.(task.id, editedStartTime, editedEndTime);
    setIsEditingTime(false);
  };

  // Click outside handler
  useEffect(() => {
    if (!isEditingTime) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside the time edit area
      if (!target.closest('.time-edit-area')) {
        setIsEditingTime(false);
        // Reset to original values
        setEditedStartTime(task.startTime);
        setEditedEndTime(task.endTime);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditingTime, task.startTime, task.endTime]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isEditingTime) {
          e.stopPropagation();
          if (task.isPostEvent && onPostClick) {
            onPostClick();
          } else if (!task.isPostEvent && onNonPostClick) {
            onNonPostClick();
          } else {
            onToggle();
          }
        }
      }}
      onContextMenu={(e) => {
        if (onContextMenuAssign && !task.isPostEvent) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenuAssign(task.id, e.clientX, e.clientY);
        }
      }}
      className={`text-[10px] p-1.5 mb-1 border rounded transition-all ${
        task.isPostEvent ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${getTaskColor(task.type)} ${
        isExpanded ? 'ring-2 ring-white/30' : 'hover:ring-1 hover:ring-white/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium truncate">{task.title}</span>
        <span className="text-[8px] opacity-70 ml-1">{isExpanded ? '▼' : '▶'}</span>
      </div>
      
      {/* Time display/edit */}
      {!isEditingTime ? (
        <div 
          className="text-[8px] opacity-70 hover:opacity-100 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingTime(true);
          }}
          title="Click to edit time"
        >
          {formatTime(task.startTime)} - {formatTime(task.endTime)}
        </div>
      ) : (
        <div className="time-edit-area flex gap-1 items-center mt-1" onClick={(e) => e.stopPropagation()}>
          <input
            type="time"
            value={editedStartTime}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            className="w-16 text-[8px] px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-white"
          />
          <span className="text-[8px]">-</span>
          <input
            type="time"
            value={editedEndTime}
            onChange={(e) => handleEndTimeChange(e.target.value)}
            className="w-16 text-[8px] px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-white"
          />
          <button
            onClick={handleSaveTime}
            className="text-[8px] px-1 py-0.5 bg-green-500 hover:bg-green-600 rounded text-white"
          >
            ✓
          </button>
          <button
            onClick={() => {
              setEditedStartTime(task.startTime);
              setEditedEndTime(task.endTime);
              setIsEditingTime(false);
            }}
            className="text-[8px] px-1 py-0.5 bg-gray-600 hover:bg-gray-700 rounded text-white"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-white/20">
          <p className="text-[9px] opacity-90">{task.description}</p>
        </div>
      )}
    </div>
  );
}

// Sortable Task Component for List View
function SortableTask({
  task,
  isExpanded,
  onToggle,
  onComplete,
  onTimeChange,
  formatTime,
  getTaskColor,
}: {
  task: ScheduledTask;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete?: (id: string) => void;
  onTimeChange?: (taskId: string, startTime: string, endTime: string) => void;
  formatTime: (time: string) => string;
  getTaskColor: (type: string) => string;
}) {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editedStartTime, setEditedStartTime] = useState(task.startTime);
  const [editedEndTime, setEditedEndTime] = useState(task.endTime);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Calculate duration in minutes
  const calculateDuration = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  };

  // Format time from minutes since midnight
  const formatTimeFromMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleStartTimeChange = (newStart: string) => {
    const duration = calculateDuration(editedStartTime, editedEndTime);
    const [startH, startM] = newStart.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = startMinutes + duration;
    const newEnd = formatTimeFromMinutes(endMinutes);
    
    setEditedStartTime(newStart);
    setEditedEndTime(newEnd);
  };

  const handleEndTimeChange = (newEnd: string) => {
    const duration = calculateDuration(editedStartTime, editedEndTime);
    const [endH, endM] = newEnd.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    const startMinutes = endMinutes - duration;
    const newStart = formatTimeFromMinutes(startMinutes);
    
    setEditedStartTime(newStart);
    setEditedEndTime(newEnd);
  };

  const handleSaveTime = () => {
    onTimeChange?.(task.id, editedStartTime, editedEndTime);
    setIsEditingTime(false);
  };

  // Click outside handler
  useEffect(() => {
    if (!isEditingTime) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.time-edit-area')) {
        setIsEditingTime(false);
        setEditedStartTime(task.startTime);
        setEditedEndTime(task.endTime);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditingTime, task.startTime, task.endTime]);

  // Format date for display
  const taskDate = new Date(task.date + 'T00:00:00');
  const dateStr = taskDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isEditingTime) {
          e.stopPropagation();
          onToggle();
        }
      }}
      className={`p-3 mb-2 border rounded-lg cursor-grab active:cursor-grabbing transition-all ${getTaskColor(task.type)} ${
        isExpanded ? 'ring-2 ring-white/30' : 'hover:ring-1 hover:ring-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{task.title}</span>
            <span className="text-xs opacity-60">{dateStr}</span>
          </div>
          
          {/* Time display/edit */}
          {!isEditingTime ? (
            <div 
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer inline-block"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTime(true);
              }}
              title="Click to edit time"
            >
              {formatTime(task.startTime)} - {formatTime(task.endTime)}
            </div>
          ) : (
            <div className="time-edit-area flex gap-1 items-center mt-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="time"
                value={editedStartTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-20 text-xs px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
              />
              <span className="text-xs">-</span>
              <input
                type="time"
                value={editedEndTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-20 text-xs px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
              />
              <button
                onClick={handleSaveTime}
                className="text-xs px-2 py-1 bg-green-500 hover:bg-green-600 rounded text-white"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setEditedStartTime(task.startTime);
                  setEditedEndTime(task.endTime);
                  setIsEditingTime(false);
                }}
                className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-white"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <span className="text-xs opacity-70">{isExpanded ? '▼' : '▶'}</span>
      </div>
      
      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-white/20">
          <p className="text-xs opacity-90">{task.description}</p>
        </div>
      )}
    </div>
  );
}

// Droppable Day Component
function DroppableDay({
  dateStr,
  day,
  dayIndex,
  dayTasks,
  dayGoogleEvents,
  hasContent,
  expandedTaskId,
  setExpandedTaskId,
  onTaskComplete,
  onTimeChange,
  formatTime,
  getTaskColor,
  onPostCardClick,
  onNonPostTaskClick,
  onTaskContextMenu,
}: {
  dateStr: string;
  day: CalendarDay;
  dayIndex: number;
  dayTasks: ScheduledTask[];
  dayGoogleEvents: GoogleEvent[];
  hasContent: boolean;
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
  onTaskComplete?: (id: string) => void;
  onTimeChange?: (taskId: string, startTime: string, endTime: string) => void;
  formatTime: (time: string) => string;
  getTaskColor: (type: string) => string;
  onPostCardClick?: (taskId: string) => void;
  onNonPostTaskClick?: (taskId: string) => void;
  onTaskContextMenu?: (taskId: string, x: number, y: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateStr,
  });

  return (
    <div
      ref={setNodeRef}
      key={dayIndex}
      className={`flex-1 min-h-[100px] p-2 rounded-lg border transition-all ${
        isOver ? 'border-blue-400 bg-blue-500/20 ring-2 ring-blue-400' : ''
      } ${
        day.isToday 
          ? 'border-yellow-500 bg-yellow-500/10' 
          : hasContent 
            ? 'border-gray-700 bg-gray-900/50'
            : 'border-gray-800 bg-gray-900/30'
      }`}
    >
      {/* Date Header */}
      <div className={`text-[10px] mb-2 ${day.isToday ? 'text-yellow-400 font-bold' : 'text-gray-500'}`}>
        {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
        <span className="ml-1">{day.date.getMonth() + 1}/{day.date.getDate()}</span>
        {day.isToday && <span className="ml-1">• Today</span>}
      </div>
      
      {/* All items (Google Events + Tasks) sorted chronologically */}
      {(() => {
        // Combine Google events and tasks into a single sorted array
        const googleEventItems = dayGoogleEvents.map(event => ({
          type: 'google' as const,
          time: new Date(event.start).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          event
        }));
        
        const taskItems = dayTasks.map(task => ({
          type: 'task' as const,
          time: task.startTime,
          task
        }));
        
        const allItems = [...googleEventItems, ...taskItems].sort((a, b) => a.time.localeCompare(b.time));
        
        return allItems.map((item, index) => {
          if (item.type === 'google' && item.event) {
            return (
              <div
                key={`google-${item.event.id}`}
                className="text-[9px] p-1 mb-1 bg-gray-700/50 border border-gray-600 rounded text-gray-400 truncate"
                title={item.event.title}
              >
                <span className="opacity-60">
                  {new Date(item.event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="ml-1">{item.event.title}</span>
              </div>
            );
          } else if (item.type === 'task' && item.task) {
            return (
              <DraggableTask
                key={item.task.id}
                task={item.task}
                isExpanded={expandedTaskId === item.task.id}
                onToggle={() => setExpandedTaskId(expandedTaskId === item.task.id ? null : item.task.id)}
                onComplete={onTaskComplete}
                onTimeChange={onTimeChange}
                formatTime={formatTime}
                getTaskColor={getTaskColor}
                onPostClick={item.task.isPostEvent ? () => onPostCardClick?.(item.task.id) : undefined}
                onNonPostClick={!item.task.isPostEvent ? () => onNonPostTaskClick?.(item.task.id) : undefined}
                onContextMenuAssign={onTaskContextMenu ?? undefined}
              />
            );
          }
          return null;
        });
      })()}
    </div>
  );
}

export function EnhancedCalendar({
  songName,
  releaseDate,
  onTaskComplete,
  onClose,
  showGoogleSync = true,
  artistProfile,
  brainstormResult,
  teamTasks,
  teamMembers,
  currentUserId,
  userPermissions = 'full',
  onTaskReschedule,
  onAssignTask,
  onSharedEventsGenerated,
  onPostCardClick,
  onNonPostTaskClick,
  onTaskContextMenu,
}: EnhancedCalendarProps) {
  const isAdmin = userPermissions === 'full';
  const timeBudget = artistProfile?.timeBudgetHoursPerWeek || 7; // Default to 7 hours
  
  // Use useMemo to stabilize the preferredDays array reference
  const preferredDays = useMemo(() => {
    return artistProfile?.preferredDays || ['saturday', 'sunday'];
  }, [artistProfile?.preferredDays?.join(',')]); // Stable dependency based on values
  
  console.log('[EnhancedCalendar] Using artist profile:', {
    timeBudget,
    preferredDays,
    hasProfile: !!artistProfile,
    releaseStrategy: (artistProfile as any)?.releaseStrategy,
    releaseStrategyDesc: (artistProfile as any)?.releaseStrategyDescription,
    fullProfile: artistProfile
  });
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetchingEvents, setIsFetchingEvents] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [calendarPage, setCalendarPage] = useState(0); // 0 = weeks 1-4, 1 = weeks 5-8
  const [viewMode, setViewMode] = useState<'calendar' | 'posts' | 'list'>('calendar');
  
  // Drag & Drop state
  const [activeTask, setActiveTask] = useState<ScheduledTask | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    })
  );

  // Check Google Calendar connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/calendar/status');
        if (response.ok) {
          const data = await response.json();
          setIsGoogleConnected(data.connected === true);
          if (data.connected) {
            fetchGoogleEvents();
          }
        }
      } catch {
        console.log('[Calendar] Could not check Google connection status');
      }
    };
    checkConnection();
  }, []);

  // Fetch Google Calendar events
  const fetchGoogleEvents = async () => {
    console.log('[Calendar] 📅 Starting to fetch Google events...');
    setIsFetchingEvents(true);
    try {
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days
      
      console.log('[Calendar] Fetching events from:', timeMin, 'to:', timeMax);
      const response = await fetch(`/api/calendar/fetch?timeMin=${timeMin}&timeMax=${timeMax}`);
      console.log('[Calendar] Fetch response status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Calendar] ✅ Fetched Google events data:', data);
        setGoogleEvents(data.events || []);
        console.log(`[Calendar] ✅ Set ${data.events?.length || 0} Google events in state`);
      } else if (response.status === 401) {
        // Token expired or needs reconnection - this is expected, just log info
        console.log('[Calendar] ℹ️ Google Calendar disconnected or token expired. User can reconnect when needed.');
        setIsGoogleConnected(false);
      } else {
        const errorText = await response.text();
        console.error('[Calendar] ❌ Failed to fetch events:', response.status, errorText);
      }
    } catch (error) {
      console.error('[Calendar] ❌ Error fetching Google events:', error);
    } finally {
      setIsFetchingEvents(false);
    }
  };

  // Connect to Google Calendar
  const connectGoogle = () => {
    setIsConnecting(true);
    window.location.href = '/api/calendar/auth?return_url=' + encodeURIComponent(window.location.href);
  };

  // Find free time slot on a given day (between 8am and 10pm)
  const findFreeTimeSlot = (date: Date, durationMinutes: number, existingTasks: ScheduledTask[]): { start: string; end: string } | null => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Get all busy times for this day
    const busyTimes: { start: number; end: number }[] = [];
    
    // Add Google events
    googleEvents.forEach(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0];
      if (eventDate === dateStr) {
        const startHour = new Date(event.start).getHours() + new Date(event.start).getMinutes() / 60;
        const endHour = new Date(event.end).getHours() + new Date(event.end).getMinutes() / 60;
        busyTimes.push({ start: startHour, end: endHour });
      }
    });
    
    // Add existing scheduled tasks
    existingTasks.forEach(task => {
      if (task.date === dateStr) {
        const [startH, startM] = task.startTime.split(':').map(Number);
        const [endH, endM] = task.endTime.split(':').map(Number);
        busyTimes.push({ start: startH + startM / 60, end: endH + endM / 60 });
      }
    });
    
    // Sort by start time
    busyTimes.sort((a, b) => a.start - b.start);
    
    // Find first free slot between 10am and 10pm
    const workdayStart = 10; // 10am
    const workdayEnd = 22;  // 10pm
    const durationHours = durationMinutes / 60;
    
    let currentTime = workdayStart;
    
    for (const busy of busyTimes) {
      // Check if there's enough time before this busy period
      if (busy.start - currentTime >= durationHours) {
        const startHour = Math.floor(currentTime);
        const startMin = Math.round((currentTime - startHour) * 60);
        const endTime = currentTime + durationHours;
        const endHour = Math.floor(endTime);
        const endMin = Math.round((endTime - endHour) * 60);
        
        return {
          start: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
          end: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
        };
      }
      currentTime = Math.max(currentTime, busy.end);
    }
    
    // Check if there's time after all busy periods
    if (workdayEnd - currentTime >= durationHours) {
      const startHour = Math.floor(currentTime);
      const startMin = Math.round((currentTime - startHour) * 60);
      const endTime = currentTime + durationHours;
      const endHour = Math.floor(endTime);
      const endMin = Math.round((endTime - endHour) * 60);
      
      return {
        start: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
        end: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
      };
    }
    
    return null; // No free slot found
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = scheduledTasks.find(t => t.id === taskId);
    if (task) {
      setActiveTask(task);
      console.log('[Calendar] Drag started:', task.title);
    }
  };

  // Handle time change for a task
  const handleTimeChange = (taskId: string, startTime: string, endTime: string) => {
    console.log('[Calendar] Time changed for task:', taskId, startTime, '-', endTime);
    
    const updatedTasks = scheduledTasks.map(task => {
      if (task.id === taskId) {
        return { ...task, startTime, endTime };
      }
      return task;
    });
    
    setScheduledTasks(updatedTasks);
    
    // Rebuild calendar with updated tasks
    const updatedCalendar = calendar.map(day => {
      const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
      return {
        ...day,
        tasks: updatedTasks.filter(t => t.date === dateStr),
      };
    });
    
    setCalendar(updatedCalendar);
  };

  // Handle drag end - move task to new date or reorder in list
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !activeTask) {
      setActiveTask(null);
      return;
    }

    const taskId = active.id as string;
    
    if (viewMode === 'list') {
      // List view: reorder tasks and adjust times
      const overTaskId = over.id as string;
      
      if (taskId !== overTaskId) {
        const oldIndex = scheduledTasks.findIndex(t => t.id === taskId);
        const newIndex = scheduledTasks.findIndex(t => t.id === overTaskId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          // Reorder tasks
          const reorderedTasks = [...scheduledTasks];
          const [movedTask] = reorderedTasks.splice(oldIndex, 1);
          reorderedTasks.splice(newIndex, 0, movedTask);
          
          // Adjust times based on new position
          const targetTask = scheduledTasks[newIndex];
          const targetStartTime = targetTask.startTime;
          
          // Calculate duration of moved task
          const [startH, startM] = movedTask.startTime.split(':').map(Number);
          const [endH, endM] = movedTask.endTime.split(':').map(Number);
          const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
          
          // Set new time
          const [newStartH, newStartM] = targetStartTime.split(':').map(Number);
          const newStartMinutes = newStartH * 60 + newStartM;
          const newEndMinutes = newStartMinutes + durationMinutes;
          const newEndH = Math.floor(newEndMinutes / 60);
          const newEndM = newEndMinutes % 60;
          
          movedTask.startTime = targetStartTime;
          movedTask.endTime = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;
          movedTask.date = targetTask.date;
          
          setScheduledTasks(reorderedTasks);
          
          // Rebuild calendar
          const updatedCalendar = calendar.map(day => {
            const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
            return {
              ...day,
              tasks: reorderedTasks.filter(t => t.date === dateStr),
            };
          });
          
          setCalendar(updatedCalendar);
          console.log('[Calendar] ✅ Task reordered in list and time adjusted');
        }
      }
    } else {
      // Calendar view: move task to new date
      const targetDateStr = over.id as string; // date in format YYYY-MM-DD
      
      console.log('[Calendar] Drag ended - Moving task:', taskId, 'to date:', targetDateStr);
      
      // Update the task's date
      const updatedTasks = scheduledTasks.map(task => {
        if (task.id === taskId) {
          return { ...task, date: targetDateStr };
        }
        return task;
      });
      
      setScheduledTasks(updatedTasks);
      
      // Rebuild calendar with updated tasks
      const updatedCalendar = calendar.map(day => {
        const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
        return {
          ...day,
          tasks: updatedTasks.filter(t => t.date === dateStr),
        };
      });
      
      setCalendar(updatedCalendar);
      console.log('[Calendar] ✅ Task moved to new date');
    }
    
    setActiveTask(null);
  };

  // Helper to check if a day is a preferred day
  const isPreferredDay = (date: Date): boolean => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    return preferredDays.map(d => d.toLowerCase()).includes(dayName);
  };

  // Generate schedule with tasks based on time budget
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tasks: ScheduledTask[] = [];
    const days: CalendarDay[] = [];
    const isMember = userPermissions === 'member';

    // ================================================================
    // MEMBER CALENDAR: Only show team tasks from Supabase (shared events + assigned tasks)
    // No local schedule generation — all events come from admin's saved shared events
    // ================================================================
    if (isMember) {
      // Generate 56 days of calendar grid
      const allDays: { date: Date; dateStr: string; weekNum: number }[] = [];
      for (let i = 0; i < 56; i++) {
        const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        allDays.push({
          date,
          dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          weekNum: Math.floor(i / 7),
        });
      }

      // Add team tasks from Supabase (shared events + tasks assigned to this user)
      if (teamTasks && teamTasks.length > 0) {
        for (const tt of teamTasks) {
          // Shared events (posts, release day) → always show
          // Tasks → only show if assigned to current user
          if (tt.taskCategory !== 'event' && tt.assignedTo && tt.assignedTo !== currentUserId) continue;

          let calType: ScheduledTask['type'] = 'prep';
          if (tt.type === 'post' || tt.type === 'release') calType = (tt as any).postType || tt.type as any;
          else if (tt.type === 'edit') calType = 'edit';
          else if (tt.type === 'shoot') calType = 'shoot';
          else if (tt.type === 'brainstorm') calType = 'prep';

          // Determine post type from title for display color
          if (tt.taskCategory === 'event') {
            if (tt.title.toLowerCase().includes('release')) calType = 'release';
            else if (tt.title.toLowerCase().includes('teaser')) calType = 'teaser';
            else if (tt.title.toLowerCase().includes('promo')) calType = 'promo';
            else if (tt.title.toLowerCase().includes('audience')) calType = 'audience-builder';
          }

          tasks.push({
            id: tt.id,
            title: tt.title,
            description: tt.description || '',
            type: calType,
            date: tt.date,
            startTime: tt.startTime || '10:00',
            endTime: tt.endTime || '11:00',
            completed: tt.status === 'completed',
            isPostEvent: tt.taskCategory === 'event',
          });
        }
      }

      console.log('[EnhancedCalendar] 👤 Member calendar: showing', tasks.length, 'items from team tasks');

      // Build calendar days
      for (const day of allDays) {
        days.push({
          date: day.date,
          tasks: tasks.filter(t => t.date === day.dateStr),
          googleEvents: googleEvents.filter(e => {
            const eventDate = new Date(e.start).toISOString().split('T')[0];
            return eventDate === day.dateStr;
          }),
          isToday: day.weekNum === 0 && day.date.getTime() === today.getTime(),
          isPast: false,
        });
      }

      setScheduledTasks(tasks);
      setCalendar(days);
      return; // Done — member calendar doesn't generate anything locally
    }
    
    // ================================================================
    // ADMIN CALENDAR: Full local schedule generation
    // ================================================================
    
    // Add release dates from artist profile
    const releases = (artistProfile as any)?.releases || [];
    releases.forEach((release: any, index: number) => {
      if (release.releaseDate && release.releaseDate !== 'TBD' && release.releaseDate !== null) {
        const releaseDateObj = new Date(release.releaseDate);
        const releaseDateStr = releaseDateObj.toISOString().split('T')[0];
        const releaseName = release.name || release.title || 'Release';
        
        // Check if release is within our 28-day window
        const daysUntilRelease = Math.floor((releaseDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilRelease >= 0 && daysUntilRelease < 28) {
          tasks.push({
            id: `release-${index}`,
            title: `🎵 ${releaseName} - RELEASE DAY!`,
            description: `${release.type === 'album' ? 'Album' : release.type === 'ep' ? 'EP' : 'Single'} release: ${releaseName}`,
            type: 'release',
            date: releaseDateStr,
            startTime: '00:00',
            endTime: '23:59',
            completed: false,
            isPostEvent: true,
          });
          console.log('[EnhancedCalendar] Added release date:', releaseName, releaseDateStr);
        }
      }
    });
    
    // Calculate minutes per week budget
    const weeklyBudgetMinutes = timeBudget * 60;
    console.log('[EnhancedCalendar] Weekly budget:', weeklyBudgetMinutes, 'minutes =', timeBudget, 'hours');
    
    // Track time spent per week
    const timeSpentPerWeek = [0, 0, 0, 0, 0, 0, 0, 0]; // 8 weeks
    
    // First pass: generate all days (8 weeks = 56 days for calendar navigation)
    const allDays: { date: Date; dateStr: string; weekNum: number; isPrep: boolean; dayOfWeek: number }[] = [];
    for (let i = 0; i < 56; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      allDays.push({
        date,
        dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        weekNum: Math.floor(i / 7),
        isPrep: i < 14,
        dayOfWeek: date.getDay(),
      });
    }
    
    // Sort days helper: preferred days first, then by day of week
    const sortByPreference = (daysArr: typeof allDays) => {
      return [...daysArr].sort((a, b) => {
        const aPreferred = isPreferredDay(a.date) ? 0 : 1;
        const bPreferred = isPreferredDay(b.date) ? 0 : 1;
        if (aPreferred !== bPreferred) return aPreferred - bPreferred;
        return a.dayOfWeek - b.dayOfWeek;
      });
    };

    // PREP PHASE (Weeks 1-2): Admin-only (members return early above)
    {
      // Determine content tier and find editor/videographer team member
      const editedClipCount = (artistProfile as any)?.editedClipCount ?? 0;
      const rawFootageDesc: string = (artistProfile as any)?.rawFootageDescription || '';
      const hasRawFootage = rawFootageDesc.length > 0;
      const isContentReady = editedClipCount >= 10;
      // Has footage but not yet edited (e.g. "about 20 rough clips")
      const hasRawButNoEdited = !isContentReady && hasRawFootage;

      // Parse rough clip count from description (e.g. "about 20 pieces" → 20)
      const roughCountMatch = rawFootageDesc.match(/\b(\d+)\b/);
      const roughClipCount = roughCountMatch ? parseInt(roughCountMatch[1]) : 10;

      // Find editor/videographer name from team members for personalized task names
      const editorMember = teamMembers?.find(m =>
        m.role?.toLowerCase().includes('edit') || m.role?.toLowerCase().includes('videograph')
      );
      const editorName = editorMember?.displayName;

      let week1Tasks: { title: string; description: string; duration: number }[];
      let week2Tasks: { title: string; description: string; duration: number }[];

      if (isContentReady) {
        const prepTasks = buildContentReadyPrepTasks(editedClipCount, hasRawFootage, editorName);
        week1Tasks = prepTasks.week1;
        week2Tasks = prepTasks.week2;
      } else if (hasRawButNoEdited) {
        // Artist has unedited footage — skip shoot day, focus on editing existing clips
        const prepTasks = buildRawFootagePrepTasks(roughClipCount, editorName);
        week1Tasks = prepTasks.week1;
        week2Tasks = prepTasks.week2;
      } else {
        // Truly content-light — needs to shoot from scratch
        const prepTasks = buildContentLightPrepTasks(editorName);
        week1Tasks = prepTasks.week1;
        week2Tasks = prepTasks.week2;
      }

      // Helper: schedule a list of tasks into available days, packing multiple tasks per day
      // Respects both daily cap (~3-4 hrs) and weekly budget
      const scheduleTasksIntoDays = (
        taskList: { title: string; description: string; duration: number }[],
        dayPool: typeof allDays,
        weekIdx: number,
        idPrefix: string,
      ) => {
        const maxMinutesPerDay = Math.min(weeklyBudgetMinutes * 0.25, 90); // 1–2 tasks per day max
        const timeUsedByDay: Record<string, number> = {};

        for (let ti = 0; ti < taskList.length; ti++) {
          const task = taskList[ti];
          // Find the first day in the pool that has capacity
          for (const day of dayPool) {
            if (timeSpentPerWeek[weekIdx] >= weeklyBudgetMinutes) break;
            const dayUsed = timeUsedByDay[day.dateStr] ?? 0;
            if (dayUsed + task.duration > maxMinutesPerDay) continue;

            const timeSlot = findFreeTimeSlot(day.date, task.duration, tasks);
            if (!timeSlot) continue;

            // Determine task type from title for color coding
            let taskType: ScheduledTask['type'] = 'prep';
            const titleLower = task.title.toLowerCase();
            if (titleLower.includes('edit') && !titleLower.includes('edit notes')) taskType = 'edit';
            else if (titleLower.includes('shoot')) taskType = 'shoot';

            tasks.push({
              id: `${idPrefix}-${ti}`,
              title: task.title,
              description: task.description,
              type: taskType,
              date: day.dateStr,
              startTime: timeSlot.start,
              endTime: timeSlot.end,
              completed: false,
            });

            timeUsedByDay[day.dateStr] = dayUsed + task.duration;
            timeSpentPerWeek[weekIdx] += task.duration;
            break; // task placed — move to next task
          }
        }
      };

      const week1Days = allDays.filter(d => d.weekNum === 0);
      const week2Days = allDays.filter(d => d.weekNum === 1);

      // Sort by actual date (ascending) so tasks start filling from today forward
      const sortedWeek1 = [...week1Days].sort((a, b) => a.date.getTime() - b.date.getTime());
      const sortedWeek2 = [...week2Days].sort((a, b) => a.date.getTime() - b.date.getTime());

      scheduleTasksIntoDays(week1Tasks, sortedWeek1, 0, 'prep-w1');
      scheduleTasksIntoDays(week2Tasks, sortedWeek2, 1, 'prep-w2');
    } // end prep phase
    
    // POSTING PHASE (Weeks 3-4): Schedule posts (shared events) + prep tasks (admin only)
    const postingTaskSet = ((artistProfile as any)?.editedClipCount ?? 0) >= 10
      ? POSTING_TASKS_READY
      : POSTING_TASKS_LIGHT;

    for (let weekNum = 2; weekNum < 8; weekNum++) {
      const weekDays = allDays.filter(d => d.weekNum === weekNum);
      const sortedDays = [...weekDays].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      let tasksScheduledThisWeek = 0;
      let prepTaskIndex = 0;
      
      // Alternate between posting and prep tasks
      for (const day of sortedDays) {
        if (timeSpentPerWeek[weekNum] >= weeklyBudgetMinutes) break;
        
        const remainingBudget = weeklyBudgetMinutes - timeSpentPerWeek[weekNum];
        
        // Determine target posts per week based on posting history (not time budget)
        let targetPostsPerWeek = 3; // Default starting point
        const currentFreq = (artistProfile as any)?.currentPostingFrequency;
        if (currentFreq === 'daily' || currentFreq === '2-3x_week') {
          targetPostsPerWeek = 3;
        } else if (currentFreq === 'weekly' || currentFreq === 'less_than_weekly' || currentFreq === 'taking a break') {
          targetPostsPerWeek = 3; // Start at 3/week even if taking a break
        }
        
        // Calculate max posts for this week (spread across 7 days)
        const maxPostsThisWeek = targetPostsPerWeek;

        // Count total posts in this week so far
        const weekStart = allDays[weekNum * 7];
        const weekEnd = allDays[Math.min(weekNum * 7 + 6, allDays.length - 1)];
        const postsThisWeek = tasks.filter(t => {
          if (!(t.type === 'audience-builder' || t.type === 'teaser' || t.type === 'promo')) return false;
          const d = t.date;
          return d >= weekStart.dateStr && d <= weekEnd.dateStr;
        }).length;

        // Don't post if this day already has a post, or if we posted yesterday (ensures ~2-day spacing)
        const prevDay = new Date(day.date.getTime() - 86400000);
        const prevDayStr = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, '0')}-${String(prevDay.getDate()).padStart(2, '0')}`;
        const postedYesterday = tasks.some(t =>
          (t.type === 'audience-builder' || t.type === 'teaser' || t.type === 'promo') && t.date === prevDayStr
        );
        const postedToday = tasks.some(t =>
          (t.type === 'audience-builder' || t.type === 'teaser' || t.type === 'promo') && t.date === day.dateStr
        );
        const shouldPost = !postedToday && !postedYesterday;

        if (shouldPost && postsThisWeek < maxPostsThisWeek && tasksScheduledThisWeek < 8) {
          // CAMPAIGN WINDOW SYSTEM: Determine post type based on release timing
          let postType: 'audience-builder' | 'teaser' | 'promo' = 'audience-builder';
          let campaignReleaseName = songName || 'your release';
          
          const releases = (artistProfile as any)?.releases || [];
          const strategyDesc = ((artistProfile as any)?.releaseStrategyDescription || '').toLowerCase();
          const postDate = new Date(day.date);
          
          console.log('[EnhancedCalendar] Post type calculation for', day.dateStr, {
            releases: releases.length,
            artistProfileExists: !!artistProfile
          });
          
          // PRIORITY 1: Check for upcoming releases within 2 weeks (TEASER PHASE)
          let upcomingRelease = null;
          for (const release of releases) {
            if (!release.releaseDate || release.releaseDate === 'TBD') continue;
            // Use local midnight to avoid timezone boundary issues
            const releaseDate = new Date(release.releaseDate + 'T00:00:00');
            const daysUntilRelease = Math.round((releaseDate.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilRelease > 0 && daysUntilRelease <= 14) {
              upcomingRelease = release;
              break; // Use the closest upcoming release
            }
          }
          
          if (upcomingRelease) {
            postType = 'teaser';
            campaignReleaseName = upcomingRelease.name || upcomingRelease.title || 'your release';
            console.log('[EnhancedCalendar] 🚨 TEASER PHASE: Release within 2 weeks:', campaignReleaseName);
          } else {
            // PRIORITY 2: Check for recent releases within 1 month (PROMO PHASE)
            let recentRelease = null;
            for (const release of releases) {
              if (!release.releaseDate || release.releaseDate === 'TBD') continue;
              const releaseDate = new Date(release.releaseDate + 'T00:00:00');
              const daysSinceRelease = Math.round((postDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysSinceRelease > 0 && daysSinceRelease <= 30) {
                recentRelease = release;
                break; // Use the most recent release
              }
            }
            
            if (recentRelease) {
              postType = 'promo';
              campaignReleaseName = recentRelease.name || recentRelease.title || 'your release';
              console.log('[EnhancedCalendar] 🎵 PROMO PHASE: Release within 1 month:', campaignReleaseName);
            } else {
              // PRIORITY 3: Check for manual override (old releases mentioned in description)
              if (strategyDesc.includes('promote') && strategyDesc.includes('bit')) {
                // "promote X a bit" = ~25% promo, 75% audience-builder
                postType = postsThisWeek % 4 === 0 ? 'promo' : 'audience-builder';
                console.log('[EnhancedCalendar] 💭 MANUAL OVERRIDE: Promote old release a bit');
              } else {
                // PRIORITY 4: Default to audience-builder
                postType = 'audience-builder';
                console.log('[EnhancedCalendar] 🌱 DEFAULT: Audience-builder');
              }
            }
          }
          
          console.log('[EnhancedCalendar] Final postType:', postType);
          
          // Post task: 30 min to post + engage
          const postDuration = 30;
          
          if (postDuration <= remainingBudget) {
            const timeSlot = findFreeTimeSlot(day.date, postDuration, tasks);
            if (timeSlot) {
              tasks.push({
                id: `post-w${weekNum + 1}-${tasksScheduledThisWeek}`,
                title: `${POST_TYPES[postType].emoji} ${postType.charAt(0).toUpperCase() + postType.slice(1).replace('-', ' ')} Post`,
                description: `${POST_TYPES[postType].description} (post + engage)`,
                type: postType,
                date: day.dateStr,
                startTime: timeSlot.start,
                endTime: timeSlot.end,
                completed: false,
                isPostEvent: true,
              });
              timeSpentPerWeek[weekNum] += postDuration;
              tasksScheduledThisWeek++;
            }
          }
        }
        
        // Fill remaining time with prep tasks for future content
        if (timeSpentPerWeek[weekNum] < weeklyBudgetMinutes && prepTaskIndex < postingTaskSet.length) {
          const prepTask = postingTaskSet[prepTaskIndex];
          const adjustedDuration = Math.min(prepTask.duration, weeklyBudgetMinutes - timeSpentPerWeek[weekNum]);
          
          if (adjustedDuration >= 30) { // Only schedule if at least 30 min
            const timeSlot = findFreeTimeSlot(day.date, adjustedDuration, tasks);
            if (timeSlot) {
              tasks.push({
                id: `prep-w${weekNum + 1}-${prepTaskIndex}`,
                title: prepTask.title,
                description: prepTask.description,
                type: 'prep',
                date: day.dateStr,
                startTime: timeSlot.start,
                endTime: timeSlot.end,
                completed: false,
              });
              timeSpentPerWeek[weekNum] += adjustedDuration;
              tasksScheduledThisWeek++;
              prepTaskIndex++;
            }
          }
        }
      }
    }
    
    console.log('[EnhancedCalendar] Time spent per week (minutes):', timeSpentPerWeek);
    console.log('[EnhancedCalendar] Time spent per week (hours):', timeSpentPerWeek.map(m => (m / 60).toFixed(1)));
    
    // ================================================================
    // BRAINSTORM CONTENT FORMAT INTEGRATION
    // ================================================================
    if (brainstormResult) {
      console.log('[EnhancedCalendar] 🧠 Applying brainstorm result:', brainstormResult.id);
      
      // 1. Update post titles with content format labels
      const postTasks = tasks.filter(t => 
        t.type === 'audience-builder' || t.type === 'teaser' || t.type === 'promo'
      );
      
      for (const assignment of brainstormResult.formatAssignments) {
        const postTask = postTasks[assignment.postIndex];
        if (postTask) {
          const FORMAT_LABELS: Record<string, string> = {
            'music_video_snippet': 'Music Video Snippet',
            'bts_performance': 'BTS Performance Shot',
            'visualizer': 'Visualizer',
            'custom': assignment.customFormatName || 'Custom',
          };
          const formatLabel = FORMAT_LABELS[assignment.format] || assignment.format;
          const postTypeLabel = postTask.type.charAt(0).toUpperCase() + postTask.type.slice(1).replace('-', ' ');
          postTask.title = `${POST_TYPES[postTask.type as keyof typeof POST_TYPES]?.emoji || '📝'} ${formatLabel} (${postTypeLabel})`;
          postTask.contentFormat = formatLabel;
          postTask.description = `${formatLabel} content — ${POST_TYPES[postTask.type as keyof typeof POST_TYPES]?.description || 'Scheduled post'}`;
        }
      }
      
      // 2. Add edit day tasks (admin view — members get these via team_tasks)
      for (const editDay of brainstormResult.editDays) {
        
        const FORMAT_LABELS: Record<string, string> = {
          'music_video_snippet': 'Music Video Snippet',
          'bts_performance': 'BTS Performance Shot',
          'visualizer': 'Visualizer',
          'custom': editDay.customFormatName || 'Custom',
        };
        const formatLabel = FORMAT_LABELS[editDay.format] || editDay.format;
        tasks.push({
          id: editDay.id,
          title: `✂️ Edit: ${formatLabel} (${editDay.postsCovered.length} posts)`,
          description: `Edit ${formatLabel} content for posts ${editDay.postsCovered.map(i => i + 1).join(', ')}`,
          type: 'edit',
          date: editDay.date,
          startTime: editDay.startTime,
          endTime: editDay.endTime,
          completed: false,
          contentFormat: formatLabel,
        });
      }
      
      // 3. Add shoot day events — shared across all team members
      for (const shootDay of brainstormResult.shootDays) {
        const FORMAT_LABELS: Record<string, string> = {
          'music_video_snippet': 'Music Video Snippet',
          'bts_performance': 'BTS Performance Shot',
          'visualizer': 'Visualizer',
          'custom': shootDay.customFormatName || 'Custom',
        };
        const formatLabel = FORMAT_LABELS[shootDay.format] || shootDay.format;
        tasks.push({
          id: shootDay.id,
          title: `📸 Shoot: ${formatLabel}`,
          description: `${shootDay.reason} — shared event with artist`,
          type: 'shoot',
          date: shootDay.date,
          startTime: shootDay.startTime,
          endTime: shootDay.endTime,
          completed: false,
          contentFormat: formatLabel,
        });
      }
    }
    
    // ================================================================
    // ADD ADMIN'S TEAM TASKS FROM SUPABASE
    // ================================================================
    if (teamTasks && teamTasks.length > 0) {
      // Separate DB events from non-event tasks
      const dbEvents = teamTasks.filter(t => t.taskCategory === 'event');

      if (dbEvents.length > 0) {
        // DB post/release events exist → remove ALL locally-generated post tasks
        // (they have fake IDs like 'post-w*' or 'release-*') and use DB-backed ones only.
        // This prevents duplicate events when the calendar has been generated before.
        const POST_TYPES_SET = new Set(['teaser', 'promo', 'audience-builder', 'release']);
        for (let i = tasks.length - 1; i >= 0; i--) {
          if (POST_TYPES_SET.has(tasks[i].type)) {
            tasks.splice(i, 1);
          }
        }

        // Add DB-backed events — deduplicate by both ID and date.
        // Multiple entries on the same date can appear if a previous bug saved duplicates;
        // keep only one per date (the most recently saved one, i.e. last in the array).
        const seenIds = new Set<string>();
        const seenDates = new Set<string>();
        // Process in reverse so we keep the last-saved event per date
        const reversedDbEvents = [...dbEvents].reverse();
        for (const tt of reversedDbEvents) {
          if (seenIds.has(tt.id)) continue;
          if (seenDates.has(tt.date)) continue; // skip duplicate date
          seenIds.add(tt.id);
          seenDates.add(tt.date);

          let calType: ScheduledTask['type'] = 'audience-builder';
          if (tt.title.toLowerCase().includes('release')) calType = 'release';
          else if (tt.title.toLowerCase().includes('teaser')) calType = 'teaser';
          else if (tt.title.toLowerCase().includes('promo')) calType = 'promo';

          tasks.push({
            id: tt.id,
            title: tt.title,
            description: tt.description || '',
            type: calType,
            date: tt.date,
            startTime: tt.startTime || '10:00',
            endTime: tt.endTime || '11:00',
            completed: tt.status === 'completed',
            isPostEvent: true,
          });
        }
      }

      // Non-event tasks assigned to the admin
      for (const tt of teamTasks) {
        if (tt.taskCategory === 'event') continue; // already handled above
        if (tasks.some(t => t.id === tt.id)) continue;
        if (tt.assignedTo && tt.assignedTo !== currentUserId) continue;

        let calType: ScheduledTask['type'] = 'prep';
        if (tt.type === 'edit') calType = 'edit';
        else if (tt.type === 'shoot') calType = 'shoot';
        else if (tt.type === 'brainstorm') calType = 'prep';
        else if (tt.type === 'invite_team') calType = 'prep';

        tasks.push({
          id: tt.id,
          title: tt.title,
          description: tt.description || '',
          type: calType,
          date: tt.date,
          startTime: tt.startTime || '09:00',
          endTime: tt.endTime || '10:00',
          completed: tt.status === 'completed',
        });
      }
    }
    
    // Build calendar days with tasks
    for (const day of allDays) {
      days.push({
        date: day.date,
        tasks: tasks.filter(t => t.date === day.dateStr),
        googleEvents: googleEvents.filter(e => {
          const eventDate = new Date(e.start).toISOString().split('T')[0];
          return eventDate === day.dateStr;
        }),
        isToday: day.weekNum === 0 && day.date.getTime() === today.getTime(),
        isPast: false,
      });
    }
    
    setScheduledTasks(tasks);
    setCalendar(days);

    // ================================================================
    // SAVE SHARED EVENTS: Notify parent of the shared events (posts + release day)
    // so they can be saved to Supabase for team members to see
    // ================================================================
    if (onSharedEventsGenerated) {
      const sharedEvents: SharedCalendarEvent[] = tasks
        .filter(t => t.type === 'audience-builder' || t.type === 'teaser' || t.type === 'promo' || t.type === 'release')
        .map(t => ({
          title: t.title,
          description: t.description,
          type: t.type as SharedCalendarEvent['type'],
          date: t.date,
          startTime: t.startTime,
          endTime: t.endTime,
        }));
      if (sharedEvents.length > 0) {
        onSharedEventsGenerated(sharedEvents);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleEvents, releaseDate, timeBudget, brainstormResult, userPermissions, currentUserId, teamTasks, teamMembers?.length]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getTaskColor = (type: string) => {
    switch (type) {
      case 'prep': return 'bg-blue-500/30 border-blue-500 text-blue-300';
      case 'audience-builder': return 'bg-green-500/30 border-green-500 text-green-300';
      case 'teaser': return 'bg-purple-500/30 border-purple-500 text-purple-300';
      case 'promo': return 'bg-yellow-500/30 border-yellow-500 text-yellow-300';
      case 'release': return 'bg-red-500/30 border-red-500 text-red-300';
      case 'edit': return 'bg-cyan-500/30 border-cyan-500 text-cyan-300';
      case 'shoot': return 'bg-orange-500/30 border-orange-500 text-orange-300';
      default: return 'bg-gray-500/30 border-gray-500 text-gray-300';
    }
  };

  // Split into weeks (8 weeks total)
  const allWeeks: typeof calendar[] = [];
  for (let i = 0; i < calendar.length; i += 7) {
    allWeeks.push(calendar.slice(i, i + 7));
  }
  // Show 4 weeks at a time based on calendarPage
  const weeks = allWeeks.slice(calendarPage * 4, calendarPage * 4 + 4);
  const totalPages = Math.ceil(allWeeks.length / 4);

  // Compute dynamic phase label based on release proximity
  const computePhaseLabel = (weekOffset: number): { label: string; color: string } => {
    if (!releaseDate || releaseDate === 'TBD') {
      return weekOffset < 2 ? { label: '📋 Prep Phase', color: 'blue' } : { label: '🚀 Posting Phase', color: 'yellow' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const release = new Date(releaseDate + 'T00:00:00');
    const daysToRelease = Math.round((release.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const weekStart = (calendarPage * 4 + weekOffset) * 7;
    const weekEnd = weekStart + 6;
    if (weekEnd < daysToRelease) return { label: '📋 Pre-release', color: 'blue' };
    if (weekStart > daysToRelease) return { label: '🚀 Post-release', color: 'yellow' };
    return { label: '🎵 Release Week', color: 'red' };
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full relative">
      {/* Google Calendar Sync Section */}
      {showGoogleSync && (
        <div className="mb-6 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium flex items-center gap-2">
                <span>📅</span> Google Calendar
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {isGoogleConnected 
                  ? `Connected • ${googleEvents.length} events synced`
                  : 'Sync to work around your existing schedule'}
              </p>
            </div>
            {!isGoogleConnected ? (
              <Button
                onClick={connectGoogle}
                disabled={isConnecting}
                className="bg-white hover:bg-gray-100 text-black font-medium"
              >
                {isConnecting ? 'Connecting...' : 'Connect Calendar'}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-sm">✓ Connected</span>
                {isFetchingEvents && (
                  <span className="text-gray-400 text-sm">Refreshing...</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Artist Info Banner */}
      <div className="mb-4 p-3 bg-gray-800/50 border border-gray-700 rounded-lg flex justify-between items-center">
        {isAdmin ? (
          <div className="flex gap-6">
            <div>
              <span className="text-xs text-gray-500">Weekly Time Budget</span>
              <p className="text-yellow-400 font-semibold">{timeBudget} hours/week</p>
            </div>
          </div>
        ) : (
          <div>
            <span className="text-xs text-gray-500">Role</span>
            <p className="text-purple-400 font-semibold">Team Member</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          {artistProfile?.hasTeam && (
            <div className="text-right">
              <span className="text-xs text-gray-500">Team</span>
              <p className="text-blue-400 text-sm">{(artistProfile as any).teamDescription || (artistProfile.teamMembers ? `${artistProfile.teamMembers.length} member(s)` : 'Has support')}</p>
            </div>
          )}
          {/* View Toggle */}
          <div className="flex border border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📅 Calendar
            </button>
            <button
              onClick={() => setViewMode('posts')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'posts'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🎬 All Posts
            </button>
          </div>
        </div>
      </div>

      {/* Phase Labels + Calendar Navigation */}
      {viewMode === 'calendar' && (
        <div className="mb-3">
          {/* Navigation row */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setCalendarPage(p => Math.max(0, p - 1))}
              disabled={calendarPage === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed bg-gray-800/50 rounded border border-gray-700 hover:border-gray-500 transition-all"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-500">
              Weeks {calendarPage * 4 + 1}–{Math.min(calendarPage * 4 + 4, allWeeks.length)}
            </span>
            <button
              onClick={() => setCalendarPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={calendarPage >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed bg-gray-800/50 rounded border border-gray-700 hover:border-gray-500 transition-all"
            >
              Next →
            </button>
          </div>
          {/* Phase label per week (admin only) */}
          {isAdmin && (
            <div className="flex gap-1">
              {weeks.map((_, wi) => {
                const { label, color } = computePhaseLabel(wi);
                const colorMap: Record<string, string> = {
                  blue: 'bg-blue-500/15 border-blue-500/40 text-blue-300',
                  yellow: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300',
                  red: 'bg-red-500/15 border-red-500/40 text-red-300',
                };
                return (
                  <div key={wi} className={`flex-1 text-center py-1 text-[11px] border rounded ${colorMap[color]}`}>
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Calendar Grid View */}
      {viewMode === 'calendar' && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {weeks.map((week, weekIndex) => {
            const globalWeekIndex = calendarPage * 4 + weekIndex;
            return (
            <div key={weekIndex} className="flex gap-1">
              {/* Week label */}
              <div className="w-16 flex items-start pt-2 justify-center text-xs text-gray-500 flex-shrink-0">
                Week {globalWeekIndex + 1}
              </div>
              
              {/* Days */}
              {week.map((day, dayIndex) => {
                const dayTasks = day.tasks;
                const dayGoogleEvents = day.googleEvents;
                const hasContent = dayTasks.length > 0 || dayGoogleEvents.length > 0;
                const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
                
                return (
                  <DroppableDay
                    key={dayIndex}
                    dateStr={dateStr}
                    day={day}
                    dayIndex={dayIndex}
                    dayTasks={dayTasks}
                    dayGoogleEvents={dayGoogleEvents}
                    hasContent={hasContent}
                    expandedTaskId={expandedTaskId}
                    setExpandedTaskId={setExpandedTaskId}
                    onTaskComplete={onTaskComplete}
                    onTimeChange={handleTimeChange}
                    formatTime={formatTime}
                    getTaskColor={getTaskColor}
                    onPostCardClick={onPostCardClick}
                    onNonPostTaskClick={onNonPostTaskClick}
                    onTaskContextMenu={onTaskContextMenu}
                  />
                );
              })}
            </div>
            );
          })}
        </div>
      )}

      {/* All Posts View — shows all post events with their status */}
      {viewMode === 'posts' && (() => {
        // Combine locally-generated post tasks with DB-backed ones
        const allPostTasks = scheduledTasks.filter(t =>
          t.type === 'audience-builder' || t.type === 'teaser' || t.type === 'promo' || t.type === 'release'
        ).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

        // Map post status from DB-backed teamTasks
        const statusMap = new Map<string, string>();
        const videoMap = new Map<string, string>();
        const captionMap = new Map<string, string>();
        if (teamTasks) {
          for (const tt of teamTasks) {
            if (tt.taskCategory === 'event') {
              statusMap.set(tt.id, (tt as any).post_status || 'pending');
              if ((tt as any).video_url) videoMap.set(tt.id, (tt as any).video_url);
              if ((tt as any).caption) captionMap.set(tt.id, (tt as any).caption);
            }
          }
        }

        const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
          brainstorming:   { label: 'Brainstorming',   color: 'bg-gray-700 border-gray-500 text-gray-300',    dot: 'bg-gray-400' },
          awaiting_shoot:  { label: 'Awaiting Shoot',  color: 'bg-yellow-900/40 border-yellow-600 text-yellow-300', dot: 'bg-yellow-400' },
          editing:         { label: 'Editing',         color: 'bg-cyan-900/40 border-cyan-600 text-cyan-300',  dot: 'bg-cyan-400' },
          finalized:       { label: 'Finalized',       color: 'bg-green-900/40 border-green-600 text-green-300', dot: 'bg-green-400' },
          pending:         { label: 'Pending',         color: 'bg-gray-800 border-gray-600 text-gray-400',     dot: 'bg-gray-500' },
        };

        const postTypeIcon: Record<string, string> = {
          'teaser': '👀',
          'promo': '🎵',
          'audience-builder': '🌱',
          'release': '🎵',
        };

        return (
          <div className="max-h-[600px] overflow-y-auto pr-2">
            <div className="mb-3 text-sm text-gray-400 flex items-center gap-2">
              <span>🎬</span>
              <span>All {allPostTasks.length} scheduled posts — click any to view or upload video</span>
            </div>
            {allPostTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-3xl mb-3">📅</div>
                <div>No posts scheduled yet.</div>
                <div className="text-xs mt-1">Posts appear here once your calendar is generated.</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {allPostTasks.map(task => {
                  const status = statusMap.get(task.id) || 'pending';
                  const hasVideo = videoMap.has(task.id);
                  const hasCaption = captionMap.has(task.id);
                  const sc = statusConfig[status] || statusConfig['pending'];
                  const postDate = new Date(task.date + 'T00:00:00');
                  const dateLabel = postDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={task.id}
                      onClick={() => onPostCardClick?.(task.id)}
                      className={`relative rounded-lg border p-2.5 cursor-pointer transition-all hover:ring-1 hover:ring-white/30 ${sc.color}`}
                    >
                      {/* Status dot */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          <span className="text-[9px] font-medium opacity-80">{sc.label}</span>
                        </div>
                        <span className="text-[9px] opacity-50">{postTypeIcon[task.type] || '📝'}</span>
                      </div>

                      {/* Post title */}
                      <div className="text-[10px] font-semibold leading-tight mb-1.5 line-clamp-2">
                        {task.title}
                      </div>

                      {/* Date */}
                      <div className="text-[9px] opacity-60 mb-1.5">{dateLabel}</div>

                      {/* Indicators */}
                      <div className="flex items-center gap-1.5">
                        {hasVideo && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-black/30 text-green-300" title="Video uploaded">
                            🎬 Video
                          </span>
                        )}
                        {hasCaption && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-black/30 text-blue-300" title="Caption written">
                            ✍️ Caption
                          </span>
                        )}
                        {!hasVideo && !hasCaption && (
                          <span className="text-[8px] opacity-40">tap to add content</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500"></div>
          <span className="text-gray-400">📋 Prep Task</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500"></div>
          <span className="text-gray-400">🌱 Audience Builder</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500"></div>
          <span className="text-gray-400">👀 Teaser</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500"></div>
          <span className="text-gray-400">🎵 Promo</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500"></div>
          <span className="text-gray-400">🎵 Release Day</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-cyan-500/30 border border-cyan-500"></div>
          <span className="text-gray-400">✂️ Edit Day</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500"></div>
          <span className="text-gray-400">📸 Shoot Day</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-700/50 border border-gray-600"></div>
          <span className="text-gray-400">📅 Your Calendar</span>
        </div>
      </div>
      
      {/* Drag Overlay - shows dragging task */}
      <DragOverlay>
        {activeTask && (
          <div className={`p-2 border rounded-lg ${getTaskColor(activeTask.type)} opacity-80 cursor-grabbing`}>
            <div className="font-semibold text-[10px]">{activeTask.title}</div>
            <div className="text-[9px] opacity-70">
              {formatTime(activeTask.startTime)} - {formatTime(activeTask.endTime)}
            </div>
          </div>
        )}
      </DragOverlay>
    </div>
    </DndContext>
  );
}

