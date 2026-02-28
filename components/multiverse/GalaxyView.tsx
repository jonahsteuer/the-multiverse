'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { connectGoogleCalendar, checkCalendarConnection } from '@/lib/google-oauth';
import dynamic from 'next/dynamic';
import type {
  Galaxy, World, Universe, ArtistProfile, BrainstormResult,
  Team, TeamTask, TeamMemberRecord, AppNotification,
} from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { NotificationBell, showToast } from './NotificationBell';
import { InviteModal } from './InviteModal';
import { TaskAssignmentDropdown } from './TaskAssignmentDropdown';
import { BrainstormReview } from './BrainstormReview';
import { MarkChatPanel } from './MarkChatPanel';
import { UploadPostsModal } from './UploadPostsModal';
import { PostDetailModal } from './PostDetailModal';
import { TaskPanel } from './TaskPanel';
import { MarkContext } from '@/lib/mark-knowledge';
import {
  createTeam as createTeamDirect,
  getTeamForUniverse,
  getTeamTasks,
  getMyTasks,
  createTask,
  updateTask,
  completeTask,
  assignTask,
  rescheduleTask,
  createTasksFromBrainstorm,
  createNotification,
  getTeamMembers,
  deleteTask,
} from '@/lib/team';
import { supabase } from '@/lib/supabase';
import { clearAllData } from '@/lib/storage';

// Dynamically import Galaxy3DWrapper to prevent Next.js from analyzing Three.js during compilation
const Galaxy3DWrapper = dynamic(
  () => import('./Galaxy3DWrapper').then(mod => ({ default: mod.Galaxy3DWrapper })),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-black relative flex items-center justify-center">
        <div className="text-yellow-400 font-star-wars text-xl">Loading 3D view...</div>
      </div>
    )
  }
);

const WorldCreationForm = dynamic(
  () => import('./WorldCreationForm').then(mod => ({ default: mod.WorldCreationForm })),
  { ssr: false }
);

const WorldDetailView = dynamic(
  () => import('./WorldDetailView').then(mod => ({ default: mod.WorldDetailView })),
  { ssr: false }
);

const EnhancedCalendar = dynamic(
  () => import('./EnhancedCalendar').then(mod => ({ default: mod.EnhancedCalendar })),
  { ssr: false }
);

const BrainstormContent = dynamic(
  () => import('./BrainstormContent').then(mod => ({ default: mod.BrainstormContent })),
  { ssr: false }
);

interface GalaxyViewProps {
  galaxy: Galaxy;
  universe: Universe;
  artistProfile?: ArtistProfile;
  onUpdateWorld?: (worldData: Partial<World>) => void;
  onDeleteGalaxy?: () => void;
  onDeleteWorld?: (worldId: string) => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => void;
  // Multi-galaxy navigation
  allGalaxies?: import('@/types').GalaxyEntry[];
  activeGalaxyIndex?: number;
  onSwitchGalaxy?: (index: number) => void;
}

