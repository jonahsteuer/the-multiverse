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
}

// Task templates - duration in minutes
// Week 1: Ideation & initial filming (7 hours = 420 min)
const PREP_TASKS_WEEK1 = [
  { title: 'Plan content ideas', description: 'Brainstorm 5-7 post concepts for your content', duration: 90 },
  { title: 'Scout locations', description: 'Find good spots to film your content', duration: 60 },
  { title: 'Film Session 1', description: 'Capture your first batch of content', duration: 150 },
  { title: 'Review & organize', description: 'Review footage and organize files', duration: 60 },
  { title: 'Film Session 2', description: 'Capture additional shots', duration: 60 },
];

// Week 2: More filming & editing (7 hours = 420 min)
const PREP_TASKS_WEEK2 = [
  { title: 'Film Session 3', description: 'Final filming session for this batch', duration: 120 },
  { title: 'Edit batch 1 (Posts 1-3)', description: 'Edit your first 3 posts', duration: 120 },
  { title: 'Edit batch 2 (Posts 4-6)', description: 'Edit your next 3 posts', duration: 90 },
  { title: 'Finalize & caption', description: 'Final touches and write captions', duration: 60 },
  { title: 'Schedule posts', description: 'Schedule all posts for the next 2 weeks', duration: 30 },
];

