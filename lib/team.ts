/**
 * Team collaboration data layer
 * Handles all team, invite, task, and notification operations via Supabase
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Team,
  TeamMemberRecord,
  TeamInvitation,
  TeamTask,
  AppNotification,
  TeamRole,
  TeamPermission,
  TeamTaskType,
  TeamTaskCategory,
  TeamTaskStatus,
  NotificationType,
  BrainstormResult,
  PostEdit,
} from '@/types';

// ============================================================================
// TEAM OPERATIONS
// ============================================================================

/** Create a team for a universe (called after onboarding) */
export async function createTeam(universeId: string, name: string, galaxyId?: string): Promise<Team | null> {
  console.log('[Team] createTeam called:', { universeId, name, galaxyId });
  
  if (!isSupabaseConfigured()) {
    console.error('[Team] Supabase not configured!');
    return null;
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('[Team] Auth error:', authError);
    return null;
  }
  if (!user) {
    console.error('[Team] No authenticated user!');
    return null;
  }
  console.log('[Team] Authenticated user:', user.id);

  const { data, error } = await supabase
    .from('teams')
    .insert({
      universe_id: universeId,
      galaxy_id: galaxyId || null,
      name,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('[Team] Error creating team:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  console.log('[Team] Team created successfully:', data.id);

  // Add creator as admin member
  const member = await addTeamMember(data.id, user.id, 'admin', 'full', name.replace("'s Team", ''));
  console.log('[Team] Admin member added:', member ? 'success' : 'FAILED');

  return mapTeamFromDb(data);
}

/**
 * Get team for a universe.
 * For invited members (non-owners), this first looks for the team the current
 * user is actually a member of — preventing duplicate-team issues where
 * `universe_id` might match multiple teams.
 */
export async function getTeamForUniverse(universeId: string): Promise<Team | null> {
  if (!isSupabaseConfigured()) return null;

  // Strategy 1: find the team the current user is a member of for this universe
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: memberRows } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      if (memberRows && memberRows.length > 0) {
        const teamIds = memberRows.map(r => r.team_id);
        const { data: teamRows } = await supabase
          .from('teams')
          .select('*, team_members:team_members(*)')
          .eq('universe_id', universeId)
          .in('id', teamIds)
          .limit(1);

        if (teamRows && teamRows.length > 0) {
          const team = mapTeamFromDb(teamRows[0]);
          team.members = (teamRows[0].team_members || []).map(mapMemberFromDb);
          return team;
        }
      }
    }
  } catch (e) {
    console.warn('[Team] getTeamForUniverse member-lookup failed, falling back:', e);
  }

  // Strategy 2: fall back to single-team lookup (works for admins / fresh setups)
  const { data, error } = await supabase
    .from('teams')
    .select('*, team_members:team_members(*)')
    .eq('universe_id', universeId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Team] Error loading team:', error);
    return null;
  }
  if (!data) return null;

  const team = mapTeamFromDb(data);
  team.members = (data.team_members || []).map(mapMemberFromDb);
  return team;
}

/** Get all teams the current user is a member of */
export async function getMyTeams(): Promise<Team[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, teams:teams(*)')
    .eq('user_id', user.id);

  if (error) {
    console.error('[Team] Error loading teams:', error);
    return [];
  }

  return (data || [])
    .filter((d: any) => d.teams)
    .map((d: any) => mapTeamFromDb(d.teams));
}

// ============================================================================
// TEAM MEMBER OPERATIONS
// ============================================================================

/** Add a member to a team */
export async function addTeamMember(
  teamId: string,
  userId: string,
  role: TeamRole,
  permissions: TeamPermission,
  displayName: string,
  invitedBy?: string
): Promise<TeamMemberRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      user_id: userId,
      role,
      permissions,
      display_name: displayName,
      invited_by: invitedBy || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Team] Error adding member:', error);
    return null;
  }

  return mapMemberFromDb(data);
}

/** Get all members of a team */
export async function getTeamMembers(teamId: string): Promise<TeamMemberRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('[Team] Error loading members:', error);
    return [];
  }

  return (data || []).map(mapMemberFromDb);
}

/** Remove a member from a team */
export async function removeTeamMember(memberId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId);

  return !error;
}

// ============================================================================
// INVITATION OPERATIONS
// ============================================================================

/** Generate a unique invite token */
function generateInviteToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/** Create a team invitation */
export async function createInvitation(
  teamId: string,
  role: TeamRole,
  invitedName?: string,
  invitedEmail?: string
): Promise<TeamInvitation | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const inviteToken = generateInviteToken();

  const { data, error } = await supabase
    .from('team_invitations')
    .insert({
      team_id: teamId,
      invite_token: inviteToken,
      role,
      invited_by: user.id,
      invited_name: invitedName || null,
      invited_email: invitedEmail || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[Team] Error creating invitation:', error);
    return null;
  }

  return mapInvitationFromDb(data);
}

