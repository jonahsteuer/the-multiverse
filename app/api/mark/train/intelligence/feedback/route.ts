/**
 * POST /api/mark/train/intelligence/feedback
 *
 * Logs feedback on a Mark intelligence chat response.
 * Appends to lib/mark-intelligence-training-log.json.
 *
 * Input:  { sessionId, markResponse, userFeedback, tiersActive, username? }
 * Output: { success: true, logCount: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'lib', 'mark-intelligence-training-log.json');

interface LogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  username?: string;
  tiersActive: string[];
  markResponse: string;
  userFeedback: string;
  feedbackType: 'good' | 'needs_work' | 'wrong' | 'neutral';
}

function loadLog(): LogEntry[] {
  try {
    const raw = fs.readFileSync(LOG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLog(entries: LogEntry[]) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2));
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, markResponse, userFeedback, tiersActive = [], username, feedbackType = 'neutral' } = await req.json() as {
      sessionId: string;
      markResponse: string;
      userFeedback: string;
      tiersActive?: string[];
      username?: string;
      feedbackType?: 'good' | 'needs_work' | 'wrong' | 'neutral';
    };

    if (!userFeedback?.trim()) {
      return NextResponse.json({ error: 'userFeedback required' }, { status: 400 });
    }

    const entries = loadLog();
    const entry: LogEntry = {
      id: `intel-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sessionId: sessionId ?? 'unknown',
      username,
      tiersActive,
      markResponse: markResponse?.slice(0, 500) ?? '',
      userFeedback: userFeedback.trim(),
      feedbackType,
    };

    entries.push(entry);
    saveLog(entries);

    return NextResponse.json({ success: true, logCount: entries.length });

  } catch (e: any) {
    console.error('[intelligence/feedback]', e);
    return NextResponse.json({ error: e.message ?? 'Feedback save failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const entries = loadLog();
    return NextResponse.json({ entries, count: entries.length });
  } catch {
    return NextResponse.json({ entries: [], count: 0 });
  }
}
