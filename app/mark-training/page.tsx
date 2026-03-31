'use client';

import { useState, useRef, useCallback } from 'react';
import type { MarkPostAnalysis } from '@/lib/mark-analysis-types';

// ─── Phase 1 types ─────────────────────────────────────────────────────────────

interface AnalysisResult {
  url: string;
  sessionId?: string;
  scraped: boolean;
  rawMetrics: {
    views: number;
    likes: number;
    comments: number;
    durationSec: number;
    caption: string;
  } | null;
  engagementRate: number;
  markAnalysis: MarkPostAnalysis | null;
  scrapeError?: string;
  parseError?: string;
}

interface Session {
  url: string;
  sessionId?: string;
  result: AnalysisResult;
  summary: string;
  feedbackHistory: { feedback: string; reply: string }[];
}

// ─── Phase 2 types ─────────────────────────────────────────────────────────────

type InputMode = 'url' | 'video';

interface FeedbackTurn {
  role: 'mark' | 'user';
  content: string;
}

interface EditSession {
  sessionId: string;
  inputMode: InputMode;
  url?: string;
  videoName?: string;
  rawMetrics: { views: number; likes: number; comments: number; durationSec: number } | null;
  engagementRate: number;
  feedbackHistory: FeedbackTurn[];
  frameSource?: 'video' | 'thumbnail' | 'none';
  frameCount?: number;
  frames?: string[];
  frameDurationSec?: number;
}

// ─── Frame extraction ──────────────────────────────────────────────────────────