/** Get invitation by token (for invite acceptance page) */
export async function getInvitationByToken(token: string): Promise<TeamInvitation | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('team_invitations')
    .select('*, teams:teams(*, team_members:team_members(*))')
    .eq('invite_token', token)
    .single();

  if (error) {
    console.error('[Team] Error loading invitation:', error);
    return null;
  }

  const invitation = mapInvitationFromDb(data);
  if (data.teams) {
    invitation.team = mapTeamFromDb(data.teams);
    invitation.team.members = (data.teams.team_members || []).map(mapMemberFromDb);
    // Find inviter display name
    const inviter = invitation.team.members?.find(m => m.userId === invitation.invitedBy);
    invitation.inviterName = inviter?.displayName;
  }
  return invitation;
}

/** Accept an invitation */
export async function acceptInvitation(
  token: string,
  userId: string,
  displayName: string
): Promise<{ success: boolean; teamId?: string; universeId?: string | null; galaxyId?: string | null }> {
  if (!isSupabaseConfigured()) return { success: false };

  // 1. Get the invitation
  const invitation = await getInvitationByToken(token);
  if (!invitation || invitation.status !== 'pending') {
    return { success: false };
  }

  // 2. Update invitation status
  const { error: updateError } = await supabase
    .from('team_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('invite_token', token);

  if (updateError) {
    console.error('[Team] Error accepting invitation:', updateError);
    return { success: false };
  }

  // 3. Add user as team member
  const permissions: TeamPermission = invitation.role === 'manager' ? 'full' : 'member';
  await addTeamMember(
    invitation.teamId,
    userId,
    invitation.role,
    permissions,
    displayName,
    invitation.invitedBy
  );

  // 4. Notify the inviter (non-blocking — don't fail if notification fails)
  try {
    await createNotification(
      invitation.invitedBy,
      invitation.teamId,
      'member_joined',
      `${displayName} joined your team!`,
      `${displayName} accepted your invitation and joined as ${invitation.role}.`,
      { memberId: userId, memberName: displayName, role: invitation.role }
    );
  } catch (notifErr) {
    console.warn('[Team] Notification creation failed (non-critical):', notifErr);
  }

  return {
    success: true,
    teamId: invitation.teamId,
    universeId: invitation.team?.universeId || null,
    galaxyId: (invitation.team as any)?.galaxyId || null,
  };
}

/** Get pending invitations for a team */
export async function getTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Team] Error loading invitations:', error);
    return [];
  }

  return (data || []).map(mapInvitationFromDb);
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

/** Create a team task */
export async function createTask(
  teamId: string,
  task: {
    galaxyId?: string;
    title: string;
    description?: string;
    type: TeamTaskType;
    taskCategory: TeamTaskCategory;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    assignedTo?: string; // user_id
  }
): Promise<TeamTask | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('team_tasks')
    .insert({
      team_id: teamId,
      galaxy_id: task.galaxyId || null,
      title: task.title,
      description: task.description || '',
      type: task.type,
      task_category: task.taskCategory,
      date: task.date,
      start_time: task.startTime,
      end_time: task.endTime,
      assigned_to: task.assignedTo || null,
      assigned_by: user.id,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[Team] Error creating task:', error);
    return null;
  }

  // Notify assignee if task is assigned to someone else
  if (task.assignedTo && task.assignedTo !== user.id) {
    await createNotification(
      task.assignedTo,
      teamId,
      'task_assigned',
      `New task: ${task.title}`,
      `You've been assigned "${task.title}".`,
      { taskId: data.id, taskTitle: task.title }
    );
  }

  return mapTaskFromDb(data);
}

/** Get tasks for a team (optionally filtered by assignee or galaxy) */
export async function getTeamTasks(
  teamId: string,
  filters?: { assignedTo?: string; galaxyId?: string; status?: TeamTaskStatus }
): Promise<TeamTask[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('team_tasks')
    .select('*')
    .eq('team_id', teamId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }
  if (filters?.galaxyId) {
    query = query.eq('galaxy_id', filters.galaxyId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Team] Error loading tasks:', error);
    return [];
  }

  return (data || []).map(mapTaskFromDb);
}

/** Get tasks visible to a specific user (their tasks + shared events) */
export async function getMyTasks(teamId: string): Promise<TeamTask[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('team_tasks')
    .select('*')
    .eq('team_id', teamId)
    .or(`assigned_to.eq.${user.id},task_category.eq.event`)
    .neq('status', 'completed')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[Team] Error loading my tasks:', error);
    return [];
  }

  return (data || []).map(mapTaskFromDb);
}