export function GalaxyView({ galaxy, universe, artistProfile, onUpdateWorld, onDeleteGalaxy, onDeleteWorld, onSignOut, onDeleteAccount, allGalaxies, activeGalaxyIndex, onSwitchGalaxy }: GalaxyViewProps) {
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [showWorldForm, setShowWorldForm] = useState(false);
  const [showWorldDetail, setShowWorldDetail] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [brainstormResult, setBrainstormResult] = useState<BrainstormResult | null>(null);
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false);

  // Team collaboration state
  const [team, setTeam] = useState<Team | null>(null);
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = not yet determined
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [showBrainstormReview, setShowBrainstormReview] = useState(false);
  const [pendingBrainstormReview, setPendingBrainstormReview] = useState<BrainstormResult | null>(null);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showMarkChat, setShowMarkChat] = useState(false);
  const [adminArtistProfile, setAdminArtistProfile] = useState<ArtistProfile | null>(null);
  const [taskContextMenu, setTaskContextMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [showUploadPosts, setShowUploadPosts] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [isCheckingInstagram, setIsCheckingInstagram] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedTaskForPanel, setSelectedTaskForPanel] = useState<TeamTask | null>(null);

  // Check Google Calendar connection status when calendar modal opens
  useEffect(() => {
    if (showCalendar) {
      checkCalendarConnection().then(setIsGoogleCalendarConnected);
    }
  }, [showCalendar]);

  // Check Instagram connection status when profile panel opens
  useEffect(() => {
    if (showProfilePanel && isAdmin) {
      fetch('/api/instagram/status')
        .then(r => r.json())
        .then(data => setIsInstagramConnected(data.connected === true))
        .catch(() => setIsInstagramConnected(false));
    }
  }, [showProfilePanel, isAdmin]);

  // Load team data
  useEffect(() => {
    loadTeamData();
  }, [universe.id]);

  // Load admin's artist profile for team members (so they see the same calendar)
  // ALWAYS load for non-admin users — they need the admin's profile for post types & release dates
  useEffect(() => {
    if (isAdmin === false && universe.creatorId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('onboarding_profile')
            .eq('id', universe.creatorId)
            .single();
          if (error) {
            console.warn('[GalaxyView] Could not load admin profile (RLS?):', error.message);
            return;
          }
          if (data?.onboarding_profile) {
            console.log('[GalaxyView] ✅ Loaded admin artist profile for team member calendar');
            setAdminArtistProfile(data.onboarding_profile as ArtistProfile);
          } else {
            console.warn('[GalaxyView] Admin profile exists but has no onboarding_profile');
          }
        } catch (err) {
          console.warn('[GalaxyView] Could not load admin profile:', err);
        }
      })();
    }
  }, [isAdmin, universe.creatorId]);

  // Load stored brainstorm result from Supabase on mount
  useEffect(() => {
    if (!brainstormResult && galaxy.id) {
      (async () => {
        try {
          const { data } = await supabase
            .from('galaxies')
            .select('brainstorm_result')
            .eq('id', galaxy.id)
            .single();
          if (data?.brainstorm_result) {
            console.log('[GalaxyView] Loaded brainstorm result from Supabase');
            setBrainstormResult(data.brainstorm_result as BrainstormResult);
          }
        } catch (err) {
          // Column may not exist yet, that's fine
        }
      })();
    }
  }, [galaxy.id]);

  const loadTeamData = useCallback(async () => {
    try {
      // Get current user (client-side — has session in localStorage)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email || null);
      }

      // Load team for this universe (direct Supabase call, not API route)
      const teamData = await getTeamForUniverse(universe.id);
      if (teamData) {
        setTeam(teamData);

        // Determine admin status from team membership
        const members: TeamMemberRecord[] = teamData.members || [];
        setTeamMembers(members);
        let userIsAdmin = false;
        if (user) {
          const myMember = members.find(m => m.userId === user.id);
          // Full-permission member → admin
          // Fall back to universe ownership in case the member record hasn't
          // been written yet (e.g. right after ensureTeam creates the team)
          userIsAdmin = myMember?.permissions === 'full' || universe.creatorId === user.id;
          setIsAdmin(userIsAdmin);
        }

        // Load tasks (direct Supabase call)
        const tasks = userIsAdmin
          ? await getTeamTasks(teamData.id)
          : await getMyTasks(teamData.id);
        setTeamTasks(tasks);
      } else {
        // No team found — determine admin status by universe ownership
        if (user) {
          const ownsUniverse = universe.creatorId === user.id;
          console.log('[GalaxyView] No team found. User owns universe:', ownsUniverse);
          setIsAdmin(ownsUniverse);
        } else {
          setIsAdmin(false);
        }
      }
    } catch (err) {
      // Team system not set up yet — determine admin by universe ownership
      console.log('[GalaxyView] Team system not loaded (may not be set up yet)', err);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          setCurrentUserEmail(user.email || null);
          setIsAdmin(universe.creatorId === user.id);
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      }
    }
  }, [universe.id, universe.creatorId]);

  const handleWorldClick = (world: World) => {
    if (world.name && world.name !== 'Unnamed World') {
      setSelectedWorld(world);
      setShowWorldDetail(true);
    } else {
      setSelectedWorld(world);
      setShowWorldForm(true);
    }
  };

  const handleWorldCreated = (worldData: Partial<World>) => {
    setShowWorldForm(false);
    setSelectedWorld(null);
    if (onUpdateWorld) {
      onUpdateWorld(worldData);
    }
  };

  const handleWorldUpdate = (updatedWorld: World) => {
    if (onUpdateWorld) {
      onUpdateWorld(updatedWorld);
    }
    setShowWorldDetail(false);
    setSelectedWorld(null);
  };

  const handleWorldDelete = async (worldId: string) => {
    console.log('[GalaxyView] handleWorldDelete called for world:', worldId);
    if (onDeleteWorld) {
      await onDeleteWorld(worldId);
    }
    setShowWorldDetail(false);
    setSelectedWorld(null);
  };

  const handleBrainstormComplete = async (result: BrainstormResult) => {
    console.log('[GalaxyView] Brainstorm completed:', result);
    setBrainstormResult(result);
    setShowBrainstorm(false);

    // Create tasks from brainstorm result if team exists
    if (team) {
      try {
        await createTasksFromBrainstorm(team.id, galaxy.id, result);

        // Mark the brainstorm task as completed
        const brainstormTask = teamTasks.find(t => t.type === 'brainstorm' && t.galaxyId === galaxy.id);
        if (brainstormTask) {
          await completeTask(brainstormTask.id);
        }

        // Store the brainstorm result in Supabase (galaxy metadata)
        try {
          await supabase
            .from('galaxies')
            .update({ brainstorm_result: result })
            .eq('id', galaxy.id);
          console.log('[GalaxyView] Brainstorm result saved to galaxy');
        } catch (saveErr) {
          console.warn('[GalaxyView] Could not save brainstorm result to galaxy:', saveErr);
        }

        // Send brainstorm_completed notification to all admins
        const members = await getTeamMembers(team.id);
        const admins = members.filter(m => m.permissions === 'full' && m.userId !== currentUserId);
        for (const admin of admins) {
          await createNotification(
            admin.userId,
            team.id,
            'brainstorm_completed',
            'Content brainstorm completed!',
            `Content formats have been chosen for ${galaxy.name}. Tap to review.`,
            {
              galaxyId: galaxy.id,
              galaxyName: galaxy.name,
              formatCount: result.formatAssignments.length,
              editDays: result.editDays.length,
              shootDays: result.shootDays.length,
            }
          );
        }

        // Reload tasks
        loadTeamData();
      } catch (err) {
        console.error('[GalaxyView] Error creating tasks from brainstorm:', err);
      }
    }
  };

  /** Ensure a team exists — creates one on-demand if needed */
  const ensureTeam = async (): Promise<Team | null> => {
    if (team) return team;
    setIsCreatingTeam(true);
    try {
      const teamName = `${galaxy.name}'s Team`;
      console.log('[GalaxyView] Creating team:', teamName);
      const newTeam = await createTeamDirect(universe.id, teamName);
      if (newTeam) {
        console.log('[GalaxyView] Team created:', newTeam.id);
        setTeam(newTeam);
        await loadTeamData();
        return newTeam;
      } else {
        console.error('[GalaxyView] createTeam returned null');
      }
    } catch (err) {
      console.error('[GalaxyView] Error creating team:', err);
    } finally {
      setIsCreatingTeam(false);
    }
    return null;
  };

  /** Handle opening the invite modal — auto-creates team if needed */
  const handleOpenInviteModal = async () => {
    const t = await ensureTeam();
    if (t) {
      setShowInviteModal(true);
    }
  };

  const handleTaskClick = async (task: TeamTask) => {
    // Invite tasks: open invite modal directly
    if (task.type === 'invite_team') {
      await handleOpenInviteModal();
      if (team && task.id && !task.id.startsWith('default-')) {
        await completeTask(task.id);
        loadTeamData();
      }
      return;
    }
    // All other tasks open the TaskPanel (brainstorm, prep, edit, review, etc.)
    setSelectedTaskForPanel(task);
  };

  const handleAssignTask = (taskId: string) => {
    setAssigningTaskId(taskId);
  };

  const handleTaskAssigned = (taskId: string, userId: string) => {
    setAssigningTaskId(null);
    loadTeamData();
  };

  // Handle context menu assignment — assigns a task to a team member
  // Works for both todo list tasks and calendar tasks
  const handleContextMenuAssign = async (memberId: string) => {
    if (!taskContextMenu || !team) return;
    setTaskContextMenu(null);

    // Check if this is a calendar task that already exists in the DB
    const calendarTask = teamTasks.find(t => t.id === taskContextMenu.taskId);
    if (calendarTask) {
      await assignTask(calendarTask.id, memberId, team.id);
      try {
        await createNotification(memberId, team.id, 'task_assigned',
          `New task: ${calendarTask.title}`,
          `You've been assigned "${calendarTask.title}".`,
          { taskId: calendarTask.id, taskTitle: calendarTask.title }
        );
      } catch (e) { console.warn('[Team] Notification failed:', e); }
      loadTeamData();
      return;
    }

    const task = displayTasks.find(t => t.id === taskContextMenu.taskId);
    if (!task) {
      console.warn('[GalaxyView] Cannot assign task — not found in todo list or DB. Save events first.');
      return;
    }

    try {
      // If it's a default (unsaved) task, create it in Supabase first
      let realTaskId = task.id;
      if (task.id.startsWith('default-')) {
        // Calculate the assigned member's soonest available time
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const pad = (n: number) => n.toString().padStart(2, '0');
        const h = Math.max(now.getHours(), 9); // At least 9 AM
        const m = now.getMinutes();

        const newTask = await createTask(team.id, {
          galaxyId: galaxy.id,
          title: task.title,
          description: task.description || '',
          type: task.type as any,
          taskCategory: 'task',
          date: todayStr,
          startTime: `${pad(h)}:${pad(m)}`,
          endTime: `${pad(h + 1)}:${pad(m)}`,
          assignedTo: memberId,
        });
        if (newTask) {
          realTaskId = newTask.id;
          // Send notification to the assignee (non-blocking)
          try {
            await createNotification(
              memberId,
              team.id,
              'task_assigned',
              `New task: ${task.title}`,
              `You've been assigned "${task.title}".`,
              { taskId: realTaskId, taskTitle: task.title }
            );
          } catch (e) {
            console.warn('[Team] Notification creation failed (non-blocking):', e);
          }
        }
      } else {
        // Existing task — just reassign
        await assignTask(realTaskId, memberId, team.id);
      }

      // Reload team data to reflect changes
      loadTeamData();
    } catch (err) {
      console.error('[GalaxyView] Error assigning task:', err);
    }
  };

  const handleBrainstormReviewApprove = async () => {
    if (!pendingBrainstormReview) return;
    // Just close the review — it's already been applied
    setPendingBrainstormReview(null);
    setShowBrainstormReview(false);
  };

  const handleBrainstormSendBack = async (notes: string) => {
    if (!pendingBrainstormReview || !team) return;

    // Create a "Revise Content Plan" task for the original assignee
    const assignee = pendingBrainstormReview.completedBy;
    if (assignee) {
      const now = new Date();
      await createTask(team.id, {
        galaxyId: galaxy.id,
        title: 'Revise Content Plan',
        description: notes,
        type: 'brainstorm',
        taskCategory: 'task',
        date: now.toISOString().split('T')[0],
        startTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
        endTime: `${now.getHours().toString().padStart(2, '0')}:${Math.min(now.getMinutes() + 30, 59).toString().padStart(2, '0')}`,
        assignedTo: assignee,
      });
    }

    // Clear the brainstorm result so it can be redone
    setBrainstormResult(null);
    setPendingBrainstormReview(null);
    setShowBrainstormReview(false);
    loadTeamData();
  };

  const handleNotificationClick = (notification: AppNotification) => {
    // Handle notification actions
    if (notification.type === 'brainstorm_completed' && brainstormResult) {
      setPendingBrainstormReview(brainstormResult);
      setShowBrainstormReview(true);
    }
  };

  const handleTaskReschedule = async (taskId: string, newDate: string, startTime: string, endTime: string) => {
    if (!team) return;
    try {
      await rescheduleTask(taskId, newDate, startTime, endTime, team.id);
      loadTeamData();
    } catch (err) {
      console.error('[GalaxyView] Error rescheduling task:', err);
    }
  };

  // Treat "loading" (null) as non-admin — safe default
  const effectiveIsAdmin = isAdmin === null ? false : isAdmin;

  // Save shared events (posts + release day) to Supabase so team members can see them
  const sharedEventsSavedRef = useRef(false); // prevent duplicate saves
  const handleSharedEventsGenerated = useCallback(async (events: { title: string; description: string; type: string; date: string; startTime: string; endTime: string }[]) => {
    if (!team || !effectiveIsAdmin || sharedEventsSavedRef.current) return;
    sharedEventsSavedRef.current = true;

    const existingEvents = teamTasks.filter(t => t.taskCategory === 'event' && t.galaxyId === galaxy.id);

    // Deduplicate existing DB events: if multiple events share the same date, keep
    // the first and delete the rest. This repairs duplicates from previous bugs.
    const keptByDate = new Map<string, string>(); // date → id of event to keep
    const toDelete: string[] = [];
    for (const ev of existingEvents) {
      if (keptByDate.has(ev.date)) {
        toDelete.push(ev.id); // duplicate — mark for deletion
      } else {
        keptByDate.set(ev.date, ev.id);
      }
    }
    if (toDelete.length > 0) {
      console.log('[GalaxyView] 🗑 Removing', toDelete.length, 'duplicate events...');
      await Promise.allSettled(toDelete.map(id => deleteTask(id)));
    }

    // Build a map of currently kept events by date (after dedup)
    const existingByDate = new Map(
      existingEvents
        .filter(e => keptByDate.get(e.date) === e.id)
        .map(e => [e.date, e])
    );

    // Only create events for dates that don't already have one (idempotent inserts)
    const toCreate = events.filter(e => !existingByDate.has(e.date));
    if (toCreate.length === 0 && toDelete.length === 0) {
      console.log('[GalaxyView] Shared events up to date — nothing to save');
      return;
    }

    try {
      console.log('[GalaxyView] 📤 Creating', toCreate.length, 'new shared events...');
      for (const event of toCreate) {
        await createTask(team.id, {
          galaxyId: galaxy.id,
          title: event.title,
          description: event.description,
          type: event.type === 'release' ? 'release' : 'post' as any,
          taskCategory: 'event',
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
        });
      }
      console.log('[GalaxyView] ✅ Shared events saved');
      loadTeamData();
    } catch (err) {
      console.error('[GalaxyView] Error saving shared events:', err);
      sharedEventsSavedRef.current = false;
    }
  }, [team, effectiveIsAdmin, teamTasks, galaxy.id]);

  // Build display tasks — use real team tasks if available, else generate defaults
  // IMPORTANT: Only admin users see default tasks. Invited members only see tasks assigned to them.
  // Tasks assigned to other users are HIDDEN from the current user's todo list.
  const displayTasks: TeamTask[] = (() => {
    // Filter real tasks: hide calendar events and tasks assigned to others
    const realTasks = teamTasks.filter(t => {
      // Events (posts, release day) are CALENDAR-ONLY, never show in todo list
      if (t.taskCategory === 'event') return false;
      // Tasks assigned to someone else → hide from this user's todo
      if (t.assignedTo && t.assignedTo !== currentUserId) return false;
      // Unassigned tasks → only visible to admin
      if (!t.assignedTo) return effectiveIsAdmin;
      // Task assigned to current user → show
      return true;
    });

    if (realTasks.length > 0) {
      return realTasks;
    }
    // If not admin (invited user) or still determining, show nothing
    if (!effectiveIsAdmin) return [];
    // Admin with no tasks yet — show default tasks based on their profile
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const h = now.getHours();
    const m = now.getMinutes();
    const editedClipCount = (artistProfile as any)?.editedClipCount ?? 0;
    const rawFootageDesc: string = (artistProfile as any)?.rawFootageDescription || '';
    const hasRawFootage = rawFootageDesc.length > 0;
    const isContentReady = editedClipCount >= 10;
    const hasRawButNoEdited = !isContentReady && hasRawFootage;

    // Parse rough clip count from description
    const roughCountMatch = rawFootageDesc.match(/\b(\d+)\b/);
    const roughClipCount = roughCountMatch ? parseInt(roughCountMatch[1]) : 10;

    // Find editor/videographer name for personalised task descriptions
    const editorMember = teamMembers.find(m =>
      m.role?.toLowerCase().includes('edit') || m.role?.toLowerCase().includes('videograph')
    );
    const editorName = editorMember?.displayName;

    // Default scheduling starts at 10am
    const makeTime = (offsetMinutes: number) => {
      const total = 10 * 60 + offsetMinutes; // anchor at 10:00am
      return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
    };

    const defaultTasks: TeamTask[] = [
      {
        id: 'default-invite',
        teamId: '',
        galaxyId: galaxy.id,
        title: 'Invite team members',
        description: 'Add your collaborators so they can see the calendar and pick up tasks.',
        type: 'invite_team' as const,
        taskCategory: 'task' as const,
        date: todayStr,
        startTime: makeTime(0),
        endTime: makeTime(15),
        status: 'pending' as const,
        assignedBy: '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ];

    if (isContentReady) {
      // Content-ready flow: upload → send notes → finalize
      defaultTasks.push({
        id: 'default-upload',
        teamId: '',
        galaxyId: galaxy.id,
        title: `Upload post edits 1–10 (est. 30 min)`,
        description: `You have ${editedClipCount} edited clips ready. Link the first 10 to their scheduled post slots in the calendar.`,
        type: 'prep' as const,
        taskCategory: 'task' as const,
        date: todayStr,
        startTime: makeTime(20),
        endTime: makeTime(50),
        status: 'pending' as const,
        assignedBy: '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      if (editorName) {
        defaultTasks.push({
          id: 'default-send-notes',
          teamId: '',
          galaxyId: galaxy.id,
          title: `Send edit notes to ${editorName} (est. 20 min)`,
          description: `Review each uploaded clip. Write revision notes on any that need work. Hit "No more notes" when done — the rest will be queued for finalizing.`,
          type: 'prep' as const,
          taskCategory: 'task' as const,
          date: todayStr,
          startTime: makeTime(55),
          endTime: makeTime(75),
          status: 'pending' as const,
          assignedBy: '',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      }
      defaultTasks.push({
        id: 'default-finalize',
        teamId: '',
        galaxyId: galaxy.id,
        title: `Finalize posts (est. 25 min)`,
        description: editorName
          ? `Posts you didn't send back to ${editorName} are ready. Write captions and confirm scheduling.`
          : `Do a final pass on your uploaded posts. Write captions, add hashtags, and confirm scheduling.`,
        type: 'prep' as const,
        taskCategory: 'task' as const,
        date: todayStr,
        startTime: makeTime(80),
        endTime: makeTime(105),
        status: 'pending' as const,
        assignedBy: '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    } else if (hasRawButNoEdited) {
      // Has raw footage — no shoot needed, focus on reviewing + sending to editor
      const batchOne = Math.min(10, roughClipCount);
      defaultTasks.push({
        id: 'default-review-footage',
        teamId: '',
        galaxyId: galaxy.id,
        title: `Review & organize existing footage (est. 45 min)`,
        description: `Go through your ${roughClipCount} rough clips. Pick the ${batchOne} strongest and flag any that need specific edit notes.`,
        type: 'prep' as const,
        taskCategory: 'task' as const,
        date: todayStr,
        startTime: makeTime(20),
        endTime: makeTime(65),
        status: 'pending' as const,
        assignedBy: '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      defaultTasks.push({
        id: 'default-send-footage',
        teamId: '',
        galaxyId: galaxy.id,
        title: editorName
          ? `Send first batch to ${editorName} for editing (est. 20 min)`
          : `Edit first batch of posts (est. 90 min)`,
        description: editorName
          ? `Forward your top ${batchOne} clips to ${editorName} with any notes on cuts, color, or vibe. Include the target post dates.`
          : `Cut your top ${batchOne} rough clips into 15–30 second post-ready videos.`,
        type: 'prep' as const,
        taskCategory: 'task' as const,
        date: todayStr,
        startTime: makeTime(70),
        endTime: makeTime(90),
        status: 'pending' as const,
        assignedBy: '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    } else {
      // Content-light flow: brainstorm → plan shoot
      defaultTasks.push({
        id: 'default-brainstorm',
        teamId: '',
        galaxyId: galaxy.id,
        title: 'Brainstorm content ideas (est. 45 min)',
        description: 'Come up with 6–10 post concepts for your release. Think hooks, settings, and what fits your sound.',
        type: 'brainstorm' as const,
        taskCategory: 'task' as const,
        date: todayStr,
        startTime: makeTime(20),
        endTime: makeTime(65),
        status: brainstormResult ? 'completed' as const : 'pending' as const,
        assignedBy: '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      defaultTasks.push({
        id: 'default-plan-shoot',
        teamId: '',
        galaxyId: galaxy.id,
        title: editorName ? `Plan shoot day with ${editorName} (est. 30 min)` : 'Plan shoot day (est. 30 min)',
        description: editorName
          ? `Set a shoot date with ${editorName}. Agree on locations, outfits, and shot list based on your brainstorm.`
          : 'Map out your shoot day: locations, outfits, shot list. Block off the time on your calendar.',
        type: 'prep' as const,
        taskCategory: 'task' as const,
        date: todayStr,
        startTime: makeTime(70),
        endTime: makeTime(100),
        status: 'pending' as const,
        assignedBy: '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }

    return defaultTasks;
  })();

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 3D Galaxy View */}
      <Galaxy3DWrapper
        key={`galaxy-${galaxy.id}-${galaxy.worlds.length}`}
        galaxy={galaxy}
        onWorldClick={handleWorldClick}
        showGalaxyNav={(allGalaxies?.length ?? 0) > 1}
        onPrevGalaxy={() => {
          if (!allGalaxies || !onSwitchGalaxy) return;
          const prev = ((activeGalaxyIndex ?? 0) - 1 + allGalaxies.length) % allGalaxies.length;
          onSwitchGalaxy(prev);
        }}
        onNextGalaxy={() => {
          if (!allGalaxies || !onSwitchGalaxy) return;
          const next = ((activeGalaxyIndex ?? 0) + 1) % allGalaxies.length;
          onSwitchGalaxy(next);
        }}
        distantGalaxies={
          allGalaxies && allGalaxies.length > 1
            ? allGalaxies
                .filter((_, i) => i !== (activeGalaxyIndex ?? 0))
                .map((entry, i) => ({
                  galaxy: entry.galaxy,
                  artistName: entry.artistName,
                  index: allGalaxies.findIndex(e => e.galaxy.id === entry.galaxy.id),
                  onSwitch: () => onSwitchGalaxy?.(allGalaxies.findIndex(e => e.galaxy.id === entry.galaxy.id)),
                }))
            : undefined
        }
      />

      {/* Info Panel (top-left) — compact action buttons only */}
      <div className="absolute top-4 left-4 z-10 bg-black/80 border border-yellow-500/30 rounded-lg p-4 max-w-[260px]">
        <p className="text-xs text-gray-500 mb-3">
          Click on a world to view timeline, shoot days, and calendar sync
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setShowCalendar(true)}
              className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars font-bold rounded text-sm"
            >
              View Calendar
            </button>
            {onDeleteGalaxy && (
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await onDeleteGalaxy();
                }}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-star-wars font-bold rounded text-sm"
                title={`Erase Galaxy "${galaxy.name}"`}
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Centered Todo List — below the galaxy title */}
      <div className="absolute top-[160px] left-1/2 transform -translate-x-1/2 z-10 w-full max-w-sm px-4">
        <div className="bg-black/85 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-4">
          {/* Todo List Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-yellow-500/20">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-star-wars text-yellow-400 uppercase tracking-wider">Todo List</h3>
            <span className="text-xs text-gray-500 ml-auto">
              {displayTasks.filter(t => t.status !== 'completed').length} remaining
            </span>
          </div>

          {/* Todo Items */}
          <div className="space-y-1">
            {displayTasks
              .filter(t => t.status !== 'completed')
              .map((task) => {
                const isInvite = task.type === 'invite_team';
                const isBrainstorm = task.type === 'brainstorm';
                const emoji = isInvite ? '👥' : isBrainstorm ? '🧠' : '✨';
                return (
                  <button
                    key={task.id}
                    onClick={() => {
                      if (isInvite) handleOpenInviteModal();
                      else handleTaskClick(task);
                    }}
                    onContextMenu={(e) => {
                      if (effectiveIsAdmin && teamMembers.length > 0) {
                        e.preventDefault();
                        setTaskContextMenu({ taskId: task.id, x: e.clientX, y: e.clientY });
                      }
                    }}
                    disabled={isCreatingTeam && isInvite}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-all group text-left"
                  >
                    {/* Checkbox circle */}
                    <div className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-600 group-hover:border-yellow-400 transition-colors" />

                    {/* Emoji + Title */}
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="text-sm">{emoji}</span>
                      <span className="text-sm text-white truncate">
                        {isCreatingTeam && isInvite ? 'Setting up...' : task.title}
                      </span>
                    </div>

                    {/* Duration estimate */}
                    <span className="flex-shrink-0 text-[11px] text-gray-500 font-mono">
                      {task.startTime && task.endTime ? (() => {
                        const [sh, sm] = task.startTime.split(':').map(Number);
                        const [eh, em] = task.endTime.split(':').map(Number);
                        const mins = (eh * 60 + em) - (sh * 60 + sm);
                        return mins > 0 ? `est. ${mins}m` : '';
                      })() : ''}
                    </span>
                  </button>
                );
              })}

            {/* All done / empty state */}
            {displayTasks.filter(t => t.status !== 'completed').length === 0 && (
              <div className="text-center py-3 text-gray-500 text-sm">
                {!effectiveIsAdmin && displayTasks.length === 0 
                  ? 'No tasks assigned yet — your admin will add tasks for you'
                  : 'All caught up ✨'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right-click Context Menu for Task Assignment */}
      {taskContextMenu && (
        <>
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setTaskContextMenu(null)}
          />
          <div 
            className="fixed z-[101] bg-gray-900 border border-yellow-500/30 rounded-lg shadow-xl py-1 min-w-[200px]"
            style={{ left: taskContextMenu.x, top: taskContextMenu.y }}
          >
            <div className="px-3 py-2 border-b border-gray-700">
              <p className="text-xs text-gray-400 font-star-wars">Assign to</p>
            </div>
            {teamMembers
              .filter(m => m.userId !== currentUserId) // Don't show self
              .map((member) => (
                <button
                  key={member.userId}
                  onClick={() => handleContextMenuAssign(member.userId)}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-yellow-500/10 flex items-center gap-2 transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-300">
                    {member.displayName?.[0]?.toUpperCase() || '?'}
                  </span>
                  <span>{member.displayName || 'Team Member'}</span>
                  <span className="text-xs text-gray-500 ml-auto">{member.role}</span>
                </button>
              ))}
            {teamMembers.filter(m => m.userId !== currentUserId).length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">
                No team members to assign to. Invite someone first!
              </div>
            )}
          </div>
        </>
      )}

      {/* Top Right: Profile + Notifications + Call Mark */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Call Mark Button */}
        <div className="bg-black/80 border border-yellow-500/30 rounded-lg p-1">
          <button
            onClick={() => setShowMarkChat(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
            title="Call Mark"
          >
            <span className="text-xl">💬</span>
            <span className="text-xs text-yellow-400 font-star-wars hidden sm:block">CALL MARK</span>
          </button>
        </div>

        {/* Notification Bell */}
        {currentUserId && (
          <div className="bg-black/80 border border-yellow-500/30 rounded-lg p-1">
            <NotificationBell
              userId={currentUserId}
              onNotificationClick={handleNotificationClick}
            />
          </div>
        )}

        {/* Profile Button */}
        <div className="bg-black/80 border border-yellow-500/30 rounded-lg p-1">
          <button
            onClick={() => setShowProfilePanel(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
            title="Profile"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {(artistProfile as any)?.creatorName?.[0]?.toUpperCase() 
                || teamMembers.find(m => m.userId === currentUserId)?.displayName?.[0]?.toUpperCase()
                || '?'}
            </div>
          </button>
        </div>
      </div>

      {/* Profile Side Panel */}
      {showProfilePanel && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-50" 
            onClick={() => setShowProfilePanel(false)}
          />
          <div className="fixed top-0 right-0 h-full w-80 bg-gray-900/95 border-l border-purple-500/20 z-[51] shadow-2xl shadow-black/50 flex flex-col animate-slide-in-right">
            {/* Panel Header */}
            <div className="p-6 border-b border-gray-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-star-wars text-white">Profile</h2>
                <button
                  onClick={() => setShowProfilePanel(false)}
                  className="text-gray-400 hover:text-white transition-colors text-xl"
                >
                  ✕
                </button>
              </div>

              {/* User Avatar & Info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {(artistProfile as any)?.creatorName?.[0]?.toUpperCase() 
                    || teamMembers.find(m => m.userId === currentUserId)?.displayName?.[0]?.toUpperCase()
                    || '?'}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-medium truncate">
                    {teamMembers.find(m => m.userId === currentUserId)?.displayName
                      || (artistProfile as any)?.creatorName
                      || 'User'}
                  </div>
                  <div className="text-gray-400 text-sm truncate">
                    {currentUserEmail || ''}
                  </div>
                  {!effectiveIsAdmin && (
                    <div className="text-purple-400 text-xs mt-0.5 flex items-center gap-1">
                      <span>👤</span>
                      <span>{teamMembers.find(m => m.userId === currentUserId)?.role || 'Team Member'}</span>
                    </div>
                  )}
                  {effectiveIsAdmin && (
                    <div className="text-yellow-400 text-xs mt-0.5 flex items-center gap-1">
                      <span>⭐</span>
                      <span>Admin</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel Body */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Team Info */}
              {team && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Team</h3>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">{team.name}</div>
                    <div className="text-gray-400 text-xs mt-1">
                      {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Team Members List */}
              {teamMembers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Team Members</h3>
                  <div className="space-y-2">
                    {teamMembers.map((member) => {
                      const isCurrentUser = member.userId === currentUserId;
                      const isAdminMember = member.permissions === 'full';
                      const initial = (member.displayName?.[0] || '?').toUpperCase();
                      return (
                        <div key={member.id} className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                            isAdminMember ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : 'bg-gradient-to-br from-purple-500 to-blue-500'
                          }`}>
                            {initial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-medium truncate flex items-center gap-1.5">
                              {member.displayName || 'Unknown'}
                              {isCurrentUser && <span className="text-gray-500 text-xs">(you)</span>}
                            </div>
                            <div className="text-gray-500 text-xs truncate">
                              {isAdminMember ? '⭐ Admin' : `👤 ${member.role || 'Member'}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Invite Team Members button (admin only) */}
                  {effectiveIsAdmin && (
                    <button
                      onClick={() => {
                        setShowProfilePanel(false);
                        handleOpenInviteModal();
                      }}
                      className="mt-3 w-full px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span>➕</span>
                      <span>Invite Team Members</span>
                    </button>
                  )}
                </div>
              )}

              {/* Connections (admin only) */}
              {effectiveIsAdmin && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Connections</h3>
                  <div className="space-y-2">
                    {/* Google Calendar */}
                    <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📅</span>
                        <span className="text-sm text-white">Google Calendar</span>
                      </div>
                      {isGoogleCalendarConnected ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                          Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => connectGoogleCalendar()}
                          className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                        >
                          Connect →
                        </button>
                      )}
                    </div>
                    {/* Instagram */}
                    <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📸</span>
                        <span className="text-sm text-white">Instagram</span>
                      </div>
                      {isInstagramConnected ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                          Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setIsCheckingInstagram(true);
                            window.location.href = '/api/instagram/auth';
                          }}
                          disabled={isCheckingInstagram}
                          className="text-xs text-pink-400 hover:text-pink-300 transition-colors disabled:opacity-50"
                        >
                          {isCheckingInstagram ? 'Connecting…' : 'Connect →'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Galaxy Info */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Galaxy</h3>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-white text-sm font-medium">{galaxy.name}</div>
                  <div className="text-gray-400 text-xs mt-1">
                    {galaxy.worlds.length} world{galaxy.worlds.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Footer — Actions */}
            <div className="p-6 border-t border-gray-700/50 space-y-3">
              {onSignOut && (
                <button
                  onClick={() => {
                    setShowProfilePanel(false);
                    onSignOut();
                  }}
                  className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <span>🚪</span>
                  <span>Sign Out</span>
                </button>
              )}
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to delete your account? This will remove all your data permanently. This action cannot be undone.')) {
                    setShowProfilePanel(false);
                    try {
                      await clearAllData();
                      if (onDeleteAccount) {
                        onDeleteAccount();
                      } else {
                        // Force reload to reset everything
                        window.location.href = window.location.origin + window.location.pathname;
                      }
                    } catch (err) {
                      console.error('[Profile] Error deleting account:', err);
                      alert('Failed to delete account. Please try again.');
                    }
                  }
                }}
                className="w-full px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <span>🗑️</span>
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create World Button */}
      {galaxy.worlds.length < 10 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={() => setShowWorldForm(true)}
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars font-bold rounded-lg transition-all shadow-lg"
          >
            + Create World
          </button>
        </div>
      )}

      {/* World Creation Form */}
      {showWorldForm && (
        <WorldCreationForm
          galaxyId={galaxy.id}
          galaxyVisualLandscape={galaxy.visualLandscape}
          onSuccess={handleWorldCreated}
          onCancel={() => {
            setShowWorldForm(false);
            setSelectedWorld(null);
          }}
        />
      )}

      {/* World Detail View */}
      {showWorldDetail && selectedWorld && (
        <WorldDetailView
          world={selectedWorld}
          universe={universe}
          artistProfile={artistProfile}
          onClose={() => {
            setShowWorldDetail(false);
            setSelectedWorld(null);
          }}
          onUpdate={handleWorldUpdate}
          onDelete={handleWorldDelete}
        />
      )}

      {/* Calendar View */}
      {showCalendar && (
        <>
          <div 
            className="fixed inset-0 bg-black/90 z-50" 
            onClick={() => setShowCalendar(false)}
          />
          <div className="fixed inset-0 z-[51] flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
            <Card 
              className="w-full max-w-6xl bg-gray-900 border-gray-700 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="relative">
                <div className="flex items-center justify-between gap-4 pr-24">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl text-white">Snapshot Calendar</CardTitle>
                    <CardDescription className="text-gray-400">
                      {galaxy.name} - All Worlds
                    </CardDescription>
                  </div>
                </div>
                <div className="absolute top-6 right-6 flex gap-2 z-10">
                  {!isGoogleCalendarConnected && (
                    <Button
                      onClick={() => connectGoogleCalendar()}
                      variant="outline"
                      className="font-star-wars border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      📅 Sync Google Calendar
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowCalendar(false)}
                    variant="outline"
                    className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <EnhancedCalendar
                  songName={galaxy.name}
                  releaseDate={galaxy.releaseDate || ''}
                  showGoogleSync={false}
                  artistProfile={artistProfile || undefined}
                  brainstormResult={brainstormResult || undefined}
                  teamTasks={teamTasks}
                  teamMembers={teamMembers}
                  currentUserId={currentUserId || undefined}
                  userPermissions={effectiveIsAdmin ? 'full' : 'member'}
                  onTaskReschedule={handleTaskReschedule}
                  onAssignTask={effectiveIsAdmin ? handleAssignTask : undefined}
                  onSharedEventsGenerated={effectiveIsAdmin ? handleSharedEventsGenerated : undefined}
                  onTaskComplete={(taskId) => {
                    console.log('[GalaxyView] Task completed:', taskId);
                    loadTeamData();
                  }}
                  onPostCardClick={(taskId) => {
                    const dbTask = teamTasks.find(t => t.id === taskId);
                    if (dbTask) {
                      setSelectedPostId(taskId);
                    } else {
                      setShowUploadPosts(true);
                    }
                  }}
                  onNonPostTaskClick={(taskId) => {
                    const dbTask = teamTasks.find(t => t.id === taskId);
                    if (dbTask) setSelectedTaskForPanel(dbTask);
                  }}
                  onTaskContextMenu={effectiveIsAdmin && teamMembers.length > 0 ? (taskId, x, y) => {
                    setTaskContextMenu({ taskId, x, y });
                  } : undefined}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Brainstorm Content Modal */}
      {showBrainstorm && (
        <BrainstormContent
          galaxyId={galaxy.id}
          galaxyName={galaxy.name}
          scheduledPosts={getBrainstormPosts()}
          artistProfile={artistProfile}
          preferredDays={artistProfile?.preferredDays || ['saturday', 'sunday']}
          onComplete={handleBrainstormComplete}
          onClose={() => setShowBrainstorm(false)}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          teamId={team?.id || ''}
          teamName={team?.name || `${galaxy.name}'s Team`}
          onClose={() => setShowInviteModal(false)}
          onInviteCreated={() => {
            loadTeamData();
          }}
        />
      )}

      {/* Task Assignment Dropdown */}
      {assigningTaskId && team && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAssigningTaskId(null)} />
          <div className="relative z-10">
            <TaskAssignmentDropdown
              taskId={assigningTaskId}
              taskTitle={teamTasks.find(t => t.id === assigningTaskId)?.title || 'Task'}
              teamMembers={teamMembers}
              currentAssigneeId={teamTasks.find(t => t.id === assigningTaskId)?.assignedTo}
              teamId={team.id}
              onAssign={handleTaskAssigned}
              onInviteNew={() => {
                setAssigningTaskId(null);
                handleOpenInviteModal();
              }}
              onClose={() => setAssigningTaskId(null)}
            />
          </div>
        </div>
      )}

      {/* Brainstorm Review Modal */}
      {showBrainstormReview && pendingBrainstormReview && (
        <BrainstormReview
          result={pendingBrainstormReview}
          completedByName={
            pendingBrainstormReview.completedBy
              ? teamMembers.find(m => m.userId === pendingBrainstormReview.completedBy)?.displayName
              : undefined
          }
          onApprove={handleBrainstormReviewApprove}
          onSendBack={handleBrainstormSendBack}
          onClose={() => {
            setShowBrainstormReview(false);
            setPendingBrainstormReview(null);
          }}
        />
      )}

      {/* Upload Posts Modal */}
      {showUploadPosts && team && (
        <UploadPostsModal
          teamId={team.id}
          galaxyId={galaxy.id}
          galaxyName={galaxy.name}
          teamMembers={teamMembers}
          onClose={() => setShowUploadPosts(false)}
        />
      )}

      {/* Post Detail Modal — opened by clicking a post card in the calendar */}
      {selectedPostId && (() => {
        const selectedTask = teamTasks.find(t => t.id === selectedPostId);
        if (!selectedTask) return null;
        return (
          <PostDetailModal
            task={selectedTask}
            teamMembers={teamMembers}
            onClose={() => setSelectedPostId(null)}
            onPostUpdated={(updated) => {
              // Sync the updated task back into teamTasks state
              setTeamTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
            }}
          />
        );
      })()}

      {/* Task Panel — opened by clicking any non-invite task */}
      {selectedTaskForPanel && (
        <TaskPanel
          task={selectedTaskForPanel}
          teamMembers={teamMembers}
          markContext={{
            userId: currentUserId || '',
            userName: teamMembers.find(m => m.userId === currentUserId)?.displayName
              || (artistProfile as any)?.creatorName
              || 'User',
            artistProfile: artistProfile || undefined,
            currentRelease: galaxy.worlds.length > 0 ? {
              name: galaxy.worlds[0].name,
              releaseDate: galaxy.worlds[0].releaseDate || 'TBD',
              type: (galaxy.worlds[0] as any).type || 'single',
            } : undefined,
            teamMembers: teamMembers.map(m => ({
              displayName: m.displayName,
              role: m.role,
              permissions: m.permissions,
            })),
            upcomingTasks: displayTasks.slice(0, 5).map(t => ({
              title: t.title,
              date: t.date,
              assignedTo: t.assignedTo ? teamMembers.find(m => m.userId === t.assignedTo)?.displayName : undefined,
            })),
            budget: (artistProfile as any)?.budget,
          }}
          onClose={() => setSelectedTaskForPanel(null)}
          onTaskUpdated={(updated) => {
            setTeamTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
          }}
        />
      )}

      {/* Mark Chat Panel */}
      <MarkChatPanel
        isOpen={showMarkChat}
        onClose={() => setShowMarkChat(false)}
        context={{
          userId: currentUserId || '',
          userName: teamMembers.find(m => m.userId === currentUserId)?.displayName 
            || (artistProfile as any)?.creatorName 
            || 'User',
          artistProfile: artistProfile || undefined,
          currentRelease: galaxy.worlds.length > 0 ? {
            name: galaxy.worlds[0].name,
            releaseDate: galaxy.worlds[0].releaseDate || 'TBD',
            type: (galaxy.worlds[0] as any).type || 'single',
          } : undefined,
          teamMembers: teamMembers.map(m => ({
            displayName: m.displayName,
            role: m.role,
            permissions: m.permissions,
          })),
          upcomingTasks: displayTasks.slice(0, 5).map(t => ({
            title: t.title,
            date: t.date,
            assignedTo: t.assignedTo ? teamMembers.find(m => m.userId === t.assignedTo)?.displayName : undefined,
          })),
          budget: (artistProfile as any)?.budget,
        }}
      />
    </div>
  );

  // Helper to extract scheduled posts for the brainstorm component
  function getBrainstormPosts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const posts: { id: string; index: number; title: string; type: 'teaser' | 'promo' | 'audience-builder'; date: string; startTime: string; endTime: string }[] = [];

    const releases = (artistProfile as any)?.releases || [];
    const strategyDesc = ((artistProfile as any)?.releaseStrategyDescription || '').toLowerCase();

    const allDays: { date: Date; dateStr: string; weekNum: number; dayOfWeek: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      allDays.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        weekNum: Math.floor(i / 7),
        dayOfWeek: date.getDay(),
      });
    }

    const prefDays = artistProfile?.preferredDays || ['saturday', 'sunday'];
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    let postCount = 0;
    for (let weekNum = 2; weekNum < 4; weekNum++) {
      const weekDays = allDays.filter(d => d.weekNum === weekNum);
      const sortedDays = [...weekDays].sort((a, b) => {
        const aPreferred = prefDays.includes(dayNames[a.dayOfWeek]) ? 0 : 1;
        const bPreferred = prefDays.includes(dayNames[b.dayOfWeek]) ? 0 : 1;
        if (aPreferred !== bPreferred) return aPreferred - bPreferred;
        return a.dayOfWeek - b.dayOfWeek;
      });

      let postsThisWeek = 0;
      let taskCount = 0;
      for (const day of sortedDays) {
        if (postsThisWeek >= 3) break;
        const shouldPost = taskCount % 2 === 0;
        if (shouldPost) {
          let postType: 'audience-builder' | 'teaser' | 'promo' = 'audience-builder';
          const postDate = new Date(day.date);

          for (const release of releases) {
            if (!release.releaseDate || release.releaseDate === 'TBD' || release.releaseDate === null) continue;
            const releaseDate = new Date(release.releaseDate);
            const daysUntilRelease = Math.floor((releaseDate.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilRelease > 0 && daysUntilRelease <= 14) {
              postType = 'teaser';
              break;
            }
          }

          if (postType === 'audience-builder') {
            for (const release of releases) {
              if (!release.releaseDate || release.releaseDate === 'TBD' || release.releaseDate === null) continue;
              const releaseDate = new Date(release.releaseDate);
              const daysSinceRelease = Math.floor((postDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceRelease > 0 && daysSinceRelease <= 30) {
                postType = 'promo';
                break;
              }
            }
          }

          if (postType === 'audience-builder' && strategyDesc.includes('promote') && strategyDesc.includes('bit')) {
            postType = postsThisWeek % 4 === 0 ? 'promo' : 'audience-builder';
          }

          const postTypeLabel = postType.charAt(0).toUpperCase() + postType.slice(1).replace('-', ' ');
          posts.push({
            id: `post-w${weekNum + 1}-${taskCount}`,
            index: postCount,
            title: `${postTypeLabel} Post`,
            type: postType,
            date: day.dateStr,
            startTime: '10:00',
            endTime: '10:30',
          });
          postCount++;
          postsThisWeek++;
        }
        taskCount++;
      }
    }

    return posts;
  }
}
