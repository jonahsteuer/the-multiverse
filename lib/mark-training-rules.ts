import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { MarkPostAnalysis, Phase2Analysis } from './mark-analysis-types';

const NOTES_PATH = path.join(process.cwd(), 'lib/mark-training-notes.json');
const LOG_PATH = path.join(process.cwd(), 'lib/mark-training-log.json');

interface TrainingNotes {
  rules: string[];
  lastUpdated: string;
}

export interface TrainingSession {
  id: string;
  url: string;
  timestamp: string;
  rawMetrics: Record<string, unknown> | null;
  // Phase 1 analysis (compact schema)
  markAnalysis: MarkPostAnalysis | null;
  markSummary: string;
  // Phase 2 analysis (rich Stafford-structured schema) + references
  phase2Analysis?: Phase2Analysis | null;
  references?: Array<Record<string, unknown>>;
  rawMarkResponse?: string;
  feedbackRounds: Array<{
    feedback: string;
    revisedAnalysis: string;
    savedRule: string | null;
    timestamp: string;
  }>;
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export function loadTrainingRules(): string[] {
  try {
    const raw = readFileSync(NOTES_PATH, 'utf-8');
    const notes: TrainingNotes = JSON.parse(raw);
    return notes.rules ?? [];
  } catch {
    return [];
  }
}

export function saveTrainingRule(rule: string): string[] {
  let notes: TrainingNotes = { rules: [], lastUpdated: '' };
  try {
    notes = JSON.parse(readFileSync(NOTES_PATH, 'utf-8'));
  } catch {}
  notes.rules.push(rule);
  notes.lastUpdated = new Date().toISOString().slice(0, 10);
  writeFileSync(NOTES_PATH, JSON.stringify(notes, null, 2));
  return notes.rules;
}

// ─── Session log ─────────────────────────────────────────────────────────────

function loadLog(): { sessions: TrainingSession[] } {
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf-8'));
  } catch {
    return { sessions: [] };
  }
}

function saveLog(log: { sessions: TrainingSession[] }) {
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

export function logSession(session: TrainingSession): void {
  const log = loadLog();
  // Replace if same ID already exists, otherwise append
  const idx = log.sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    log.sessions[idx] = session;
  } else {
    log.sessions.push(session);
  }
  saveLog(log);
}

export function loadSession(id: string): TrainingSession | null {
  return loadLog().sessions.find(s => s.id === id) ?? null;
}

export function appendFeedbackRound(
  sessionId: string,
  round: TrainingSession['feedbackRounds'][number],
): void {
  const log = loadLog();
  const session = log.sessions.find(s => s.id === sessionId);
  if (session) {
    session.feedbackRounds.push(round);
    saveLog(log);
  }
}

export function loadAllSessions(): TrainingSession[] {
  return loadLog().sessions;
}

export function logSessionBatch(sessions: TrainingSession[]): void {
  const log = loadLog();
  for (const session of sessions) {
    const idx = log.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      log.sessions[idx] = session;
    } else {
      log.sessions.push(session);
    }
  }
  saveLog(log);
}