/** Update a task (reschedule, change status, reassign) */
export async function updateTask(
  taskId: string,
  updates: Partial<{
    date: string;
    startTime: string;
    endTime: string;
    status: TeamTaskStatus;
    assignedTo: string;
    description: string;
    title: string;
  }>
): Promise<TeamTask | null> {
  if (!isSupabaseConfigured()) return null;

  const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.date) dbUpdates.date = updates.date;
  if (updates.startTime) dbUpdates.start_time = updates.startTime;
  if (updates.endTime) dbUpdates.end_time = updates.endTime;
  if (updates.status) {
    dbUpdates.status = updates.status;
    if (updates.status === 'completed') {
      dbUpdates.completed_at = new Date().toISOString();
    }
  }
  if (updates.assignedTo) dbUpdates.assigned_to = updates.assignedTo;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.title !== undefined) dbUpdates.title = updates.title;

  const { data, error } = await supabase
    .from('team_tasks')
    .update(dbUpdates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('[Team] Error updating task:', error);
    return null;
  }

  return mapTaskFromDb(data);
}

/** Save the mark_analysis JSONB field for a task (used for storing uploaded clip data) */
export async function saveTaskMarkAnalysis(
  taskId: string,
  markAnalysis: Record<string, unknown>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('team_tasks')
    .update({ mark_analysis: markAnalysis, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) {
    console.error('[Team] Error saving mark_analysis:', error);
    return false;
  }
  return true;
}

/** Delete a task (used to clean up stale calendar events before regeneration) */
export async function deleteTask(taskId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('team_tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('[Team] Error deleting task:', error);
    return false;
  }
  return true;
}

/** Complete a task */
export async function completeTask(taskId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Get task details first (for notification)
  const { data: taskData } = await supabase
    .from('team_tasks')
    .select('*, teams:teams(team_members:team_members(*))')
    .eq('id', taskId)
    .single();

  const result = await updateTask(taskId, { status: 'completed' });
  if (!result) return false;

  // Notify admins that task is completed
  if (taskData?.teams?.team_members) {
    const admins = taskData.teams.team_members.filter(
      (m: any) => m.permissions === 'full' && m.user_id !== user.id
    );
    for (const admin of admins) {
      await createNotification(
        admin.user_id,
        taskData.team_id,
        'task_completed',
        `Task completed: ${taskData.title}`,
        `${taskData.title} has been completed.`,
        { taskId, taskTitle: taskData.title }
      );
    }
  }

  return true;
}

/** Assign a task to a team member */
export async function assignTask(
  taskId: string,
  assigneeUserId: string,
  teamId: string
): Promise<boolean> {
  const result = await updateTask(taskId, { assignedTo: assigneeUserId });
  if (!result) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (user && assigneeUserId !== user.id) {
    await createNotification(
      assigneeUserId,
      teamId,
      'task_assigned',
      `New task: ${result.title}`,
      `You've been assigned "${result.title}".`,
      { taskId, taskTitle: result.title }
    );
  }

  return true;
}

/** Reschedule a task (and notify admins) */
export async function rescheduleTask(
  taskId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  teamId: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const result = await updateTask(taskId, {
    date: newDate,
    startTime: newStartTime,
    endTime: newEndTime,
  });
  if (!result) return false;

  // Notify admins about the reschedule
  const members = await getTeamMembers(teamId);
  const admins = members.filter(m => m.permissions === 'full' && m.userId !== user.id);
  const myMember = members.find(m => m.userId === user.id);
  const myName = myMember?.displayName || 'A team member';

  for (const admin of admins) {
    await createNotification(
      admin.userId,
      teamId,
      'task_rescheduled',
      `Task rescheduled: ${result.title}`,
      `${myName} rescheduled "${result.title}" to ${newDate} at ${newStartTime}.`,
      { taskId, taskTitle: result.title, newDate, newStartTime, rescheduledBy: user.id }
    );
  }

  return true;
}

/** Create initial tasks after onboarding (invite team + brainstorm) */
export async function createInitialTasks(
  teamId: string,
  galaxyId: string,
  hasTeam: boolean
): Promise<TeamTask[]> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  // Format time as HH:MM
  const pad = (n: number) => n.toString().padStart(2, '0');
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const tasks: TeamTask[] = [];

  if (hasTeam) {
    // Task 1: Invite team members (now → +15min)
    const inviteTask = await createTask(teamId, {
      galaxyId,
      title: 'Invite team members',
      description: 'Add your collaborators so they can help with content creation.',
      type: 'invite_team',
      taskCategory: 'task',
      date: todayStr,
      startTime: `${pad(currentHour)}:${pad(currentMinute)}`,
      endTime: `${pad(currentHour)}:${pad(Math.min(currentMinute + 15, 59))}`,
    });
    if (inviteTask) tasks.push(inviteTask);

    // Task 2: Brainstorm Content (+15min → +30min)
    const brainstormTask = await createTask(teamId, {
      galaxyId,
      title: 'Brainstorm Content',
      description: 'Choose content formats for your scheduled posts.',
      type: 'brainstorm',
      taskCategory: 'task',
      date: todayStr,
      startTime: `${pad(currentHour)}:${pad(Math.min(currentMinute + 15, 59))}`,
      endTime: `${pad(currentHour + (currentMinute + 30 >= 60 ? 1 : 0))}:${pad((currentMinute + 30) % 60)}`,
    });
    if (brainstormTask) tasks.push(brainstormTask);
  } else {
    // No team — just brainstorm
    const brainstormTask = await createTask(teamId, {
      galaxyId,
      title: 'Brainstorm Content',
      description: 'Choose content formats for your scheduled posts.',
      type: 'brainstorm',
      taskCategory: 'task',
      date: todayStr,
      startTime: `${pad(currentHour)}:${pad(currentMinute)}`,
      endTime: `${pad(currentHour)}:${pad(Math.min(currentMinute + 15, 59))}`,
    });
    if (brainstormTask) tasks.push(brainstormTask);
  }

  return tasks;
}

