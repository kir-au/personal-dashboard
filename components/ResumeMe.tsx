'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileText, Clock, ArrowRight, Target, RefreshCw,
  BookOpen, Sparkles, Zap, ChevronRight, Calendar,
  Activity, Sunrise, Sun, ExternalLink,
  Hourglass, AlertCircle,
  Bot, Mic, Send
} from 'lucide-react';
import MarkdownModal from './MarkdownModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StateItem {
  label: string;
  status: string;
}

interface RecommendedAction {
  title: string;
  why: string;
  agent: string;
  action: string;
}

interface StillMattersItem {
  title: string;
  path: string;
  reason: string;
}

interface RecentFile {
  relativePath: string;
  name: string;
  mtime: number;
  title: string;
  category: string;
}

interface HorizonBlock {
  title: string;
  body: string;
  items: string[];
  source?: { label: string; path: string };
}

interface ActivityBlock {
  title: string;
  body: string;
  filesChanged: number;
  highlights: string[];
}

interface BriefPlanItem {
  area: 'Product / Work' | 'Health / Food / Energy' | 'Family / Life' | 'Admin / Loose ends';
  item: string;
  rationale?: string;
}

interface DailyBrief {
  orientation: string;
  doFirst: string;
  keepInMind: string;
  canWait: string;
  draftPlan: BriefPlanItem[];
  dayMap: DayMapBlock[];
  changedSinceYesterday: string;
  checkInQuestions: string[];
}

interface DayMapBlock {
  label: string;
  kind: 'check-in' | 'work' | 'health' | 'food' | 'family' | 'admin' | 'recovery';
  timeHint?: string;
  text: string;
  flexible: boolean;
}

interface ResumeData {
  headline: string;
  dailyBrief: DailyBrief;
  currentState: StateItem[];
  recommendedAction: RecommendedAction;
  stillMatters: StillMattersItem[];
  recentChanges: RecentFile[];
  horizons: Record<string, HorizonBlock>;
  activitySummary: { today: ActivityBlock; week: ActivityBlock };
  updatedAt: string;
}

interface FileItem {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  mtime: number;
}

// ---------------------------------------------------------------------------
// Check-in state (voice-first)
// ---------------------------------------------------------------------------

interface CheckinSignal {
  key: string;
  label: string;
  value: string | null;
}

interface CheckinState {
  howAreYou: string | null;
  energy: string | null;
  sleep: string | null;
  mood: string | null;
  body: string | null;
  alcohol: string | null;
  constraint: string | null;
  extra: string;
  completed: boolean;
}

const EMPTY_CHECKIN: CheckinState = {
  howAreYou: null,
  energy: null,
  sleep: null,
  mood: null,
  body: null,
  alcohol: null,
  constraint: null,
  extra: '',
  completed: false,
};

// Quick-chip options (secondary, not primary)
const QUICK_CHIPS: Array<{ key: keyof CheckinState; label: string; chips: string[] }> = [
  { key: 'energy', label: 'Energy', chips: ['Low', 'OK', 'Good'] },
  { key: 'sleep', label: 'Sleep', chips: ['Bad', 'OK', 'Good'] },
  { key: 'mood', label: 'Mood', chips: ['Flat', 'Normal', 'Sharp'] },
  { key: 'body', label: 'Body', chips: ['Sore', 'Fine', 'Strong'] },
  { key: 'alcohol', label: 'Alcohol', chips: ['No', 'Yes'] },
  { key: 'constraint', label: 'Constraint', chips: ['Time', 'Energy', 'Family', 'Work', 'Unclear'] },
];

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

