import { TeamTask } from '@/types';

export interface LockStatus {
  locked: true;
  reason: string;       // full sentence shown in the modal
  prerequisite: string; // short "complete this first" label
}

type LockRule = {
  pattern: RegExp;
  check: (task: TeamTask, allTasks: TeamTask[]) => LockStatus | null;
};

const LOCK_RULES: LockRule[] = [
  {
    // "Finalize X posts" — locked until ALL upload tasks are completed
    pattern: /finalize \d+ posts?/i,
    check: (_task, allTasks) => {
      const uploadTasks = allTasks.filter(t => /upload \d+ edits?/i.test(t.title));
      if (uploadTasks.length === 0) return null; // no upload tasks tracked → no lock
      const incomplete = uploadTasks.filter(t => t.status !== 'completed');
      if (incomplete.length === 0) return null; // all done → unlocked
      const totalRemaining = incomplete.reduce((sum, t) => {
        const m = t.title.match(/upload (\d+) edits?/i);
        return sum + (m ? parseInt(m[1]) : 0);
      }, 0);
      return {
        locked: true,
        reason: 'Upload all your edits before finalizing posts',
        prerequisite: totalRemaining > 0
          ? `Upload ${totalRemaining} remaining edit${totalRemaining === 1 ? '' : 's'} first`
          : 'Complete your upload tasks first',
      };
    },
  },
  {
    // "Send edits back to [editor]" / "Send revisions" — needs at least 1 upload done
    pattern: /send .* edits? back|send .* revisions?/i,
    check: (_task, allTasks) => {
      const uploadTasks = allTasks.filter(t => /upload \d+ edits?/i.test(t.title));
      if (uploadTasks.length === 0) return null;
      const anyDone = uploadTasks.some(t => t.status === 'completed');
      if (anyDone) return null;
      return {
        locked: true,
        reason: 'Upload at least one batch of edits before sending revision notes',
        prerequisite: 'Complete an upload task first',
      };
    },
  },
  {
    // "Plan shoot day" — needs a brainstorm task completed first
    pattern: /plan .* shoot|plan shoot/i,
    check: (_task, allTasks) => {
      const brainstormTasks = allTasks.filter(t => /brainstorm/i.test(t.title));
      if (brainstormTasks.length === 0) return null;
      const anyDone = brainstormTasks.some(t => t.status === 'completed');
      if (anyDone) return null;
      return {
        locked: true,
        reason: 'Brainstorm your next content batch before planning a shoot',
        prerequisite: 'Complete a brainstorm session first',
      };
    },
  },
  {
    // "Edit MV footage" / "Edit footage" — needs a shoot day completed
    pattern: /edit mv footage|edit .* footage/i,
    check: (_task, allTasks) => {
      const shootTasks = allTasks.filter(
        t => /shoot/i.test(t.title) && !/brainstorm/i.test(t.title)
      );
      if (shootTasks.length === 0) return null;
      const anyDone = shootTasks.some(t => t.status === 'completed');
      if (anyDone) return null;
      return {
        locked: true,
        reason: 'Complete your shoot day before editing the footage',
        prerequisite: 'Complete a shoot task first',
      };
    },
  },
];

/**
 * Returns a LockStatus if the task is locked, or null if it's available.
 * Pass allTasks = all tasks the user currently has (todo + calendar generated).
 */
export function isTaskLocked(task: TeamTask, allTasks: TeamTask[]): LockStatus | null {
  for (const rule of LOCK_RULES) {
    if (rule.pattern.test(task.title)) {
      const result = rule.check(task, allTasks);
      if (result) return result;
    }
  }
  return null;
}
