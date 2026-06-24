'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Circle,
  Dumbbell,
  Folder,
  HeartPulse,
  MessageSquareText,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

interface PlannerTask {
  id: string;
  title: string;
  area: 'Product' | 'Health' | 'Family' | 'Admin';
  status: 'suggested' | 'planned' | 'done';
  source: string;
}

interface PlannerProjection {
  title: string;
  weekFocus: string;
  generatedFrom: string[];
  tasks: PlannerTask[];
}

interface ResumeData {
  dailyBrief?: {
    doFirst: string;
    keepInMind: string;
    canWait: string;
    changedSinceYesterday: string;
  };
  currentState?: Array<{ label: string; status: string }>;
}

interface HealthToday {
  updatedAt: string;
  activeProject: {
    id: string;
    title: string;
    status: string;
    phase: string;
    sourcePath: string | null;
  };
  today: {
    title: string;
    primaryAction: string;
    details: string[];
    avoid: string[];
    progressionRule: string;
  };
  lastWorkout: string | null;
  openQuestions: string[];
}

interface RehabDay {
  day: number;
  date: string;
  label: string;
  kind: string;
  title: string;
  plan: string;
}

interface RehabPlan {
  title: string;
  todayDate: string;
  today: RehabDay | null;
}

interface PublishingDay {
  day: number;
  date: string;
  label: string;
  kind: string;
  title: string;
  plan: string;
  output: string;
}

interface PublishingPlan {
  title: string;
  todayDate: string;
  today: PublishingDay | null;
  upcoming: PublishingDay | null;
}

interface TimelineBlock {
  time: string;
  title: string;
  body: string;
type: 'checkin' | 'focus' | 'health' | 'family' | 'admin';
}

interface ProjectContext {
  id: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  next: string;
  signal: string;
}

const baselineTimeline: TimelineBlock[] = [
  {
    time: 'Morning',
    title: 'Check in',
    body: 'Energy, sleep, body, mood, main constraint.',
    type: 'checkin',
  },
  {
    time: 'First block',
    title: 'Product focus',
    body: 'One dashboard/vault task, small enough to finish.',
    type: 'focus',
  },
  {
    time: 'Midday',
    title: 'Food / movement',
    body: 'Protein, hydration, walk or training baseline.',
    type: 'health',
  },
  {
    time: 'Afternoon',
    title: 'Family / life buffer',
    body: 'Keep life context visible before adding more work.',
    type: 'family',
  },
  {
    time: 'End',
    title: 'Close loops',
    body: 'Capture what changed, update vault, stop cleanly.',
    type: 'admin',
  },
];

const projectContexts: ProjectContext[] = [
  {
    id: 'health',
    title: 'Health',
    icon: <HeartPulse className="h-4 w-4" />,
    summary: 'Energy, food, training, recovery, alcohol guardrails.',
    next: 'Keep the day plan physically realistic.',
    signal: 'Baseline',
  },
  {
    id: 'business',
    title: 'Business',
    icon: <BriefcaseBusiness className="h-4 w-4" />,
    summary: 'Product execution and personal operating system work.',
    next: 'Ship one visible dashboard improvement.',
    signal: 'Active',
  },
  {
    id: 'ai',
    title: 'AI',
    icon: <Sparkles className="h-4 w-4" />,
    summary: 'Vault extraction, summarization, API/MCP boundaries.',
    next: 'Turn chat context into planner projection.',
    signal: 'Design',
  },
  {
    id: 'family',
    title: 'Family',
    icon: <Users className="h-4 w-4" />,
    summary: 'Life context that should not disappear behind work tasks.',
    next: 'Keep visible in Today before task overload.',
    signal: 'Visible',
  },
  {
    id: 'wealth',
    title: 'Wealth',
    icon: <TrendingUp className="h-4 w-4" />,
    summary: 'Investing, trading, risk, long-term financial context.',
    next: 'Summaries only until source notes are clearer.',
    signal: 'Waiting',
  },
  {
    id: 'routine',
    title: 'Routine',
    icon: <Activity className="h-4 w-4" />,
    summary: 'Repeated actions that keep the day stable.',
    next: 'Anchor check-in, focus block, health block.',
    signal: 'Daily',
  },
];

const typeColor: Record<TimelineBlock['type'], string> = {
  checkin: 'border-blue-400 bg-blue-500/10 text-blue-300',
  focus: 'border-emerald-400 bg-emerald-500/10 text-emerald-300',
  health: 'border-amber-400 bg-amber-500/10 text-amber-300',
  family: 'border-rose-400 bg-rose-500/10 text-rose-300',
  admin: 'border-slate-400 bg-slate-500/10 text-slate-300',
};