interface Message {
  role: 'assistant' | 'user';
  text: string;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const HORIZON_KEYS = ['today', 'week', 'month', 'year'] as const;
type HorizonKey = (typeof HORIZON_KEYS)[number];

const HORIZON_LABELS: Record<HorizonKey, string> = {
  today: 'Today',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

const HORIZON_ICONS: Record<HorizonKey, React.ReactNode> = {
  today: <Sun className="w-3.5 h-3.5" />,
  week: <Activity className="w-3.5 h-3.5" />,
  month: <Calendar className="w-3.5 h-3.5" />,
  year: <Calendar className="w-3.5 h-3.5" />,
};

const AREA_ICONS: Record<string, React.ReactNode> = {
  'Product / Work': <Sparkles className="w-3.5 h-3.5 text-emerald-500" />,
  'Health / Food / Energy': <Sun className="w-3.5 h-3.5 text-amber-500" />,
  'Family / Life': <Heart className="w-3.5 h-3.5 text-rose-500" />,
  'Admin / Loose ends': <FileText className="w-3.5 h-3.5 text-slate-500" />,
};

// ---------------------------------------------------------------------------
// Inline Heart SVG component
// ---------------------------------------------------------------------------

function Heart(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers: dynamic brief copy based on check-in
// ---------------------------------------------------------------------------

function deriveAdaptedBrief(brief: DailyBrief, checkin: CheckinState): {
  orientation: string;
  doFirst: string;
  keepInMind: string;
  canWait: string;
  draftPlan: BriefPlanItem[];
} {
  const isLowEnergy = checkin.energy === 'Low';
  const isGoodEnergy = checkin.energy === 'Good';
  const isFamilyConstraint = checkin.constraint === 'Family';
  const isTimeConstraint = checkin.constraint === 'Time';
  const hadAlcohol = checkin.alcohol === 'Yes';

  // Orientation: personalise based on energy
  let orientation = brief.orientation;
  if (isLowEnergy) {
    orientation = 'Energy is low today. The useful move is one small step, then protect the rest of the day.';
  } else if (isGoodEnergy) {
    orientation = 'Energy is good. Let\'s make the most of it — one clear product task, then stop.';
  }

  // Do first: energy-aware
  let doFirst = brief.doFirst;
  if (isLowEnergy) {
    doFirst = 'One small, visible improvement. Reduce scope, not ambition.';
  } else if (isGoodEnergy) {
    doFirst = brief.doFirst || 'Push the primary product task forward.';
  }

  // Keep in mind
  let keepInMind = brief.keepInMind;
  if (isLowEnergy) {
    keepInMind = 'Protect energy above all. Eat protein, hydrate, rest. This is a maintenance day.';
  } else if (hadAlcohol) {
    keepInMind = 'Be kind to yourself today. Hydrate, eat well, and keep the scope small.';
  }

  // Can wait
  let canWait = brief.canWait;
  if (isTimeConstraint) {
    canWait = 'Everything except the one priority task. Time is short — pick the highest-leverage move and do only that.';
  }

  // Draft plan
  let draftPlan = [...brief.draftPlan];
  if (isFamilyConstraint) {
    // Ensure Family/Life is present and visible
    const hasFamily = draftPlan.some(p => p.area === 'Family / Life');
    if (!hasFamily) {
      draftPlan.push({ area: 'Family / Life', item: 'Family is the main context today. Keep space for it.', rationale: 'Check-in constraint' });
    }
  }

  return { orientation, doFirst, keepInMind, canWait, draftPlan };
}

// ---------------------------------------------------------------------------
// Small row components for the Implementation Log
// ---------------------------------------------------------------------------

function EndpointRow({ label, desc, status }: { label: string; desc: string; status: 'done' | 'progress' | 'planned' }) {
  const dotColor = status === 'done' ? 'bg-emerald-500' : status === 'progress' ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-start gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-on-surface"><code className="text-primary bg-primary/5 px-1 rounded">{label}</code></p>
        <p className="text-xs text-on-surface-variant">{desc}</p>
      </div>
    </div>
  );
}

function VaultFileRow({ path: filePath, label }: { path: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
      <FileText className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">{label}</span>
      <span className="text-[10px] text-on-surface-variant/60 truncate flex-shrink-0">{filePath}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResumeMe() {
  // API state
  const [data, setData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // File modal state
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // Horizon state
  const [activeHorizon, setActiveHorizon] = useState<HorizonKey>('week');

  // Check-in state (voice-first)
  const [checkin, setCheckin] = useState<CheckinState>({ ...EMPTY_CHECKIN });
  const [messages, setMessages] = useState<Message[]>([]);
  const [draftText, setDraftText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/resume');
      const json = await res.json();
      setData(json);
    } catch {
      setError('Failed to load resume data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Start check-in on data load
  useEffect(() => {
    if (data && messages.length === 0) {
      setMessages([{ role: 'assistant', text: 'Tell me where you are this morning.' }]);
    }
  }, [data]);

  // Handle voice button click
  const handleVoiceClick = () => {
    setIsRecording(true);
    // Simulate a brief capture, then set placeholder draft
    setTimeout(() => {
      setIsRecording(false);
      setDraftText('Energy is OK. Sleep was good. Main constraint is work today.');
      if (draftRef.current) {
        draftRef.current.focus();
      }
    }, 1200);
  };

  // Handle send check-in
  const handleSendCheckin = async () => {
    const text = draftText.trim();
    if (!text) return;

    // Build the message pair
    const userMsg = { role: 'user' as const, text };
    const ackMsg = { role: 'assistant' as const, text: 'Got it. Today\'s brief is updated below.' };

    // Add user message to thread immediately
    setMessages(prev => [...prev, userMsg]);

    // Persist to vault transcript
    try {
      await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [userMsg] }),
      });
    } catch (err) {
      console.error('Transcript save failed:', err);
      // Non-blocking: brief still updates even if transcript fails
    }

    // Parse simple signals from draft text (basic keyword matching)
    const lower = text.toLowerCase();
    const parsed: Partial<CheckinState> = { extra: text };
    if (lower.includes('energy is low') || lower.includes('energy low')) parsed.energy = 'Low';
    else if (lower.includes('energy is good') || lower.includes('energy good')) parsed.energy = 'Good';
    else if (lower.includes('ok')) parsed.energy = 'OK';

    if (lower.includes('sleep was bad') || lower.includes('sleep bad')) parsed.sleep = 'Bad';
    else if (lower.includes('sleep was good') || lower.includes('sleep good')) parsed.sleep = 'Good';
    else if (lower.includes('ok')) parsed.sleep = 'OK';

    if (lower.includes('constraint') || lower.includes('main')) {
      const constraintKeywords: Record<string, string> = { time: 'Time', energy: 'Energy', family: 'Family', work: 'Work' };
      for (const [kw, val] of Object.entries(constraintKeywords)) {
        if (lower.includes(kw)) { parsed.constraint = val; break; }
      }
    }

    setCheckin(prev => ({ ...prev, ...parsed, completed: true }));

    setDraftText('');

    // Assistant ack — also persists to vault transcript
    setTimeout(() => {
      setMessages(prev => [...prev, ackMsg]);
      // Save the full exchange (user + assistant ack) to vault transcript
      persistTranscriptBatch([userMsg, ackMsg]);
    }, 150);
  };

  // Transcript-save wrapper for chip sends
  const persistTranscriptBatch = async (msgs: Message[]) => {
    try {
      await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });
    } catch {
      // Non-blocking
    }
  };

  // Handle chip tap (secondary quick input)
  const handleChip = async (key: keyof CheckinState, value: string) => {
    setCheckin(prev => ({ ...prev, [key]: value }));
    const chipMsg = { role: 'user' as const, text: `${key}: ${value}` };
    setMessages(prev => [...prev, chipMsg]);

    // Persist chip input
    persistTranscriptBatch([chipMsg]);

    // Check if all chips filled -> complete
    const updated = { ...checkin, [key]: value };
    const allFilled = QUICK_CHIPS.every(c => updated[c.key] !== null);
    if (allFilled) {
      setCheckin(prev => ({ ...prev, [key]: value, completed: true }));
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: 'Thanks — brief updated below.'
        }]);
      }, 150);
    }
  };

  // Handle keyboard submit in draft
  const handleDraftKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCheckin();
    }
  };

  // File handlers
  const handleFileClick = async (file: RecentFile) => {
    setContentLoading(true);
    setSelectedFile({ name: file.name, path: file.relativePath, relativePath: file.relativePath, size: 0, mtime: file.mtime });
    try {
      const res = await fetch(`/api/content/${encodeURIComponent(file.relativePath)}`);
      const json = await res.json();
      setFileContent(json);
    } catch {
      setFileContent(null);
    } finally {
      setContentLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  const handleStillMattersClick = async (item: StillMattersItem) => {
    setContentLoading(true);
    setSelectedFile({ name: item.path.split('/').pop() || '', path: item.path, relativePath: item.path, size: 0, mtime: Date.now() });
    try {
      const res = await fetch(`/api/content/${encodeURIComponent(item.path)}`);
      const json = await res.json();
      setFileContent(json);
    } catch {
      setFileContent(null);
    } finally {
      setContentLoading(false);
    }
  };

  const handleSourceClick = async (source: { label: string; path: string }) => {
    setContentLoading(true);
    setSelectedFile({ name: source.path.split('/').pop() || '', path: source.path, relativePath: source.path, size: 0, mtime: Date.now() });
    try {
      const res = await fetch(`/api/content/${encodeURIComponent(source.path)}`);
      const json = await res.json();
      setFileContent(json);
    } catch {
      setFileContent(null);
    } finally {
      setContentLoading(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
    if (diffH < 1) return `${Math.round(diffH * 60)}m ago`;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  };

  // Derived data
  const brief = data?.dailyBrief;
  const horizon = data?.horizons?.[activeHorizon];
  const adaptedBrief = brief && checkin.completed ? deriveAdaptedBrief(brief, checkin) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full overflow-auto" style={{ height: 'calc(100vh - 140px)' }}>
      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-sm text-on-surface-variant">Loading...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={fetchData} className="mt-3 text-sm text-primary hover:underline">Retry</button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto pb-8 px-2">
          {/* ============================================================= */}
          {/* SECTION 0: Morning Check-in (voice-first conversation) */}
          {/* ============================================================= */}
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-on-surface">Morning check-in</h2>
              {checkin.completed && (
                <button
                  onClick={() => {
                    setCheckin({ ...EMPTY_CHECKIN });
                    setMessages([{ role: 'assistant', text: 'Tell me where you are this morning.' }]);
                    setDraftText('');
                  }}
                  className="ml-auto text-xs text-on-surface-variant hover:text-primary transition-colors"
                >
                  Start over
                </button>
              )}
            </div>

            <div className="bg-surface border border-border rounded-lg">
              {/* Chat thread */}
              <div className="max-h-[240px] overflow-y-auto p-3 space-y-3">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <Bot className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-white rounded-tr-sm'
                          : 'bg-surface-variant text-on-surface rounded-tl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input area: voice-first */}
              {!checkin.completed && (
                <div className="border-t border-border p-3 space-y-3">
                  {/* Voice button row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleVoiceClick}
                      disabled={isRecording}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isRecording
                          ? 'bg-red-100 text-red-600 border border-red-300 animate-pulse'
                          : 'bg-surface-variant text-on-surface border border-border hover:border-primary hover:bg-hover'
                      }`}
                    >
                      <Mic className={`w-4 h-4 ${isRecording ? 'text-red-500' : ''}`} />
                      {isRecording ? 'Listening...' : 'Say your check-in'}
                    </button>
                    <span className="text-xs text-on-surface-variant">
                      Voice capture not wired yet — draft placeholder shown
                    </span>
                  </div>

                  {/* Editable draft box */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-on-surface-variant">Review before sending</label>
                    <textarea
                      ref={draftRef}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={handleDraftKeyDown}
                      placeholder="Speak or type where you are this morning — energy, sleep, mood, body, alcohol, main constraint..."
                      rows={3}
                      className="w-full text-sm px-3 py-2 bg-surface-variant border border-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/50 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-on-surface-variant">Sent check-ins saved to vault transcript. After sending, this will update today's draft plan.</p>
                      <button
                        onClick={handleSendCheckin}
                        disabled={!draftText.trim()}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </button>
                    </div>
                  </div>

                  {/* Quick chips (secondary) */}
                  <details className="text-xs">
                    <summary className="text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors select-none">
                      Quick signals (optional)
                    </summary>
                    <div className="mt-2 space-y-2">
                      {QUICK_CHIPS.map((chipGroup) => (
                        <div key={chipGroup.key} className="flex items-center gap-2">
                          <span className="text-on-surface-variant w-16 flex-shrink-0">{chipGroup.label}:</span>
                          <div className="flex flex-wrap gap-1">
                            {chipGroup.chips.map((chip) => {
                              const isSelected = checkin[chipGroup.key] === chip;
                              return (
                                <button
                                  key={chip}
                                  onClick={() => handleChip(chipGroup.key, chip)}
                                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                    isSelected
                                      ? 'bg-primary text-white border-primary'
                                      : 'bg-surface-variant text-on-surface-variant border-border hover:border-primary hover:text-on-surface'
                                  }`}
                                >
                                  {chip}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Check-in summary row */}
            {checkin.completed && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5 text-xs text-on-surface-variant">
                  {checkin.energy && <span className="px-2 py-0.5 bg-surface-variant rounded-full">Energy: {checkin.energy}</span>}
                  {checkin.sleep && <span className="px-2 py-0.5 bg-surface-variant rounded-full">Sleep: {checkin.sleep}</span>}
                  {checkin.mood && <span className="px-2 py-0.5 bg-surface-variant rounded-full">Mood: {checkin.mood}</span>}
                  {checkin.body && <span className="px-2 py-0.5 bg-surface-variant rounded-full">Body: {checkin.body}</span>}
                  {checkin.alcohol && <span className="px-2 py-0.5 bg-surface-variant rounded-full">Alcohol: {checkin.alcohol}</span>}
                  {checkin.constraint && <span className="px-2 py-0.5 bg-surface-variant rounded-full">Constraint: {checkin.constraint}</span>}
                </div>
              </div>
            )}
          </section>

          {/* ============================================================= */}
          {/* SECTION 1: Today Brief (adjusted by check-in) */}
          {/* ============================================================= */}
          {brief && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-500" />
                Today Brief
              </h2>

              {/* Orientation */}
              {(checkin.completed && adaptedBrief ? (
                <p className="text-sm text-on-surface leading-relaxed mb-3">{adaptedBrief.orientation}</p>
              ) : (
                <p className="text-sm text-on-surface-variant leading-relaxed mb-3 italic">
                  Complete the morning check-in to personalise your brief.
                </p>
              ))}

              {/* 3 priority cards */}
              {checkin.completed && adaptedBrief && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Do first</span>
                    </div>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-snug">{adaptedBrief.doFirst}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Keep in mind</span>
                    </div>
                    <p className="text-sm text-amber-800 dark:text-amber-200 leading-snug">{adaptedBrief.keepInMind}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Hourglass className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Can wait</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{adaptedBrief.canWait}</p>
                  </div>
                </div>
              )}

              {/* Today's Draft Plan */}
              {checkin.completed && adaptedBrief && adaptedBrief.draftPlan.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {adaptedBrief.draftPlan.map((plan, idx) => {
                    const icon = AREA_ICONS[plan.area] || <FileText className="w-3.5 h-3.5 text-slate-500" />;
                    return (
                      <div key={idx} className="bg-surface border border-border rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">{icon}</div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-0.5">{plan.area}</p>
                            <p className="text-sm text-on-surface leading-snug">{plan.item}</p>
                            {plan.rationale && <p className="text-xs text-on-surface-variant mt-1 italic">{plan.rationale}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ============================================================= */}
          {/* SECTION 2: Day Map / Today Schedule */}
          {/* ============================================================= */}
          {brief && brief.dayMap && brief.dayMap.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-500" />
                Day Map
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {brief.dayMap.map((block, idx) => {
                  const kindColors: Record<string, { bg: string; border: string; dot: string }> = {
                    'check-in': { bg: 'bg-primary/5', border: 'border-primary/20', dot: 'bg-primary' },
                    work: { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
                    health: { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
                    food: { bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
                    family: { bg: 'bg-rose-50 dark:bg-rose-900/10', border: 'border-rose-200 dark:border-rose-800', dot: 'bg-rose-500' },
                    admin: { bg: 'bg-slate-50 dark:bg-slate-900/10', border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-500' },
                    recovery: { bg: 'bg-sky-50 dark:bg-sky-900/10', border: 'border-sky-200 dark:border-sky-800', dot: 'bg-sky-500' },
                  };
                  const colors = kindColors[block.kind] || kindColors.admin;
                  return (
                    <div
                      key={idx}
                      className={`${colors.bg} ${colors.border} border rounded-lg p-3`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${colors.dot} mt-1.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-on-surface">{block.label}</p>
                            {block.timeHint && (
                              <span className="text-[10px] text-on-surface-variant bg-surface/60 px-1.5 py-0.5 rounded">
                                {block.timeHint}
                              </span>
                            )}
                            {block.flexible && (
                              <span className="text-[10px] text-on-surface-variant italic">flexible</span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{block.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ============================================================= */}
          {/* SECTION 4: What changed since yesterday */}
          {/* ============================================================= */}
          {brief && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500" />
                What changed since yesterday
              </h2>
              <div className="bg-surface border border-border rounded-lg p-3">
                <p className="text-sm text-on-surface leading-relaxed">{brief.changedSinceYesterday}</p>
              </div>
            </section>
          )}

          {/* ============================================================= */}
          {/* SECTION 5: Longer-term direction */}
          {/* ============================================================= */}
          <details className="mb-6">
            <summary className="text-xs font-medium text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors select-none">
              Longer-term direction &amp; evidence
            </summary>
            <div className="mt-3">
              <div className="flex items-center gap-1 mb-3 border-b border-border pb-0.5">
                {HORIZON_KEYS.slice(1).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveHorizon(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
                      activeHorizon === key
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
                    }`}
                  >
                    {HORIZON_ICONS[key]}
                    {HORIZON_LABELS[key]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  {horizon && (
                    <section>
                      <h2 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                        <Sunrise className="w-4 h-4 text-violet-500" />
                        Direction — {HORIZON_LABELS[activeHorizon]}
                      </h2>
                      <div className="bg-surface border border-border rounded-lg p-3 space-y-2">
                        <p className="text-sm text-on-surface leading-relaxed">{horizon.body}</p>
                        {horizon.items.length > 0 && (
                          <ul className="space-y-1">
                            {horizon.items.map((item, idx) => (
                              <li key={idx} className="text-xs text-on-surface-variant flex items-start gap-1.5">
                                <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {horizon.source && (
                          <button onClick={() => handleSourceClick(horizon.source!)} className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors pt-1">
                            <ExternalLink className="w-3 h-3" />
                            {horizon.source.label}
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {data?.currentState && data.currentState.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-on-surface-variant" />
                        Current State
                      </h2>
                      <div className="space-y-2">
                        {data.currentState.map((item, idx) => (
                          <div key={idx} className="bg-surface border border-border rounded-lg p-3 flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-on-surface">{item.label}</p>
                              <p className="text-xs text-on-surface-variant mt-0.5">{item.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <div className="space-y-4">
                  {data?.stillMatters && data.stillMatters.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-amber-500" />
                        Still Matters
                      </h2>
                      <div className="space-y-1.5">
                        {data.stillMatters.map((item, idx) => (
                          <div key={idx} className="bg-surface border border-border rounded-lg p-2.5 cursor-pointer hover:bg-hover transition-colors" onClick={() => handleStillMattersClick(item)}>
                            <div className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-on-surface truncate leading-snug">{item.title}</p>
                                <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{item.reason}</p>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0 mt-0.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {data?.recentChanges && data.recentChanges.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-500" />
                        Recent Changes
                      </h2>
                      <div className="space-y-0.5">
                        {data.recentChanges.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-hover cursor-pointer transition-colors" onClick={() => handleFileClick(file)}>
                            <FileText className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-on-surface truncate leading-snug">{file.title}</p>
                              <p className="text-xs text-on-surface-variant truncate">{file.relativePath}</p>
                            </div>
                            <span className="text-xs text-on-surface-variant flex-shrink-0">{formatDate(file.mtime)}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </details>

          {/* ============================================================= */}
          {/* SECTION 6: Implementation Log / Roadmap Status */}
          {/* ============================================================= */}
          <details className="mb-6">
            <summary className="text-xs font-medium text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors select-none">
              Roadmap / Agent Work
            </summary>
            <div className="mt-3 space-y-3">
              <div className="bg-surface border border-border rounded-lg p-3">
                <h3 className="text-xs font-semibold text-on-surface mb-2">This is the prototype surface</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                  All new dashboard features are being tested here before they go mobile.
                  The future target is a native mobile app with morning notifications and
                  voice-first check-in. The contract for that app lives at <code className="text-primary bg-primary/5 px-1 rounded">/api/today</code>.
                </p>

                <h4 className="text-xs font-semibold text-on-surface mb-1.5">Recent implementation</h4>
                <div className="space-y-1.5">
                  <EndpointRow
                    label="GET /api/today"
                    desc="Mobile Today Brief contract"
                    status="done"
                  />
                  <EndpointRow
                    label="POST /api/transcript"
                    desc="Raw vault transcript persistence"
                    status="done"
                  />
                  <EndpointRow
                    label="Morning check-in"
                    desc="Voice-first UI prototype with draft edit + send"
                    status="done"
                  />
                  <EndpointRow
                    label="Day Map"
                    desc="6-block schedule (work, food, recovery, family, admin)"
                    status="done"
                  />
                  <EndpointRow
                    label="Raw chat capture"
                    desc="Append-only transcript under raw/YYYY/MM/"
                    status="done"
                  />
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg p-3">
                <h4 className="text-xs font-semibold text-on-surface mb-1.5">Source of truth files in vault</h4>
                <div className="space-y-1">
                  <VaultFileRow
                    path="structured/strategies/personal-assistant-rolling-strategy.md"
                    label="Rolling product strategy"
                  />
                  <VaultFileRow
                    path="structured/plans/2026-05-24-mobile-today-brief-roadmap.md"
                    label="Mobile Today Brief roadmap"
                  />
                  <VaultFileRow
                    path="structured/decisions/2026-05-24-morning-resurfacing-and-calendar.md"
                    label="Morning resurfacing decision"
                  />
                  <VaultFileRow
                    path="structured/decisions/2026-05-24-personal-vault-chat-raw-capture.md"
                    label="Raw chat capture decision"
                  />
                  <VaultFileRow
                    path="raw/2026/05/2026-05-24-mobile-resurfacing-app-discussion.md"
                    label="Raw mobile discussion evidence"
                  />
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg p-3">
                <h4 className="text-xs font-semibold text-on-surface mb-1.5">Next (not started)</h4>
                <div className="space-y-1">
                  <span className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                    Mobile shell scaffold (React Native / Expo)
                  </span>
                  <span className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                    Notification permission + local schedule
                  </span>
                  <span className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                    Real STT voice capture
                  </span>
                  <span className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                    Apple Health / HealthKit integration
                  </span>
                </div>
              </div>
            </div>
          </details>

          {/* Footer */}
          {data?.updatedAt && (
            <div className="text-xs text-on-surface-variant text-center mt-4 pt-4 border-t border-border">
              Updated {new Date(data.updatedAt).toLocaleString('en-AU')}
            </div>
          )}
        </div>
      )}

      <MarkdownModal
        file={selectedFile}
        content={fileContent}
        loading={contentLoading}
        onClose={handleCloseModal}
      />
    </div>
  );
}