// Posting weeks (3-4): Include posting + prep for future content (7 hours = 420 min)
const POSTING_TASKS = [
  { title: '🎬 Film new content', description: 'Capture content for next cycle', duration: 120, type: 'prep' },
  { title: '✂️ Quick edit', description: 'Edit and prep upcoming posts', duration: 90, type: 'prep' },
  { title: '💡 Brainstorm ideas', description: 'Plan content for future weeks', duration: 60, type: 'prep' },
  { title: '📱 Engage with audience', description: 'Respond to comments, build community', duration: 45, type: 'prep' },
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
}: {
  task: ScheduledTask;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete?: (id: string) => void;
  onTimeChange?: (taskId: string, startTime: string, endTime: string) => void;
  formatTime: (time: string) => string;
  getTaskColor: (type: string) => string;
  onPostClick?: () => void;
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
          onToggle();
        }
      }}
      className={`text-[10px] p-1.5 mb-1 border rounded cursor-grab active:cursor-grabbing transition-all ${getTaskColor(task.type)} ${
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
          <p className="text-[9px] opacity-90 mb-2">{task.description}</p>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onComplete?.(task.id);
            }}
            className="w-full h-6 text-[9px] bg-green-500/50 hover:bg-green-500/70 text-white pointer-events-auto"
          >
            {task.completed ? '✓ Completed' : 'Mark Complete'}
          </Button>
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
          // Post events open the PostDetailModal instead of expanding inline
          if (task.isPostEvent && onPostClick) {
            onPostClick();
          } else {
            onToggle();
          }
        }
      }}
      className={`p-3 mb-2 border rounded-lg transition-all ${
        task.isPostEvent ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${getTaskColor(task.type)} ${
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
          <p className="text-xs opacity-90 mb-2">{task.description}</p>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onComplete?.(task.id);
            }}
            className="w-full text-xs bg-green-500/50 hover:bg-green-500/70 text-white pointer-events-auto"
          >
            {task.completed ? '✓ Completed' : 'Mark Complete'}
          </Button>
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
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar'); // Toggle between views
  
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
    const dateStr = date.toISOString().split('T')[0];
    
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
    
    // Find first free slot between 8am and 10pm
    const workdayStart = 8; // 8am
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
      const dateStr = day.date.toISOString().split('T')[0];
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
            const dateStr = day.date.toISOString().split('T')[0];
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
        const dateStr = day.date.toISOString().split('T')[0];
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
      // Generate 28 days of calendar grid
      const allDays: { date: Date; dateStr: string; weekNum: number }[] = [];
      for (let i = 0; i < 28; i++) {
        const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        allDays.push({
          date,
          dateStr: date.toISOString().split('T')[0],
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
            startTime: tt.startTime || '09:00',
            endTime: tt.endTime || '10:00',
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
          });
          console.log('[EnhancedCalendar] Added release date:', releaseName, releaseDateStr);
        }
      }
    });
    
    // Calculate minutes per week budget
    const weeklyBudgetMinutes = timeBudget * 60;
    console.log('[EnhancedCalendar] Weekly budget:', weeklyBudgetMinutes, 'minutes =', timeBudget, 'hours');
    
    // Track time spent per week
    const timeSpentPerWeek = [0, 0, 0, 0]; // 4 weeks
    
    // First pass: generate all days
    const allDays: { date: Date; dateStr: string; weekNum: number; isPrep: boolean; dayOfWeek: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      allDays.push({
        date,
        dateStr: date.toISOString().split('T')[0],
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
      const week1Tasks = [...PREP_TASKS_WEEK1];
      const week2Tasks = [...PREP_TASKS_WEEK2];
      
      const week1Days = allDays.filter(d => d.weekNum === 0);
      const week2Days = allDays.filter(d => d.weekNum === 1);
      
      const sortedWeek1 = sortByPreference(week1Days);
      const sortedWeek2 = sortByPreference(week2Days);
      
      // Schedule Week 1 prep tasks
      let taskIndex = 0;
      for (const day of sortedWeek1) {
        if (taskIndex >= week1Tasks.length) break;
        if (timeSpentPerWeek[0] >= weeklyBudgetMinutes) break;
        
        const task = week1Tasks[taskIndex];
        const remainingBudget = weeklyBudgetMinutes - timeSpentPerWeek[0];
        
        if (task.duration <= remainingBudget || timeSpentPerWeek[0] === 0) {
          const timeSlot = findFreeTimeSlot(day.date, task.duration, tasks);
          if (timeSlot) {
            tasks.push({
              id: `prep-w1-${taskIndex}`,
              title: task.title,
              description: task.description,
              type: 'prep',
              date: day.dateStr,
              startTime: timeSlot.start,
              endTime: timeSlot.end,
              completed: false,
            });
            timeSpentPerWeek[0] += task.duration;
            taskIndex++;
          }
        }
      }
      
      // Schedule Week 2 prep tasks
      taskIndex = 0;
      for (const day of sortedWeek2) {
        if (taskIndex >= week2Tasks.length) break;
        if (timeSpentPerWeek[1] >= weeklyBudgetMinutes) break;
        
        const task = week2Tasks[taskIndex];
        const remainingBudget = weeklyBudgetMinutes - timeSpentPerWeek[1];
        
        if (task.duration <= remainingBudget || timeSpentPerWeek[1] === 0) {
          const timeSlot = findFreeTimeSlot(day.date, task.duration, tasks);
          if (timeSlot) {
            tasks.push({
              id: `prep-w2-${taskIndex}`,
              title: task.title,
              description: task.description,
              type: 'prep',
              date: day.dateStr,
              startTime: timeSlot.start,
              endTime: timeSlot.end,
              completed: false,
            });
            timeSpentPerWeek[1] += task.duration;
            taskIndex++;
          }
        }
      }
    } // end prep phase
    
    // POSTING PHASE (Weeks 3-4): Schedule posts (shared events) + prep tasks (admin only)
    for (let weekNum = 2; weekNum < 4; weekNum++) {
      const weekDays = allDays.filter(d => d.weekNum === weekNum);
      const sortedDays = sortByPreference(weekDays);
      
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
        
        // Schedule posts (not just on preferred days)
        const shouldPost = tasksScheduledThisWeek % 2 === 0 && (tasks.filter(t => t.type !== 'prep' && t.date === day.dateStr).length === 0);
        
        // Count total posts scheduled in this week so far
        const postsThisWeek = tasks.filter(t => {
          const taskWeek = Math.floor((new Date(t.date).getTime() - new Date(allDays[weekNum * 7].date).getTime()) / (1000 * 60 * 60 * 24 * 7));
          return taskWeek === 0 && (t.type === 'audience-builder' || t.type === 'teaser' || t.type === 'promo');
        }).length;
        
        if (shouldPost && postsThisWeek < maxPostsThisWeek && tasksScheduledThisWeek < 6) {
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
            const releaseDate = new Date(release.releaseDate);
            const daysUntilRelease = Math.floor((releaseDate.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
            
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
              const releaseDate = new Date(release.releaseDate);
              const daysSinceRelease = Math.floor((postDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
              
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
              });
              timeSpentPerWeek[weekNum] += postDuration;
              tasksScheduledThisWeek++;
            }
          }
        }
        
        // Fill remaining time with prep tasks for future content
        if (timeSpentPerWeek[weekNum] < weeklyBudgetMinutes && prepTaskIndex < POSTING_TASKS.length) {
          const prepTask = POSTING_TASKS[prepTaskIndex];
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
    // ADD ADMIN'S TEAM TASKS FROM SUPABASE (tasks assigned to the admin)
    // ================================================================
    if (teamTasks && teamTasks.length > 0) {
      for (const tt of teamTasks) {

        if (tt.taskCategory === 'event') {
          // Shared post/release events: replace the matching locally-generated task
          // with the real DB-backed version (real UUID, isPostEvent: true) so clicks work.
          let calType: ScheduledTask['type'] = 'audience-builder';
          if (tt.title.toLowerCase().includes('release')) calType = 'release';
          else if (tt.title.toLowerCase().includes('teaser')) calType = 'teaser';
          else if (tt.title.toLowerCase().includes('promo')) calType = 'promo';

          const dbTask: ScheduledTask = {
            id: tt.id,
            title: tt.title,
            description: tt.description || '',
            type: calType,
            date: tt.date,
            startTime: tt.startTime || '09:00',
            endTime: tt.endTime || '10:00',
            completed: tt.status === 'completed',
            isPostEvent: true,
          };

          // Find a locally-generated task on the same date with matching type to swap
          const existingIdx = tasks.findIndex(t =>
            t.date === tt.date && t.type === calType && !t.isPostEvent
          );
          if (existingIdx >= 0) {
            tasks[existingIdx] = dbTask; // Swap local → DB-backed
          } else if (!tasks.some(t => t.id === tt.id)) {
            tasks.push(dbTask); // Add if no local equivalent
          }
          continue;
        }

        // Non-event tasks assigned to the admin
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
  }, [googleEvents, releaseDate, timeBudget, preferredDays, brainstormResult, userPermissions, currentUserId, teamTasks]);

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

  // Split into weeks
  const weeks = [];
  for (let i = 0; i < calendar.length; i += 7) {
    weeks.push(calendar.slice(i, i + 7));
  }

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
            <div>
              <span className="text-xs text-gray-500">Preferred Days</span>
              <p className="text-green-400 font-semibold capitalize">{preferredDays.join(', ')}</p>
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
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📋 List
            </button>
          </div>
        </div>
      </div>

      {/* Phase Labels - only show in calendar view for admin */}
      {viewMode === 'calendar' && isAdmin && (
        <div className="flex mb-4 text-sm">
          <div className="flex-1 text-center py-2 bg-blue-500/20 border border-blue-500/50 rounded-l-lg text-blue-300">
            📋 Prep Phase (2 weeks)
          </div>
          <div className="flex-1 text-center py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-r-lg text-yellow-300">
            🚀 Posting Phase (2 weeks)
          </div>
        </div>
      )}

      {/* Calendar Grid View */}
      {viewMode === 'calendar' && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex gap-1">
              {/* Week label */}
              <div className="w-16 flex items-start pt-2 justify-center text-xs text-gray-500 flex-shrink-0">
                Week {weekIndex + 1}
              </div>
              
              {/* Days */}
              {week.map((day, dayIndex) => {
                const dayTasks = day.tasks;
                const dayGoogleEvents = day.googleEvents;
                const hasContent = dayTasks.length > 0 || dayGoogleEvents.length > 0;
                const dateStr = day.date.toISOString().split('T')[0];
                
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
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Chronological List View */}
      {viewMode === 'list' && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          <div className="mb-2 text-sm text-gray-400">
            📅 All tasks sorted by date and time (drag to reorder)
          </div>
          <SortableContext
            items={scheduledTasks.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {scheduledTasks
              .sort((a, b) => {
                // Sort by date, then by start time
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.startTime.localeCompare(b.startTime);
              })
              .map(task => (
                <SortableTask
                  key={task.id}
                  task={task}
                  isExpanded={expandedTaskId === task.id}
                  onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                  onComplete={onTaskComplete}
                  onTimeChange={handleTimeChange}
                  formatTime={formatTime}
                  getTaskColor={getTaskColor}
                />
              ))}
          </SortableContext>
        </div>
      )}

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
        {brainstormResult && (
          <>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-cyan-500/30 border border-cyan-500"></div>
              <span className="text-gray-400">✂️ Edit Day</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500"></div>
              <span className="text-gray-400">📸 Shoot Day</span>
            </div>
          </>
        )}
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