const areaIcon: Record<PlannerTask['area'], React.ReactNode> = {
  Product: <Target className="h-4 w-4 text-emerald-400" />,
  Health: <Dumbbell className="h-4 w-4 text-amber-400" />,
  Family: <Users className="h-4 w-4 text-rose-400" />,
  Admin: <Folder className="h-4 w-4 text-slate-400" />,
};

export default function TodayView() {
  const [planner, setPlanner] = useState<PlannerProjection | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [health, setHealth] = useState<HealthToday | null>(null);
  const [healthPlan, setHealthPlan] = useState<RehabPlan | null>(null);
  const [publishingPlan, setPublishingPlan] = useState<PublishingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [captureText, setCaptureText] = useState('');
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    Promise.all([
      fetch('/api/planner').then((res) => res.json()),
      fetch('/api/resume').then((res) => res.json()).catch(() => null),
      fetch('/api/health/today').then((res) => res.json()).catch(() => null),
      fetch('/api/health/project').then((res) => res.json()).catch(() => null),
      fetch('/api/projects/ai-publishing').then((res) => res.json()).catch(() => null),
    ])
      .then(([plannerData, resumeData, healthData, healthPlanData, publishingPlanData]) => {
        setPlanner(plannerData);
        setResume(resumeData);
        setHealth(healthData);
        setHealthPlan(healthPlanData);
        setPublishingPlan(publishingPlanData);
      })
      .finally(() => setLoading(false));
  }, []);

  const plannedTasks = useMemo(() => planner?.tasks ?? [], [planner]);
  const primaryTask = plannedTasks[0];
  const healthDay = healthPlan?.today ?? null;
  const healthLink = healthDay ? `/?view=health&day=${healthDay.day}` : '/?view=health';
  const publishingDay = publishingPlan?.today ?? publishingPlan?.upcoming ?? null;
  const publishingIsToday = Boolean(publishingPlan?.today);
  const publishingLink = '/?view=project&project=ai';
  const dayTimeline = useMemo(() => {
    let blocks = baselineTimeline;
    if (publishingDay) {
      blocks = blocks.map((block) => (
        block.type === 'focus'
          ? {
              ...block,
              title: `${publishingIsToday ? 'AI publishing' : 'Tomorrow'}: ${publishingDay.title}`,
              body: publishingDay.plan,
            }
          : block
      ));
    }
    if (!healthDay) return blocks;
    return blocks.map((block) => (
      block.type === 'health'
        ? {
            ...block,
            title: `Health: ${healthDay.title}`,
            body: healthDay.plan,
          }
        : block
    ));
  }, [healthDay, publishingDay, publishingIsToday]);

  const saveCapture = async () => {
    const input = captureText.trim();
    if (!input) return;

    setCaptureStatus('saving');
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          source: 'manual',
          metadata: { surface: 'today-check-in' },
        }),
      });

      if (!res.ok) throw new Error('Capture failed');
      setCaptureText('');
      setCaptureStatus('saved');
      window.setTimeout(() => setCaptureStatus('idle'), 2500);
    } catch {
      setCaptureStatus('error');
    }
  };

  const applyCheckInPreset = (text: string) => {
    setCaptureText(text);
    if (captureStatus !== 'idle') setCaptureStatus('idle');
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-on-surface-variant">
        Loading today...
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[1440px] flex-col gap-4 pb-8">
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <CalendarDays className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wide">Today</span>
              </div>
              <h2 className="text-xl font-semibold text-on-surface">Day map</h2>
              <p className="text-sm text-on-surface-variant">Use the plan unless your state changed.</p>
            </div>
            <span className="rounded-lg border border-border bg-surface-variant px-3 py-1.5 text-xs text-on-surface-variant">
              flexible draft
            </span>
          </div>

          <div className="space-y-3">
            {dayTimeline.map((block) => (
              <div key={`${block.time}-${block.title}`} className="grid grid-cols-[88px_1fr] gap-3">
                <div className="pt-3 text-xs font-medium text-on-surface-variant">{block.time}</div>
                <div className={`rounded-lg border p-3 ${typeColor[block.type]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface">{block.title}</h4>
                      <p className="mt-1 text-sm text-on-surface-variant">{block.body}</p>
                    </div>
                    {block.type === 'focus' && publishingDay ? (
                      <a
                        href={publishingLink}
                        className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-primary hover:bg-active"
                      >
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    ) : block.type === 'health' && healthDay ? (
                      <a
                        href={healthLink}
                        className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-primary hover:bg-active"
                      >
                        Open
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 text-on-surface-variant" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-border bg-surface p-3 shadow-sm">
            <details>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-primary" />
                    <div>
                      <h3 className="text-sm font-semibold text-on-surface">Optional check-in</h3>
                      <p className="text-xs text-on-surface-variant">Use only if the day needs replanning.</p>
                    </div>
                  </div>
                  <span className="rounded border border-border bg-surface-variant px-2 py-1 text-xs text-on-surface-variant">
                    adjust
                  </span>
                </div>
              </summary>
              <div className="mt-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => applyCheckInPreset('Move today one day forward. I am not in the right state to execute this plan today.')}
                    className="rounded border border-border bg-surface-variant px-2 py-1 text-xs text-on-surface-variant hover:bg-hover"
                  >
                    Move today +1
                  </button>
                  <button
                    onClick={() => applyCheckInPreset('Move this week forward. I need a recovery/reset period before continuing the current plan.')}
                    className="rounded border border-border bg-surface-variant px-2 py-1 text-xs text-on-surface-variant hover:bg-hover"
                  >
                    Move week
                  </button>
                  <button
                    onClick={() => applyCheckInPreset('Rest day. Keep only health minimums and capture what changed.')}
                    className="rounded border border-border bg-surface-variant px-2 py-1 text-xs text-on-surface-variant hover:bg-hover"
                  >
                    Rest day
                  </button>
                </div>
                <textarea
                  value={captureText}
                  onChange={(event) => {
                    setCaptureText(event.target.value);
                    if (captureStatus !== 'idle') setCaptureStatus('idle');
                  }}
                  rows={3}
                  placeholder="What changed? Energy, sleep, body, mood, main constraint..."
                  className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-on-surface-variant">
                    {captureStatus === 'saved' && 'Saved to vault inbox.'}
                    {captureStatus === 'error' && 'Save failed.'}
                  </span>
                  <button
                    onClick={saveCapture}
                    disabled={!captureText.trim() || captureStatus === 'saving'}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {captureStatus === 'saving' ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </details>
          </section>

          {publishingDay && (
            <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-on-surface">
                    {publishingIsToday ? 'AI publishing today' : 'AI publishing tomorrow'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">{publishingPlan?.title}</p>
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      Day {publishingDay.day}: {publishingDay.title}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">{publishingDay.plan}</p>
                  </div>
                  <a
                    href={publishingLink}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-blue-200 bg-surface px-2 py-1 text-xs font-medium text-primary hover:bg-active"
                  >
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Output</p>
                <p className="mt-1 text-sm text-on-surface-variant">{publishingDay.output}</p>
              </div>
            </section>
          )}

          {health && (
            <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-rose-500" />
                <div>
                  <h3 className="text-base font-semibold text-on-surface">Health commitment</h3>
                  <p className="text-xs text-on-surface-variant">{health.activeProject.title} / {health.activeProject.status}</p>
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {healthDay ? `Day ${healthDay.day}: ${healthDay.title}` : health.today.primaryAction}
                    </p>
                    {healthDay && (
                      <p className="mt-1 text-sm text-on-surface-variant">{healthDay.plan}</p>
                    )}
                  </div>
                  <a
                    href={healthLink}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-rose-200 bg-surface px-2 py-1 text-xs font-medium text-primary hover:bg-active"
                  >
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
                <ul className="mt-2 space-y-1">
                  {(healthDay ? healthDay.plan.split(';').map((item) => item.trim()).filter(Boolean) : health.today.details).slice(0, 4).map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-on-surface-variant">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Avoid today</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {health.today.avoid.slice(0, 6).map((item) => (
                    <span key={item} className="rounded border border-border bg-surface-variant px-2 py-1 text-xs text-on-surface-variant">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{health.today.progressionRule}</p>
            </section>
          )}

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-base font-semibold text-on-surface">Today / week tasks</h3>
            </div>
            <div className="space-y-2">
              {plannedTasks.map((task) => (
                <article key={task.id} className="rounded-lg border border-border bg-surface-variant p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{areaIcon[task.area]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 text-xs text-on-surface-variant">
                        <span>{task.area}</span>
                        <span>/</span>
                        <span>{task.status}</span>
                      </div>
                      <p className="text-sm font-medium leading-snug text-on-surface">{task.title}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-base font-semibold text-on-surface">What changed</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              {resume?.dailyBrief?.changedSinceYesterday ?? 'Recent vault changes will be summarized here.'}
            </p>
          </section>
        </aside>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Projects and life areas</h3>
            <p className="text-sm text-on-surface-variant">Context buckets from the vault. These become project pages later.</p>
          </div>
          <button className="rounded-lg border border-border px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-variant">
            New project
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projectContexts.map((project) => (
            <article key={project.id} className="rounded-lg border border-border bg-surface-variant p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-primary">{project.icon}</span>
                  <h4 className="text-sm font-semibold text-on-surface">{project.title}</h4>
                </div>
                <span className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-on-surface-variant">
                  {project.signal}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant">{project.summary}</p>
              <p className="mt-3 text-sm font-medium text-on-surface">{project.next}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