/** Create tasks from a brainstorm result */
export async function createTasksFromBrainstorm(
  teamId: string,
  galaxyId: string,
  result: BrainstormResult
): Promise<TeamTask[]> {
  const tasks: TeamTask[] = [];

  // Create post events for each brainstormed idea assignment (M: includes soundbyte + rollout_zone)
  for (const assignment of result.formatAssignments) {
    const postLabel = assignment.postType.charAt(0).toUpperCase() +
      assignment.postType.slice(1).replace('-', ' ');
    const title = assignment.ideaTitle
      ? assignment.ideaTitle
      : `${postLabel} Post`;
    let description = assignment.ideaHook
      ? `Hook: ${assignment.ideaHook}`
      : `${postLabel} post from content brainstorm`;
    if (assignment.shootLook) description += `\nLook: ${assignment.shootLook}`;
    if (assignment.soundbyte) description += `\nSoundbyte: starts at ${assignment.soundbyte}`;

    const task = await createTask(teamId, {
      galaxyId,
      title,
      description,
      type: 'post',
      taskCategory: 'event',
      date: assignment.date,
      startTime: '10:00',
      endTime: '10:30',
    });
    // Save soundbyte + rollout_zone directly (createTask doesn't have these fields, use raw upsert)
    if (task && (assignment.soundbyte || assignment.rolloutZone)) {
      try {
        await supabase
          .from('team_tasks')
          .update({
            soundbyte: assignment.soundbyte || null,
            rollout_zone: assignment.rolloutZone || null,
            shoot_look: assignment.shootLook || null,
          })
          .eq('id', task.id);
      } catch { /* non-blocking */ }
    }
    if (task) tasks.push(task);
  }

  // Create edit day tasks (K, L: include editor instructions + footage ref)
  for (const editDay of result.editDays) {
    const instructionsText = editDay.editorInstructions
      ? `\n\nEDITOR INSTRUCTIONS:\n${editDay.editorInstructions}`
      : '';
    const footageText = editDay.footageRef
      ? `\nFootage: ${editDay.footageRef}`
      : '';

    const task = await createTask(teamId, {
      galaxyId,
      title: `Edit Day — ${editDay.customFormatName || `Posts ${editDay.postsCovered.map(i => i + 1).join(', ')}`}`,
      description: `Edit ${editDay.postsCovered.length} post${editDay.postsCovered.length !== 1 ? 's' : ''} (post slots ${editDay.postsCovered.map(i => i + 1).join(', ')}).${footageText}${instructionsText}`,
      type: 'edit',
      taskCategory: 'task',
      date: editDay.date,
      startTime: editDay.startTime,
      endTime: editDay.endTime,
      assignedTo: editDay.assignedTo,
    });
    if (task) tasks.push(task);
  }

  // Create shoot day events or "Plan shoot day" task based on artist's choice
  if (result.shootDayAction === 'schedule_task') {
    const firstPostDate = result.formatAssignments.map(a => a.date).sort()[0];
    const shootTaskDate = firstPostDate
      ? new Date(new Date(firstPostDate).getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0]
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const task = await createTask(teamId, {
      galaxyId,
      title: 'Plan shoot day',
      description: 'Plan and schedule a shoot day for your brainstormed content ideas.',
      type: 'shoot',
      taskCategory: 'task',
      date: shootTaskDate,
      startTime: '10:00',
      endTime: '11:00',
    });
    if (task) tasks.push(task);
  } else if (result.shootDayAction === 'plan_now' || result.shootDays.length > 0) {
    // Shoot Day event with timed scene+look breakdown (E1-E3)
    const shootDay = result.shootDays[0];
    const fallbackTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const shootDate = result.shootDayDate || shootDay?.date || fallbackTomorrow;

    // Derive shoot start time from timeOfDay preference
    const shootStartHour = result.shootTimeOfDay === 'morning' ? 9
      : result.shootTimeOfDay === 'afternoon' ? 13
      : result.shootTimeOfDay === 'evening' ? 17 : 10;

    const startTime = shootDay?.startTime || `${String(shootStartHour).padStart(2, '0')}:00`;

    // Build timed scene schedule (E2: logical shoot order, E3: per-scene and per-look times)
    // Order: setup-heavy / directional-light scenes first, golden-hour scenes last
    const scenes = result.confirmedScenes || [];
    const looksPerScene = result.looks ? Math.ceil(result.looks.length / Math.max(scenes.length, 1)) : 5;
    const minutesPerLook = 12; // ~12 min per look including takes
    const minutesPerScene = looksPerScene * minutesPerLook + 10; // +10 min travel/setup between scenes

    // Sort scenes: golden hour scenes last, others by complexity (easy first)
    const sortedScenes = [...scenes].sort((a: any, b: any) => {
      const aGolden = (a.timeOfDay || '').toLowerCase().includes('golden') || (a.timeOfDay || '').toLowerCase().includes('sunset');
      const bGolden = (b.timeOfDay || '').toLowerCase().includes('golden') || (b.timeOfDay || '').toLowerCase().includes('sunset');
      if (aGolden && !bGolden) return 1;  // golden hour scenes go last
      if (!aGolden && bGolden) return -1;
      return 0;
    });

    let shotListDesc = '';
    if (result.confirmedLocation) {
      shotListDesc += `📍 ${result.confirmedLocation}`;
      if (result.confirmedLocationUrl) shotListDesc += `\n🔗 ${result.confirmedLocationUrl}`;
    }
    if (result.shootCrew) shotListDesc += `\n👥 Crew: ${result.shootCrew}`;
    shotListDesc += '\n';

    // Build timed schedule
    let currentMinute = shootStartHour * 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

    if (sortedScenes.length > 0) {
      shotListDesc += `\n📋 TIMED SHOOT SCHEDULE\n`;
      sortedScenes.forEach((scene: any, si: number) => {
        const sceneStart = currentMinute;
        const sceneLooks = result.looks
          ? result.looks.filter((_: any, li: number) => Math.floor(li / looksPerScene) === si)
          : Array.from({ length: looksPerScene }, (_: any, li: number) => ({ number: si * looksPerScene + li + 1, description: 'Full take', angle: 'varies', energy: 'match the song' }));

        shotListDesc += `\n[${toTime(sceneStart)}] SCENE ${si + 1}: ${scene.title || scene}`;
        if (scene.setting) shotListDesc += `\n  📌 ${scene.setting}`;
        if (scene.timeOfDay) shotListDesc += `\n  🕐 Best light: ${scene.timeOfDay}`;

        sceneLooks.forEach((look: any, li: number) => {
          const lookStart = sceneStart + li * minutesPerLook;
          const lookEnd = lookStart + minutesPerLook;
          shotListDesc += `\n  ${toTime(lookStart)}–${toTime(lookEnd)}  Look ${look.number || li + 1}: ${look.description} (${look.angle}, ${look.energy})`;
        });

        currentMinute = sceneStart + minutesPerScene;
        if (si < sortedScenes.length - 1) {
          shotListDesc += `\n  ↓ Travel to next scene`;
        }
      });
    } else if (result.looks && result.looks.length > 0) {
      // Fallback: no scene objects, just looks
      shotListDesc += `\n🎬 SHOT LIST\n`;
      result.looks.forEach((l: any) => {
        const lookStart = currentMinute;
        currentMinute += minutesPerLook;
        shotListDesc += `\n  ${toTime(lookStart)}–${toTime(currentMinute)}  Look ${l.number}: ${l.description} (${l.angle}, ${l.energy})`;
      });
    }

    const endTime = shootDay?.endTime || toTime(currentMinute + 15); // +15 min buffer
    shotListDesc += `\n\n✅ Record the full song at EVERY look. Maximum footage = maximum posts to test.`;

    const task = await createTask(teamId, {
      galaxyId,
      title: `Shoot Day${result.confirmedLocation ? ` — ${result.confirmedLocation}` : ''}`,
      description: shotListDesc || 'Shoot content for your brainstormed ideas.',
      type: 'shoot',
      taskCategory: 'event',
      date: shootDate,
      startTime,
      endTime,
    });

    // F10: Auto-generate a prep checklist task the day before the shoot
    const shootDateObj = new Date(shootDate + 'T12:00:00');
    shootDateObj.setDate(shootDateObj.getDate() - 1);
    const prepDate = shootDateObj.toISOString().split('T')[0];
    const looksCount = result.looks?.length || 5;
    const prepDesc = [
      `📋 Prep checklist for tomorrow's shoot${result.confirmedLocation ? ` at ${result.confirmedLocation}` : ''}:`,
      ``,
      `□ Charge phone/camera and all batteries`,
      `□ Lay out outfits for each look (${looksCount} looks planned)`,
      `□ Download and review the shot list from the Shoot Day event`,
      result.shootCrew && result.shootCrew !== 'solo' ? `□ Confirm crew/videographer availability` : `□ Set up tripod or find a surface to prop your phone`,
      result.confirmedLocation ? `□ Check travel time to ${result.confirmedLocation} — leave buffer for parking/setup` : `□ Confirm travel plan to shoot location`,
      `□ Review the first-frame note on each scene so you know exactly how to start`,
    ].join('\n');

    const prepTask = await createTask(teamId, {
      galaxyId,
      title: `Prep for tomorrow's shoot${result.confirmedLocation ? ` — ${result.confirmedLocation}` : ''}`,
      description: prepDesc,
      type: 'custom',
      taskCategory: 'task',
      date: prepDate,
      startTime: '20:00',
      endTime: '20:30',
    });
    if (prepTask) tasks.push(prepTask);

    if (task) {
      tasks.push(task);

      // E4: Notify all team members about the new shoot day
      try {
        const members = await getTeamMembers(teamId);
        const adminMember = members.find(m => m.role === 'admin' || m.permissions === 'full');
        const adminUserId = adminMember?.userId || '';

        await Promise.allSettled(
          members
            .filter(m => m.userId && m.userId !== adminUserId)
            .map(m => createNotification(
              m.userId!,
              teamId,
              'task_assigned',
              `Shoot Day Scheduled — ${result.confirmedLocation || 'Location TBD'}`,
              `A shoot day has been added to the calendar for ${shootDate}. Check the event for the full timed shot list.`,
              { taskId: task.id, shootDate, location: result.confirmedLocation || '' }
            ))
        );
      } catch (notifErr) {
        console.warn('[Team] Could not send shoot day notifications:', notifErr);
      }
    }
  }

  // F8: Weekly Check-in tasks (Sunday of each week for 6 weeks)
  // Used to review post performance and fill in ambiguous post slots
  if (result.formatAssignments.length > 0) {
    const firstPostDate = result.formatAssignments.map(a => a.date).sort()[0];
    if (firstPostDate) {
      const firstDate = new Date(firstPostDate + 'T12:00:00');
      for (let week = 0; week < 6; week++) {
        // Find the Sunday of the week containing firstDate + (week * 7) days
        const weekDate = new Date(firstDate.getTime() + week * 7 * 24 * 60 * 60 * 1000);
        const daysUntilSun = (7 - weekDate.getDay()) % 7 || 7; // days until next Sunday
        const checkInDate = new Date(weekDate.getTime() + daysUntilSun * 24 * 60 * 60 * 1000);
        const checkInDateStr = checkInDate.toISOString().split('T')[0];
        const task = await createTask(teamId, {
          galaxyId,
          title: `Weekly Check-in — Review post performance`,
          description: `Review how this week's posts performed. Fill in edit instructions for next week's ambiguous post slots based on what worked best.`,
          type: 'custom',
          taskCategory: 'task',
          date: checkInDateStr,
          startTime: '18:00',
          endTime: '18:30',
        });
        if (task) tasks.push(task);
      }
    }
  }

  return tasks;
}

