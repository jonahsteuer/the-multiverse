/**
 * Tasks API — /api/team/tasks
 * GET: Get tasks for team
 * POST: Create task
 * PATCH: Update task (reschedule, complete, assign)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createTask,
  getTeamTasks,
  getMyTasks,
  updateTask,
  completeTask,
  assignTask,
  rescheduleTask,
  createInitialTasks,
  createTasksFromBrainstorm,
} from '@/lib/team';
import type { TeamTaskType, TeamTaskCategory, TeamTaskStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const view = searchParams.get('view'); // 'my' or 'all'
    const galaxyId = searchParams.get('galaxyId');
    const status = searchParams.get('status') as TeamTaskStatus | null;

    if (!teamId) {
      return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    }

    if (view === 'my') {
      const tasks = await getMyTasks(teamId);
      return NextResponse.json({ success: true, tasks });
    }

    const tasks = await getTeamTasks(teamId, {
      galaxyId: galaxyId || undefined,
      status: status || undefined,
    });
    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    console.error('[API/tasks] Error:', error);
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Special action: create initial tasks after onboarding
    if (action === 'init') {
      const { teamId, galaxyId, hasTeam } = body;
      if (!teamId || !galaxyId) {
        return NextResponse.json({ error: 'teamId and galaxyId required' }, { status: 400 });
      }
      const tasks = await createInitialTasks(teamId, galaxyId, hasTeam || false);
      return NextResponse.json({ success: true, tasks });
    }

    // Special action: create tasks from brainstorm result
    if (action === 'brainstorm') {
      const { teamId, galaxyId, brainstormResult } = body;
      if (!teamId || !galaxyId || !brainstormResult) {
        return NextResponse.json({ error: 'teamId, galaxyId, and brainstormResult required' }, { status: 400 });
      }
      const tasks = await createTasksFromBrainstorm(teamId, galaxyId, brainstormResult);
      return NextResponse.json({ success: true, tasks });
    }

    // Regular task creation
    const { teamId, galaxyId, title, description, type, taskCategory, date, startTime, endTime, assignedTo } = body;
    if (!teamId || !title || !type || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const task = await createTask(teamId, {
      galaxyId,
      title,
      description,
      type: type as TeamTaskType,
      taskCategory: (taskCategory || 'task') as TeamTaskCategory,
      date,
      startTime,
      endTime,
      assignedTo,
    });

    if (!task) {
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('[API/tasks] Error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, taskId, teamId } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    if (action === 'complete') {
      const success = await completeTask(taskId);
      return NextResponse.json({ success });
    }

    if (action === 'assign') {
      const { assigneeUserId } = body;
      if (!assigneeUserId || !teamId) {
        return NextResponse.json({ error: 'assigneeUserId and teamId required' }, { status: 400 });
      }
      const success = await assignTask(taskId, assigneeUserId, teamId);
      return NextResponse.json({ success });
    }

    if (action === 'reschedule') {
      const { date, startTime, endTime } = body;
      if (!date || !startTime || !endTime || !teamId) {
        return NextResponse.json({ error: 'date, startTime, endTime, and teamId required' }, { status: 400 });
      }
      const success = await rescheduleTask(taskId, date, startTime, endTime, teamId);
      return NextResponse.json({ success });
    }

    // Generic update
    const task = await updateTask(taskId, body);
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('[API/tasks] Error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