async function extractFrames(file: File, count = 4): Promise<{ frames: string[]; durationSec: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = URL.createObjectURL(file);

    video.addEventListener('loadedmetadata', async () => {
      const duration = video.duration;
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = Math.round(640 * (video.videoHeight / video.videoWidth));
      const ctx = canvas.getContext('2d')!;
      const frames: string[] = [];

      for (let i = 0; i < count; i++) {
        const time = i === 0 ? 0.1 : (duration * i) / (count - 1);
        await new Promise<void>(res => {
          video.currentTime = Math.min(time, duration - 0.1);
          video.addEventListener('seeked', () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Strip the data:image/jpeg;base64, prefix
            const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            frames.push(b64);
            res();
          }, { once: true });
        });
      }

      URL.revokeObjectURL(video.src);
      resolve({ frames, durationSec: duration });
    });

    video.addEventListener('error', reject);
  });
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MarkTrainingPage() {
  const [phase, setPhase] = useState<'analyze' | 'feedback'>('analyze');

  // Phase 1 state
  const [url1, setUrl1] = useState('');
  const [loading1, setLoading1] = useState(false);
  const [session1, setSession1] = useState<Session | null>(null);
  const [feedback1, setFeedback1] = useState('');
  const [feedbackLoading1, setFeedbackLoading1] = useState(false);
  const [rules, setRules] = useState<string[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Phase 2 state
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [url2, setUrl2] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [videoDuration, setVideoDuration] = useState(0);
  const [extractingFrames, setExtractingFrames] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [editSession, setEditSession] = useState<EditSession | null>(null);
  const [feedback2, setFeedback2] = useState('');
  const [feedbackLoading2, setFeedbackLoading2] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedbackEndRef = useRef<HTMLDivElement>(null);

  // ─── Phase 1 handlers ─────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!url1.trim()) return;
    setLoading1(true);
    setSession1(null);
    try {
      const res = await fetch('/api/mark/train/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url1.trim()] }),
      });
      const data = await res.json();
      const result: AnalysisResult = data.analyses?.[0];
      if (!result) throw new Error('No result returned');
      const summary = buildSummary(result);
      setSession1({ url: url1.trim(), sessionId: result.sessionId, result, summary, feedbackHistory: [] });
      setUrl1('');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoading1(false);
    }
  }

  async function handleFeedback1() {
    if (!feedback1.trim() || !session1) return;
    setFeedbackLoading1(true);
    try {
      const res = await fetch('/api/mark/train/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedback1.trim(),
          url: session1.url,
          sessionId: session1.sessionId,
          previousAnalysis: session1.result.markAnalysis,
          rawMetrics: session1.result.rawMetrics,
        }),
      });
      const data = await res.json();
      const reply: string = data.revisedAnalysis ?? 'No response.';
      const allRules: string[] = data.allRules ?? [];
      setSession1(prev =>
        prev
          ? { ...prev, summary: reply, feedbackHistory: [...prev.feedbackHistory, { feedback: feedback1.trim(), reply }] }
          : prev,
      );
      setRules(allRules);
      if (data.savedRule) setRulesOpen(true);
      setFeedback1('');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setFeedbackLoading1(false);
    }
  }

  // ─── Phase 2 handlers ─────────────────────────────────────────────────────

  const handleVideoSelect = useCallback(async (file: File) => {
    setVideoFile(file);
    setVideoFrames([]);
    setExtractingFrames(true);
    try {
      const { frames, durationSec } = await extractFrames(file, 4);
      setVideoFrames(frames);
      setVideoDuration(durationSec);
    } catch {
      alert('Could not extract frames from this video file.');
    } finally {
      setExtractingFrames(false);
    }
  }, []);

  async function handleGetFeedback() {
    setLoading2(true);
    setEditSession(null);
    try {
      let body: Record<string, unknown>;

      if (inputMode === 'url') {
        if (!url2.trim()) return;
        body = { mode: 'url', url: url2.trim() };
      } else {
        if (!videoFile || !videoFrames.length) return;
        body = {
          mode: 'video',
          frames: videoFrames,
          videoMeta: {
            name: videoFile.name,
            durationSec: videoDuration,
            sizeMb: videoFile.size / (1024 * 1024),
          },
        };
      }

      const res = await fetch('/api/mark/train/edit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setEditSession({
        sessionId: data.sessionId,
        inputMode,
        url: inputMode === 'url' ? url2.trim() : undefined,
        videoName: inputMode === 'video' ? videoFile?.name : undefined,
        rawMetrics: data.rawMetrics ?? null,
        engagementRate: data.engagementRate ?? 0,
        feedbackHistory: [{ role: 'mark', content: data.feedback }],
        frameSource: data.frameSource,
        frameCount: data.frameCount,
        frames: data.frames ?? (inputMode === 'video' ? videoFrames : []),
        frameDurationSec: data.frameDurationSec ?? (inputMode === 'video' ? videoDuration : 0),
      });
      setUrl2('');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setLoading2(false);
    }
  }

  async function handleFeedback2() {
    if (!feedback2.trim() || !editSession) return;
    setFeedbackLoading2(true);
    const userMsg = feedback2.trim();
    setFeedback2('');

    // Optimistically add user message
    setEditSession(prev => prev ? {
      ...prev,
      feedbackHistory: [...prev.feedbackHistory, { role: 'user', content: userMsg }],
    } : prev);

    try {
      const res = await fetch('/api/mark/train/edit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'continue',
          sessionId: editSession.sessionId,
          userMessage: userMsg,
          feedbackHistory: [...editSession.feedbackHistory, { role: 'user', content: userMsg }],
          frameSource: editSession.frameSource ?? 'none',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setEditSession(prev => prev ? {
        ...prev,
        feedbackHistory: [...prev.feedbackHistory, { role: 'mark', content: data.reply }],
      } : prev);

      setTimeout(() => feedbackEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setFeedbackLoading2(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="border-b border-gray-800 pb-4 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-yellow-400 tracking-wide">MARK — INTELLIGENCE TRAINING</h1>
            <p className="text-xs text-gray-500 mt-1">Developer Only</p>
          </div>
          <a
            href="/mark-training/intelligence"
            className="text-xs font-bold text-emerald-500 border border-emerald-900 rounded px-3 py-1.5 hover:bg-emerald-950 transition-colors"
          >
            3-Tier Intelligence →
          </a>
        </div>

        {/* Phase tabs */}
        <div className="flex gap-1 bg-gray-900 rounded p-1">
          <button
            onClick={() => setPhase('analyze')}
            className={`flex-1 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
              phase === 'analyze' ? 'bg-yellow-500 text-gray-950' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Phase 1 · Analyze
          </button>
          <button
            onClick={() => setPhase('feedback')}
            className={`flex-1 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
              phase === 'feedback' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Phase 2 · Edit Feedback
          </button>
        </div>

        {/* ── Phase 1 ─────────────────────────────────────────────────────── */}
        {phase === 'analyze' && (
          <>
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Instagram URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url1}
                  onChange={e => setUrl1(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading1 && handleAnalyze()}
                  placeholder="https://www.instagram.com/reel/..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-yellow-500"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={loading1 || !url1.trim()}
                  className="px-4 py-2 bg-yellow-500 text-gray-950 text-sm font-bold rounded disabled:opacity-40 hover:bg-yellow-400 transition-colors"
                >
                  {loading1 ? 'Analyzing…' : 'Analyze'}
                </button>
              </div>
            </div>

            {loading1 && (
              <div className="text-sm text-gray-400 animate-pulse">Scraping post + running Mark analysis…</div>
            )}

            {session1 && (
              <div className="space-y-4">
                {session1.result.rawMetrics && (
                  <div className="flex gap-4 text-xs text-gray-500 border border-gray-800 rounded px-3 py-2 bg-gray-900">
                    <span>{session1.result.rawMetrics.views.toLocaleString()} views</span>
                    <span>{session1.result.rawMetrics.likes.toLocaleString()} likes</span>
                    <span>{session1.result.rawMetrics.comments.toLocaleString()} comments</span>
                    <span>{session1.result.rawMetrics.durationSec.toFixed(1)}s</span>
                    <span className="text-yellow-600">{session1.result.engagementRate.toFixed(2)}% engagement</span>
                  </div>
                )}

                <div className="bg-gray-900 border border-gray-800 rounded p-4 space-y-3">
                  <div className="text-xs text-yellow-500 uppercase tracking-wider font-bold">Mark</div>
                  <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{session1.summary}</div>
                </div>

                {session1.feedbackHistory.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="bg-gray-800 border border-gray-700 rounded p-3">
                      <div className="text-xs text-blue-400 uppercase tracking-wider font-bold mb-1">You</div>
                      <div className="text-sm text-gray-300">{item.feedback}</div>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded p-4">
                      <div className="text-xs text-yellow-500 uppercase tracking-wider font-bold mb-2">Mark (revised)</div>
                      <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{item.reply}</div>
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Feedback for Mark</label>
                  <textarea
                    value={feedback1}
                    onChange={e => setFeedback1(e.target.value)}
                    placeholder="e.g. You're wrong about the hook type — this is a fan-comment-overlay, not text-only…"
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  <button
                    onClick={handleFeedback1}
                    disabled={feedbackLoading1 || !feedback1.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded disabled:opacity-40 hover:bg-blue-500 transition-colors"
                  >
                    {feedbackLoading1 ? 'Sending…' : 'Submit Feedback'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Phase 2 ─────────────────────────────────────────────────────── */}
        {phase === 'feedback' && (
          <>
            {/* Input mode toggle */}
            <div className="flex gap-1 bg-gray-900 rounded p-1">
              <button
                onClick={() => { setInputMode('url'); setEditSession(null); }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                  inputMode === 'url' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Instagram URL
              </button>
              <button
                onClick={() => { setInputMode('video'); setEditSession(null); }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                  inputMode === 'video' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Upload Video
              </button>
            </div>

            {/* URL input */}
            {inputMode === 'url' && !editSession && (
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Instagram URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={url2}
                    onChange={e => setUrl2(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !loading2 && handleGetFeedback()}
                    placeholder="https://www.instagram.com/reel/..."
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleGetFeedback}
                    disabled={loading2 || !url2.trim()}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded disabled:opacity-40 hover:bg-blue-400 transition-colors"
                  >
                    {loading2 ? 'Analyzing…' : 'Get Feedback'}
                  </button>
                </div>
              </div>
            )}

            {/* Video upload */}
            {inputMode === 'video' && !editSession && (
              <div className="space-y-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Video File</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('video/')) handleVideoSelect(file);
                  }}
                  className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-600 transition-colors"
                >
                  {videoFile ? (
                    <div className="space-y-1">
                      <div className="text-sm text-gray-200 font-bold">{videoFile.name}</div>
                      <div className="text-xs text-gray-500">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB · {videoDuration.toFixed(1)}s</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm text-gray-400">Drop a video file or click to browse</div>
                      <div className="text-xs text-gray-600">MP4, MOV, etc.</div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoSelect(file);
                  }}
                />

                {/* Frame previews */}
                {extractingFrames && (
                  <div className="text-xs text-gray-500 animate-pulse">Extracting frames…</div>
                )}
                {videoFrames.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Extracted frames</div>
                    <div className="grid grid-cols-4 gap-1">
                      {videoFrames.map((frame, i) => (
                        <img
                          key={i}
                          src={`data:image/jpeg;base64,${frame}`}
                          alt={`Frame ${i + 1}`}
                          className="w-full rounded aspect-video object-cover bg-gray-900"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGetFeedback}
                  disabled={loading2 || !videoFrames.length || extractingFrames}
                  className="w-full px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded disabled:opacity-40 hover:bg-blue-400 transition-colors"
                >
                  {loading2 ? 'Analyzing…' : 'Get Feedback'}
                </button>
              </div>
            )}

            {loading2 && (
              <div className="text-sm text-gray-400 animate-pulse">
                {inputMode === 'url' ? 'Scraping post + running Mark analysis…' : 'Sending frames to Mark…'}
              </div>
            )}

            {/* Feedback conversation */}
            {editSession && (
              <div className="space-y-4">
                {/* Session header */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {editSession.inputMode === 'url'
                      ? <a href={editSession.url} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 truncate block max-w-xs">{editSession.url}</a>
                      : <span>{editSession.videoName}</span>
                    }
                  </div>
                    <div className="flex gap-3 items-center text-xs text-gray-600">
                    {editSession.rawMetrics && editSession.inputMode === 'url' && (
                      <>
                        <span>{editSession.rawMetrics.views.toLocaleString()} views</span>
                        <span className="text-blue-500">{editSession.engagementRate.toFixed(2)}% er</span>
                      </>
                    )}
                    {editSession.frameSource === 'video' && (
                      <span className="text-emerald-500 font-bold">{editSession.frameCount} real frames</span>
                    )}
                    {editSession.frameSource === 'thumbnail' && (
                      <span className="text-amber-500">thumbnail only</span>
                    )}
                  </div>
                </div>

                {/* Conversation turns */}
                <div className="space-y-3">
                  {editSession.feedbackHistory.map((turn, i) => (
                    <div key={i} className={`rounded p-4 ${
                      turn.role === 'mark'
                        ? 'bg-gray-900 border border-gray-800'
                        : 'bg-gray-800 border border-gray-700'
                    }`}>
                      <div className={`text-xs uppercase tracking-wider font-bold mb-2 ${
                        turn.role === 'mark' ? 'text-yellow-500' : 'text-blue-400'
                      }`}>
                        {turn.role === 'mark' ? 'Mark' : 'You'}
                      </div>
                      {/* Show frames inline for Mark's first response */}
                      {turn.role === 'mark' && i === 0 && editSession.frames && editSession.frames.length > 0 && (
                        <div className="mb-3 space-y-1">
                          <div className="text-xs text-gray-600 uppercase tracking-wider">
                            {editSession.frameSource === 'video' ? `${editSession.frames.length} frames` : 'thumbnail'}
                          </div>
                          <div className={`grid gap-1 ${editSession.frames.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-4'}`}>
                            {editSession.frames.map((frame, fi) => {
                              const ts = editSession.frameDurationSec && editSession.frames!.length > 1
                                ? Math.round((fi / Math.max(editSession.frames!.length - 1, 1)) * editSession.frameDurationSec)
                                : null;
                              return (
                                <div key={fi} className="relative">
                                  <img
                                    src={`data:image/jpeg;base64,${frame}`}
                                    alt={ts !== null ? `Frame at ~${ts}s` : 'Cover thumbnail'}
                                    className="w-full rounded aspect-video object-cover bg-gray-800"
                                  />
                                  {ts !== null && (
                                    <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/60 rounded px-1">~{ts}s</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {turn.content}
                      </div>
                    </div>
                  ))}
                  <div ref={feedbackEndRef} />
                </div>

                {/* Reply input */}
                <div className="space-y-2">
                  <textarea
                    value={feedback2}
                    onChange={e => setFeedback2(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !feedbackLoading2) {
                        handleFeedback2();
                      }
                    }}
                    placeholder="Respond to Mark's feedback… (⌘↵ to send)"
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleFeedback2}
                      disabled={feedbackLoading2 || !feedback2.trim()}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded disabled:opacity-40 hover:bg-blue-500 transition-colors"
                    >
                      {feedbackLoading2 ? 'Sending…' : 'Send'}
                    </button>
                    <button
                      onClick={() => setEditSession(null)}
                      className="px-4 py-2 bg-gray-800 text-gray-400 text-sm rounded hover:text-gray-200 transition-colors"
                    >
                      New Session
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Training rules (Phase 1) */}
        {(rules.length > 0 || rulesOpen) && phase === 'analyze' && (
          <div className="border border-gray-800 rounded">
            <button
              onClick={() => setRulesOpen(o => !o)}
              className="w-full flex justify-between items-center px-4 py-2 text-xs text-gray-400 uppercase tracking-wider hover:text-gray-200"
            >
              <span>Training Rules ({rules.length})</span>
              <span>{rulesOpen ? '▲' : '▼'}</span>
            </button>
            {rulesOpen && (
              <ul className="px-4 pb-4 space-y-2">
                {rules.map((r, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-2">
                    <span className="text-yellow-600 shrink-0">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSummary(result: AnalysisResult): string {
  if (result.scrapeError) return `Couldn't scrape this post: ${result.scrapeError}`;
  if (!result.markAnalysis) return `Mark couldn't parse a clean analysis. Raw error: ${result.parseError ?? 'unknown'}`;
  return buildSummaryFromAnalysis(result.markAnalysis);
}

function buildSummaryFromAnalysis(a: MarkPostAnalysis | null): string {
  if (!a) return 'No analysis available.';
  const paras: string[] = [];
  paras.push(a.postSuccess.reason);
  paras.push(a.videoDescription);
  if (a.hookType || a.hookEffectiveness) {
    const hookMeta = [a.hookType, a.hookDuration != null ? `~${a.hookDuration}s` : null].filter(Boolean).join(', ');
    paras.push(`Hook (${hookMeta}): ${a.hookEffectiveness ?? '—'}`);
  }
  const rhythmLine = [
    a.cutRhythm,
    a.musicSync?.note ? `Music sync: ${a.musicSync.note}` : '',
  ].filter(Boolean).join(' — ');
  if (rhythmLine) paras.push(rhythmLine);
  if (a.captionStrategy) paras.push(`Caption: ${a.captionStrategy}`);
  if (a.commentSentiment) paras.push(`What viewers are responding to: ${a.commentSentiment}`);
  return paras.join('\n\n');
}