// ============================================================================
// NOTIFICATION OPERATIONS
// ============================================================================

/** Create a notification */
export async function createNotification(
  userId: string,
  teamId: string,
  type: NotificationType,
  title: string,
  message: string,
  data: Record<string, any> = {}
): Promise<AppNotification | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: notifData, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      team_id: teamId,
      type,
      title,
      message,
      data,
      read: false,
    })
    .select()
    .single();

  if (error) {
    console.error('[Team] Error creating notification:', error);
    return null;
  }

  return mapNotificationFromDb(notifData);
}

/** Get notifications for the current user */
export async function getMyNotifications(limit: number = 20): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Team] Error loading notifications:', error);
    return [];
  }

  return (data || []).map(mapNotificationFromDb);
}

/** Get unread notification count */
export async function getUnreadNotificationCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) return 0;
  return count || 0;
}

/** Mark a notification as read */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  return !error;
}

/** Mark all notifications as read */
export async function markAllNotificationsRead(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);

  return !error;
}

/** Subscribe to real-time notifications */
export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: AppNotification) => void
) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        onNotification(mapNotificationFromDb(payload.new));
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

/** Subscribe to real-time task updates */
export function subscribeToTaskUpdates(
  teamId: string,
  onTaskUpdate: (task: TeamTask) => void
) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };

  const channel = supabase
    .channel(`tasks:${teamId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'team_tasks',
        filter: `team_id=eq.${teamId}`,
      },
      (payload: any) => {
        if (payload.new) {
          onTaskUpdate(mapTaskFromDb(payload.new));
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

// ============================================================================
// DB → TypeScript Mappers (snake_case → camelCase)
// ============================================================================

function mapTeamFromDb(row: any): Team {
  return {
    id: row.id,
    universeId: row.universe_id,
    galaxyId: row.galaxy_id || undefined,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapMemberFromDb(row: any): TeamMemberRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    permissions: row.permissions,
    displayName: row.display_name,
    invitedBy: row.invited_by,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
  };
}

function mapInvitationFromDb(row: any): TeamInvitation {
  return {
    id: row.id,
    teamId: row.team_id,
    inviteToken: row.invite_token,
    role: row.role,
    invitedBy: row.invited_by,
    invitedName: row.invited_name,
    invitedEmail: row.invited_email,
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
  };
}

function mapTaskFromDb(row: any): TeamTask {
  return {
    id: row.id,
    teamId: row.team_id,
    galaxyId: row.galaxy_id,
    title: row.title,
    description: row.description || '',
    type: row.type,
    taskCategory: row.task_category,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    assignedTo: row.assigned_to,
    assignedBy: row.assigned_by,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Video / post fields
    videoUrl: row.video_url,
    videoSource: row.video_source,
    videoEmbedUrl: row.video_embed_url,
    markNotes: row.mark_notes,
    markAnalysis: row.mark_analysis,
    caption: row.caption,
    hashtags: row.hashtags,
    postStatus: row.post_status,
    revisionNotes: row.revision_notes,
    // Stafford fields (gracefully undefined if migration not yet run)
    soundbyte: row.soundbyte ?? undefined,
    rolloutZone: row.rollout_zone ?? undefined,
    shootLook: row.shoot_look ?? undefined,
    expectedFootageRef: row.expected_footage_ref ?? undefined,
  } as any as TeamTask;
}

function mapNotificationFromDb(row: any): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data: row.data || {},
    read: row.read,
    createdAt: row.created_at,
  };
}

// ============================================================================
// VIDEO / POST MANAGEMENT
// ============================================================================

export interface VideoAnalysis {
  colorPalette: string[];
  setting: string;
  hasInstrument: boolean;
  cameraDistance: string;
  hasTextOverlay: boolean;
  energyLevel: string;
  score: number;
  strengths: string[];
  improvements: string[];
  markNotes: string;
}

export interface PostVideoUpdate {
  videoUrl: string;
  videoSource: 'google_drive' | 'dropbox' | 'youtube' | 'direct';
  videoEmbedUrl: string;
  markNotes?: string;
  markAnalysis?: VideoAnalysis;
  postStatus?: string;
}

/** Link a video to a scheduled post task */
export async function updatePostVideo(
  taskId: string,
  update: PostVideoUpdate
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('team_tasks')
    .update({
      video_url: update.videoUrl,
      video_source: update.videoSource,
      video_embed_url: update.videoEmbedUrl,
      mark_notes: update.markNotes || null,
      mark_analysis: update.markAnalysis || null,
      post_status: update.postStatus || 'linked',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) {
    console.error('[Team] Error updating post video:', error);
    return false;
  }
  return true;
}

/** Update caption and hashtags for a post */
export async function updatePostCaption(
  taskId: string,
  caption: string,
  hashtags: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('team_tasks')
    .update({
      caption,
      hashtags,
      post_status: 'caption_written',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) {
    console.error('[Team] Error updating post caption:', error);
    return false;
  }
  return true;
}

/** Approve a post (mark as ready to schedule) */
export async function approvePost(taskId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('team_tasks')
    .update({
      post_status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) {
    console.error('[Team] Error approving post:', error);
    return false;
  }
  return true;
}

/** Send a post to a team member for revision with notes */
export async function sendPostForRevision(
  taskId: string,
  assignedTo: string,
  revisionNotes: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('team_tasks')
    .update({
      assigned_to: assignedTo,
      assigned_by: user?.id || null,
      revision_notes: revisionNotes,
      post_status: 'revision_requested',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) {
    console.error('[Team] Error sending post for revision:', error);
    return false;
  }
  return true;
}

/** Get all post-type events for a galaxy (for Upload Posts modal) */
export async function getPostEvents(teamId: string, galaxyId: string): Promise<TeamTask[]> {
  if (!isSupabaseConfigured() || !teamId || !galaxyId) return [];

  const { data, error } = await supabase
    .from('team_tasks')
    .select('*')
    .eq('team_id', teamId)
    .eq('galaxy_id', galaxyId)
    .eq('task_category', 'event')
    .in('type', ['post', 'release', 'audience-builder', 'teaser', 'promo'])
    .order('date', { ascending: true });

  if (error) {
    console.error('[Team] Error fetching post events:', error);
    return [];
  }

  return (data || []).map(mapTaskFromDb);
}

// ============================================================================
// MARK CONVERSATION STORAGE
// ============================================================================

export interface MarkConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Upsert a Mark conversation session.
 * Pass `sessionId` to update an existing row, or omit to insert a new one.
 * Returns the row's id so the caller can update it on subsequent saves.
 */
export async function saveMarkConversation(
  userId: string,
  galaxyId: string | null,
  sessionType: 'general' | 'brainstorm' | 'onboarding_post',
  messages: MarkConversationMessage[],
  context?: Record<string, unknown>,
  sessionId?: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  if (!userId) return null;

  try {
    if (sessionId) {
      const { error } = await supabase
        .from('mark_conversations')
        .update({ messages, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId);
      if (error) throw error;
      return sessionId;
    } else {
      const { data, error } = await supabase
        .from('mark_conversations')
        .insert({
          user_id: userId,
          galaxy_id: galaxyId,
          session_type: sessionType,
          messages,
          context: context || {},
        })
        .select('id')
        .single();
      if (error) throw error;
      return data?.id ?? null;
    }
  } catch (err) {
    console.warn('[Mark] Failed to save conversation (non-blocking):', err);
    return null;
  }
}

// ============================================================================
// POST EDIT OPERATIONS
// ============================================================================

function mapPostEditFromDb(row: any): PostEdit {
  return {
    id: row.id,
    postTaskId: row.post_task_id,
    teamId: row.team_id,
    galaxyId: row.galaxy_id,
    uploadedBy: row.uploaded_by || undefined,
    uploaderName: row.uploader_name || '',
    videoUrl: row.video_url,
    versionNumber: row.version_number || 1,
    description: row.description || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Get all edit versions for a post task */
export async function getPostEdits(postTaskId: string): Promise<PostEdit[]> {
  if (!isSupabaseConfigured() || !postTaskId) return [];

  const { data, error } = await supabase
    .from('post_edits')
    .select('*')
    .eq('post_task_id', postTaskId)
    .order('version_number', { ascending: true });

  if (error) {
    console.error('[Team] Error fetching post edits:', error);
    return [];
  }

  return (data || []).map(mapPostEditFromDb);
}

/** Upload a new edit version for a post */
export async function createPostEdit(
  teamId: string,
  galaxyId: string | null,
  postTaskId: string,
  videoUrl: string,
  uploaderName: string,
  description?: string,
  versionNumber?: number,
): Promise<PostEdit | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('post_edits')
    .insert({
      post_task_id: postTaskId || null,
      team_id: teamId,
      galaxy_id: galaxyId || null,
      uploaded_by: user?.id || null,
      uploader_name: uploaderName,
      video_url: videoUrl,
      version_number: versionNumber || 1,
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Team] Error creating post edit:', error);
    return null;
  }

  return mapPostEditFromDb(data);
}

/** Delete an edit version */
export async function deletePostEdit(editId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('post_edits')
    .delete()
    .eq('id', editId);

  if (error) {
    console.error('[Team] Error deleting post edit:', error);
    return false;
  }

  return true;
}

/**
 * Send an item (post edit or footage) to a team member with notes.
 * Creates a "Review X's notes on Y" task + notification for the recipient.
 */
export async function sendItemWithNotes(
  teamId: string,
  galaxyId: string,
  recipientId: string,
  senderName: string,
  itemName: string,
  sourceType: 'post_edit' | 'footage',
  sourceId: string,
  note: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const h = Math.max(today.getHours(), 10);
  const startTime = `${h.toString().padStart(2, '0')}:00`;
  const endTime = `${Math.min(h + 1, 23).toString().padStart(2, '0')}:00`;

  const { error: taskError } = await supabase.from('team_tasks').insert({
    team_id: teamId,
    galaxy_id: galaxyId,
    title: `Review ${senderName}'s notes on ${itemName}`,
    description: note,
    type: 'review',
    task_category: 'task',
    date: todayStr,
    start_time: startTime,
    end_time: endTime,
    assigned_to: recipientId,
    assigned_by: user?.id || null,
    status: 'pending',
    mark_analysis: { sourceType, sourceId, senderName, itemName, note },
  });

  if (taskError) {
    console.error('[Team] Error creating review task:', taskError);
    return false;
  }

  try {
    await createNotification(
      recipientId,
      teamId,
      'review_notes_sent',
      `${senderName} sent notes on ${itemName}`,
      note.length > 120 ? note.slice(0, 117) + '...' : note,
      { sourceType, sourceId, senderName, itemName },
    );
  } catch (e) {
    console.warn('[Team] Review notification failed (non-blocking):', e);
  }

  return true;
}

/**
 * Ensure a team exists for a universe. If none found, auto-create one.
 * Safe to call on every load — only creates if missing.
 * Pass galaxyId to associate the team with a specific galaxy (galaxy-level sharing).
 */
export async function ensureTeamForUniverse(
  universeId: string,
  teamName: string,
  galaxyId?: string,
): Promise<Team | null> {
  if (!isSupabaseConfigured()) return null;

  const existing = await getTeamForUniverse(universeId);
  if (existing) {
    // If existing team has no galaxy_id but we now have one, update it
    if (galaxyId && !existing.galaxyId) {
      await supabase.from('teams').update({ galaxy_id: galaxyId }).eq('id', existing.id);
      existing.galaxyId = galaxyId;
    }
    return existing;
  }

  return createTeam(universeId, teamName, galaxyId);
}
