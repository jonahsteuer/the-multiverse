'use client';

import { useState, useEffect, useCallback } from 'react';
import { connectGoogleCalendar, checkCalendarConnection } from '@/lib/google-oauth';
import dynamic from 'next/dynamic';
import type {
  Galaxy, World, Universe, ArtistProfile, BrainstormResult,
  Team, TeamTask, TeamMemberRecord, AppNotification,
} from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TodoList } from './TodoList';
import { NotificationBell, showToast } from './NotificationBell';
import { InviteModal } from './InviteModal';
import { TaskAssignmentDropdown } from './TaskAssignmentDropdown';
import { BrainstormReview } from './BrainstormReview';

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
}

export function GalaxyView({ galaxy, universe, artistProfile, onUpdateWorld, onDeleteGalaxy, onDeleteWorld, onSignOut }: GalaxyViewProps) {
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
  const [isAdmin, setIsAdmin] = useState(true); // Default true for solo users
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [showBrainstormReview, setShowBrainstormReview] = useState(false);
  const [pendingBrainstormReview, setPendingBrainstormReview] = useState<BrainstormResult | null>(null);

  // Check Google Calendar connection status when calendar modal opens
  useEffect(() => {
    if (showCalendar) {
      checkCalendarConnection().then(setIsGoogleCalendarConnected);
    }
  }, [showCalendar]);

  // Load team data
  useEffect(() => {
    loadTeamData();
  }, [universe.id]);

  const loadTeamData = useCallback(async () => {
    try {
      // Get current user
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      // Load team for this universe
      const teamResponse = await fetch(`/api/team?universeId=${universe.id}`);
      const teamData = await teamResponse.json();
      if (teamData.success && teamData.team) {
        setTeam(teamData.team);

        // Determine admin status
        const members: TeamMemberRecord[] = teamData.team.members || [];
        setTeamMembers(members);
        if (user) {
          const myMember = members.find(m => m.userId === user.id);
          setIsAdmin(myMember?.permissions === 'full' || !myMember); // Default admin if not a team member yet
        }

        // Load tasks
        const tasksResponse = await fetch(`/api/team/tasks?teamId=${teamData.team.id}&view=${isAdmin ? 'all' : 'my'}`);
        const tasksData = await tasksResponse.json();
        if (tasksData.success) {
          setTeamTasks(tasksData.tasks || []);
        }
      }
    } catch (err) {
      // Team system not set up yet — that's fine, will work in solo mode
      console.log('[GalaxyView] Team system not loaded (may not be set up yet)');
    }
  }, [universe.id, isAdmin]);

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
        await fetch('/api/team/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'brainstorm',
            teamId: team.id,
            galaxyId: galaxy.id,
            brainstormResult: result,
          }),
        });

        // Mark the brainstorm task as completed
        const brainstormTask = teamTasks.find(t => t.type === 'brainstorm' && t.galaxyId === galaxy.id);
        if (brainstormTask) {
          await fetch('/api/team/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'complete', taskId: brainstormTask.id }),
          });
        }

        // Notify admin about brainstorm completion
        const admins = teamMembers.filter(m => m.permissions === 'full' && m.userId !== currentUserId);
        if (admins.length > 0) {
          // The notification is auto-sent by completeTask in the backend
          console.log('[GalaxyView] Admin(s) notified about brainstorm completion');
        }

        // Reload tasks
        loadTeamData();
      } catch (err) {
        console.error('[GalaxyView] Error creating tasks from brainstorm:', err);
      }
    }
  };

  const handleTaskClick = async (task: TeamTask) => {
    // Handle specific task types
    switch (task.type) {
      case 'invite_team':
        setShowInviteModal(true);
        // Auto-complete invite task when modal opens
        if (team) {
          await fetch('/api/team/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'complete', taskId: task.id }),
          });
          loadTeamData();
        }
        break;
      case 'brainstorm':
        setShowBrainstorm(true);
        break;
      default:
        // For other tasks, just mark them as in_progress
        if (task.status === 'pending') {
          await fetch('/api/team/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: task.id, status: 'in_progress' }),
          });
          loadTeamData();
        }
        break;
    }
  };

  const handleAssignTask = (taskId: string) => {
    setAssigningTaskId(taskId);
  };

  const handleTaskAssigned = (taskId: string, userId: string) => {
    setAssigningTaskId(null);
    loadTeamData();
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
      await fetch('/api/team/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          galaxyId: galaxy.id,
          title: 'Revise Content Plan',
          description: notes,
          type: 'brainstorm',
          taskCategory: 'task',
          date: new Date().toISOString().split('T')[0],
          startTime: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
          endTime: `${new Date().getHours().toString().padStart(2, '0')}:${Math.min(new Date().getMinutes() + 30, 59).toString().padStart(2, '0')}`,
          assignedTo: assignee,
        }),
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
      await fetch('/api/team/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          taskId,
          teamId: team.id,
          date: newDate,
          startTime,
          endTime,
        }),
      });
      loadTeamData();
    } catch (err) {
      console.error('[GalaxyView] Error rescheduling task:', err);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 3D Galaxy View */}
      <Galaxy3DWrapper
        key={`galaxy-${galaxy.id}-${galaxy.worlds.length}`}
        galaxy={galaxy}
        onWorldClick={handleWorldClick}
      />

      {/* Info Panel with Todo List */}
      <div className="absolute top-4 left-4 z-10 bg-black/80 border border-yellow-500/30 rounded-lg p-4 max-w-xs">
        <h2 className="text-xl font-star-wars text-yellow-400 mb-2">{galaxy.name}</h2>
        <p className="text-sm text-gray-400 mb-2">
          {galaxy.worlds.length} world{galaxy.worlds.length !== 1 ? 's' : ''} created
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Click on a world to view timeline, shoot days, and calendar sync
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mb-3">
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
          {/* Brainstorm Content Button */}
          <button
            onClick={() => setShowBrainstorm(true)}
            className={`w-full px-3 py-2 font-star-wars font-bold rounded text-sm transition-all ${
              brainstormResult
                ? 'bg-green-600/30 border border-green-500/50 text-green-300 hover:bg-green-600/40'
                : 'bg-purple-600 hover:bg-purple-700 text-white animate-pulse'
            }`}
          >
            {brainstormResult ? '✅ Content Brainstormed' : '🧠 Brainstorm Content'}
          </button>
          {/* Invite Team Button (admin only) */}
          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="w-full px-3 py-2 bg-blue-600/80 hover:bg-blue-600 text-white font-star-wars font-bold rounded text-sm transition-all"
            >
              👥 Invite Team
            </button>
          )}
        </div>

        {/* Todo List */}
        {teamTasks.length > 0 && (
          <TodoList
            teamId={team?.id || ''}
            galaxyId={galaxy.id}
            tasks={teamTasks}
            teamMembers={teamMembers}
            currentUserId={currentUserId || undefined}
            isAdmin={isAdmin}
            onTaskClick={handleTaskClick}
            onAssignTask={isAdmin ? handleAssignTask : undefined}
          />
        )}
      </div>

      {/* Top Right: Sign Out + Notifications */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Notification Bell */}
        {currentUserId && (
          <div className="bg-black/80 border border-yellow-500/30 rounded-lg p-1">
            <NotificationBell
              userId={currentUserId}
              onNotificationClick={handleNotificationClick}
            />
          </div>
        )}

        {/* Sign Out */}
        {onSignOut && (
          <div className="bg-black/80 border border-yellow-500/30 rounded-lg p-2">
            <button
              onClick={onSignOut}
              className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-star-wars font-bold rounded text-sm"
              title="Sign Out"
            >
              🚪 Sign Out
            </button>
          </div>
        )}
      </div>

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
                  artistProfile={artistProfile}
                  brainstormResult={brainstormResult || undefined}
                  teamTasks={teamTasks}
                  teamMembers={teamMembers}
                  currentUserId={currentUserId || undefined}
                  userPermissions={isAdmin ? 'full' : 'member'}
                  onTaskReschedule={handleTaskReschedule}
                  onAssignTask={isAdmin ? handleAssignTask : undefined}
                  onTaskComplete={(taskId) => {
                    console.log('[GalaxyView] Task completed:', taskId);
                    loadTeamData();
                  }}
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
      {showInviteModal && team && (
        <InviteModal
          teamId={team.id}
          teamName={team.name}
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
                setShowInviteModal(true);
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
