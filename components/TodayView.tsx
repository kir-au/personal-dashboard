'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Folder,
  HeartPulse,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

interface PlannerTask {
  id: string;
  title: string;
  area: 'Product' | 'Health' | 'Family' | 'Admin' | 'AI' | 'Business' | 'Wealth' | 'Routine';
  status: 'suggested' | 'planned' | 'done' | 'review';
  source: string;
  date?: string;
  horizon?: string;
  projectId?: string;
  priority?: number;
  detail?: string;
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

interface HealthActivity {
  code: string;
  name: string;
  durationMin?: number | null;
  distanceKm?: number | null;
  pace?: string;
  load?: string | null;
  reps?: number | null;
  estimatedCalories?: number | null;
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
  todayActivity?: {
    date: string;
    loggedAt: string;
    status: string;
    summary: string;
    rawPath?: string;
    activities?: HealthActivity[];
    calories?: {
      method?: string;
      bodyWeightKg?: number;
      totalEstimatedCalories?: number;
      assumptions?: string[];
    };
    openQuestions?: string[];
  };
}

interface RehabDay {
  day: number;
  date: string;
  label: string;
  kind: string;
  title: string;
  plan: string;
  completed?: boolean;
  completionStatus?: 'partial' | 'completed';
  actual?: {
    summary?: string;
    completed?: Array<{
      code: string;
      name: string;
      load: string | null;
      sets: number | null;
      reps: number | null;
    }>;
    remaining?: string[];
  };
}

interface RehabPlan {
  title: string;
  todayDate: string;
  today: RehabDay | null;
  days?: RehabDay[];
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
  days?: PublishingDay[];
}

interface ProjectContext {
  id: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  next: string;
  signal: string;
}

interface AssistantReviewCard {
  projectId: string;
  projectTitle: string;
  status: 'active' | 'needs-review' | 'watch' | 'reference';
  priority: number;
  title: string;
  reason: string;
  suggestedAction: string;
  evidencePath?: string;
  evidenceLabel?: string;
  recentCaptures: number;
  linkedSources: number;
}

interface AssistantReview {
  updatedAt: string;
  windowDays: number;
  source: string;
  cards: AssistantReviewCard[];
}

function formatDashboardDate(dateValue?: string | null) {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();

  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getSydneyDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getInitialSelectedDate() {
  if (typeof window === 'undefined') return getSydneyDate();
  return new URLSearchParams(window.location.search).get('date') || getSydneyDate();
}

function addDays(dateValue: string, offset: number) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function minDate(values: string[]) {
  return values.reduce((min, value) => (value < min ? value : min), values[0]);
}

function maxDate(values: string[]) {
  return values.reduce((max, value) => (value > max ? value : max), values[0]);
}

function formatRelativeDay(dateValue: string, todayValue: string) {
  const diff = Math.round(
    (new Date(`${dateValue}T00:00:00`).getTime() - new Date(`${todayValue}T00:00:00`).getTime()) /
      86_400_000
  );

  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `In ${diff} days`;
}

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

const areaIcon: Record<PlannerTask['area'], React.ReactNode> = {
  Product: <Target className="h-4 w-4 text-emerald-400" />,
  Health: <Dumbbell className="h-4 w-4 text-amber-400" />,
  Family: <Users className="h-4 w-4 text-rose-400" />,
  Admin: <Folder className="h-4 w-4 text-slate-400" />,
  AI: <Sparkles className="h-4 w-4 text-blue-500" />,
  Business: <BriefcaseBusiness className="h-4 w-4 text-emerald-500" />,
  Wealth: <TrendingUp className="h-4 w-4 text-violet-500" />,
  Routine: <Activity className="h-4 w-4 text-cyan-500" />,
};

const reviewStatusLabel: Record<AssistantReviewCard['status'], string> = {
  active: 'active',
  'needs-review': 'review',
  watch: 'watch',
  reference: 'reference',
};

const agendaRowClass: Record<PlannerTask['status'], string> = {
  done: 'border-l-4 border-l-emerald-500 bg-emerald-50',
  planned: 'border-l-4 border-l-blue-500 bg-blue-50',
  suggested: 'border-l-4 border-l-amber-500 bg-amber-50',
  review: 'border-l-4 border-l-violet-500 bg-violet-50',
};

const agendaStatusClass: Record<PlannerTask['status'], string> = {
  done: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  planned: 'border-blue-200 bg-blue-100 text-blue-800',
  suggested: 'border-amber-200 bg-amber-100 text-amber-800',
  review: 'border-violet-200 bg-violet-100 text-violet-800',
};

function iconForProject(projectId: string) {
  if (projectId === 'health') return <HeartPulse className="h-4 w-4" />;
  if (projectId === 'business') return <BriefcaseBusiness className="h-4 w-4" />;
  if (projectId === 'ai') return <Sparkles className="h-4 w-4" />;
  if (projectId === 'family') return <Users className="h-4 w-4" />;
  if (projectId === 'wealth') return <TrendingUp className="h-4 w-4" />;
  if (projectId === 'routine') return <Activity className="h-4 w-4" />;
  return <Folder className="h-4 w-4" />;
}

function projectHref(projectId?: string) {
  if (!projectId) return undefined;
  if (projectId === 'health') return '/?view=health';
  return `/?view=project&project=${encodeURIComponent(projectId)}`;
}

export default function TodayView() {
  const [planner, setPlanner] = useState<PlannerProjection | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [health, setHealth] = useState<HealthToday | null>(null);
  const [healthPlan, setHealthPlan] = useState<RehabPlan | null>(null);
  const [publishingPlan, setPublishingPlan] = useState<PublishingPlan | null>(null);
  const [assistantReview, setAssistantReview] = useState<AssistantReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectCreateStatus, setProjectCreateStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialSelectedDate());

  useEffect(() => {
    let cancelled = false;

    const loadToday = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      const fetchOptions: RequestInit = { cache: 'no-store' };
      const cacheBust = `t=${Date.now()}`;

      const [plannerData, resumeData, healthData, healthPlanData, publishingPlanData, assistantReviewData] = await Promise.all([
        fetch(`/api/planner?${cacheBust}`, fetchOptions).then((res) => res.json()),
        fetch(`/api/resume?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
        fetch(`/api/health/today?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
        fetch(`/api/health/project?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
        fetch(`/api/projects/ai-publishing?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
        fetch(`/api/assistant/review?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
      ]);

      if (!cancelled) {
        setPlanner(plannerData);
        setResume(resumeData);
        setHealth(healthData);
        setHealthPlan(healthPlanData);
        setPublishingPlan(publishingPlanData);
        setAssistantReview(assistantReviewData);
        setLoading(false);
      }
    };

    loadToday(true).catch(() => {
      if (!cancelled) setLoading(false);
    });

    const refreshOnFocus = () => {
      loadToday(false).catch(() => {});
    };
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refreshOnFocus();
    };
    const refreshOnProjectionChange = () => {
      loadToday(false).catch(() => {});
    };
    const interval = window.setInterval(refreshOnFocus, 5 * 60 * 1000);

    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('planner-projection-changed', refreshOnProjectionChange);
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('planner-projection-changed', refreshOnProjectionChange);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, []);

  useEffect(() => {
    const syncDateFromUrl = () => setSelectedDate(getInitialSelectedDate());
    window.addEventListener('popstate', syncDateFromUrl);
    return () => window.removeEventListener('popstate', syncDateFromUrl);
  }, []);

  const plannedTasks = useMemo(() => {
    const tasks = planner?.tasks ?? [];
    const exact = tasks.filter((task) => task.date === selectedDate);
    if (exact.length > 0) return exact.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return tasks
      .filter((task) => !task.date && task.horizon !== 'this-week')
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [planner, selectedDate]);
  const reviewTasks = useMemo(
    () => (planner?.tasks ?? [])
      .filter((task) => task.horizon === 'this-week' || task.status === 'review')
      .filter((task) => task.date !== selectedDate)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(0, 4),
    [planner, selectedDate]
  );
  const todayDate = healthPlan?.todayDate ?? publishingPlan?.todayDate ?? getSydneyDate();
  const healthDay = healthPlan?.days?.find((day) => day.date === selectedDate) ?? null;
  const healthLink = healthDay ? `/?view=health&day=${healthDay.day}` : '/?view=health';
  const publishingDay =
    publishingPlan?.days?.find((day) => day.date === selectedDate) ??
    (selectedDate === todayDate ? publishingPlan?.upcoming ?? null : null);
  const publishingLink = '/?view=project&project=ai';
  const dashboardDate = useMemo(
    () => formatDashboardDate(selectedDate),
    [selectedDate]
  );
  const dateBounds = useMemo(() => {
    const dates = [
      addDays(todayDate, -14),
      addDays(todayDate, 14),
      ...(healthPlan?.days?.map((day) => day.date) ?? []),
      ...(publishingPlan?.days?.map((day) => day.date) ?? []),
    ];

    return {
      min: minDate(dates),
      max: maxDate(dates),
    };
  }, [healthPlan?.days, publishingPlan?.days, todayDate]);
  const canGoPrevious = selectedDate > dateBounds.min;
  const canGoNext = selectedDate < dateBounds.max;
  const relativeDayLabel = formatRelativeDay(selectedDate, todayDate);
  const dateNavButtonClass =
    'inline-flex h-7 min-w-[68px] items-center justify-center gap-1 rounded border border-border bg-surface px-2 text-xs font-medium text-on-surface-variant hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40';
  const navigateDate = (dateValue: string) => {
    setSelectedDate(dateValue);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    url.searchParams.set('date', dateValue);
    window.history.pushState(null, '', url.toString());
  };
  const createProject = async () => {
    const title = window.prompt('New project name');
    if (!title?.trim()) return;

    setProjectCreateStatus('saving');
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to create project');
      window.dispatchEvent(new Event('projects-changed'));
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'project');
      url.searchParams.set('project', data.project.id);
      window.history.replaceState(null, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
      setProjectCreateStatus('idle');
    } catch {
      setProjectCreateStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-on-surface-variant">
        Loading today...
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-none min-w-0 flex-col gap-4 overflow-hidden pb-8">
      <div className="grid w-full max-w-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex w-full max-w-full min-w-0 flex-col gap-4">
          <section className="w-full max-w-full min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-primary">
                  <CalendarDays className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">{relativeDayLabel}</span>
                  <span className="rounded border border-primary/20 bg-active px-2 py-0.5 text-xs font-medium text-primary">
                    {dashboardDate}
                  </span>
                  <div className="ml-0 flex flex-wrap items-center gap-1.5 sm:ml-2">
                    <button
                      type="button"
                      onClick={() => navigateDate(addDays(selectedDate, -1))}
                      disabled={!canGoPrevious}
                      className={dateNavButtonClass}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateDate(todayDate)}
                      disabled={selectedDate === todayDate}
                      className={dateNavButtonClass}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateDate(addDays(selectedDate, 1))}
                      disabled={!canGoNext}
                      className={dateNavButtonClass}
                    >
                      Next
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-on-surface">Today console</h2>
                <p className="text-sm text-on-surface-variant">What changed, what is planned, and what needs a decision.</p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-border bg-surface-variant p-3">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h3 className="text-base font-semibold text-on-surface">{relativeDayLabel} agenda</h3>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {plannedTasks.map((task) => {
                  const href = projectHref(task.projectId);
                  return (
                    <article key={task.id} className={`grid gap-3 p-3 sm:grid-cols-[112px_minmax(0,1fr)] ${agendaRowClass[task.status]}`}>
                      <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant sm:block">
                        <div className="flex items-center gap-2 sm:mb-1">
                          {areaIcon[task.area]}
                          <span>{task.area}</span>
                        </div>
                        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${agendaStatusClass[task.status]}`}>
                          {task.status}
                        </span>
                      </div>
                      <div className="min-w-0">
                        {href ? (
                          <a href={href} className="text-sm font-semibold leading-snug text-on-surface hover:text-primary hover:underline">
                            {task.title}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold leading-snug text-on-surface">{task.title}</p>
                        )}
                        {task.detail ? (
                          <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{task.detail}</p>
                        ) : null}
                        <p className="mt-2 truncate text-xs text-on-surface-variant">{task.source}</p>
                      </div>
                    </article>
                  );
                })}
                {plannedTasks.length === 0 && (
                  <p className="p-3 text-sm text-on-surface-variant">No dated tasks selected for this day yet.</p>
                )}
              </div>
            </div>

            <div className="grid gap-3">
              {healthDay && (
                <article className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2 text-amber-700">
                        <Dumbbell className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Health plan</span>
                      </div>
                      <h3 className="text-base font-semibold text-on-surface">{healthDay.title}</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">{healthDay.plan}</p>
                    </div>
                    <a
                      href={healthLink}
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-active"
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </article>
              )}

              {publishingDay && (
                <article className="rounded-lg border border-blue-300 bg-blue-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2 text-blue-700">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">AI / product</span>
                      </div>
                      <h3 className="text-base font-semibold text-on-surface">{publishingDay.title}</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">{publishingDay.plan}</p>
                    </div>
                    <a
                      href={publishingLink}
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-active"
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </article>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-base font-semibold text-on-surface">What changed</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              {resume?.dailyBrief?.changedSinceYesterday ?? 'Recent vault changes will be summarized here.'}
            </p>
          </section>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Assistant actions</span>
                </div>
                <h3 className="text-base font-semibold text-on-surface">Proposed next moves</h3>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  Suggested from vault scan. Nothing is applied automatically.
                </p>
              </div>
              <span className="shrink-0 rounded border border-border bg-surface-variant px-2 py-1 text-xs text-on-surface-variant">
                {assistantReview?.windowDays ?? 30}d
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {reviewTasks.map((task) => {
                const href = projectHref(task.projectId);
                return (
                  <article key={task.id} className="rounded-lg border border-border bg-surface-variant p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-on-surface-variant">
                        {areaIcon[task.area]}
                        <span className="truncate">{task.area}</span>
                      </div>
                      <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${agendaStatusClass[task.status]}`}>
                        {task.status}
                      </span>
                    </div>
                    {href ? (
                      <a href={href} className="text-sm font-semibold leading-snug text-on-surface hover:text-primary hover:underline">
                        {task.title}
                      </a>
                    ) : (
                      <p className="text-sm font-semibold leading-snug text-on-surface">{task.title}</p>
                    )}
                    {task.detail ? <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{task.detail}</p> : null}
                  </article>
                );
              })}

              {(assistantReview?.cards ?? []).map((card) => (
                <article key={card.projectId} className="rounded-lg border border-border bg-surface-variant p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-primary">{iconForProject(card.projectId)}</span>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-on-surface">{card.projectTitle}</h4>
                        <p className="text-xs text-on-surface-variant">
                          {card.recentCaptures} capture(s) / {card.linkedSources} source(s)
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded border border-border bg-surface px-2 py-0.5 text-xs text-on-surface-variant">
                      {reviewStatusLabel[card.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug text-on-surface">{card.suggestedAction}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">{card.reason}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={projectHref(card.projectId) ?? '/?view=today'}
                      className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-primary hover:bg-active"
                    >
                      Open project
                      <ArrowRight className="h-3 w-3" />
                    </a>
                    {card.evidencePath ? (
                      <a
                        href={`/?view=vault&path=${encodeURIComponent(card.evidencePath)}`}
                        className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-on-surface-variant hover:text-primary hover:underline"
                      >
                        <span className="truncate">{card.evidenceLabel || 'Evidence'}</span>
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}

              {reviewTasks.length === 0 && (assistantReview?.cards ?? []).length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-variant p-3 text-sm text-on-surface-variant">
                  No assistant actions are waiting.
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Projects and life areas</h3>
            <p className="text-sm text-on-surface-variant">Context buckets from the vault. These become project pages later.</p>
          </div>
          <button
            onClick={createProject}
            disabled={projectCreateStatus === 'saving'}
            className="rounded-lg border border-border px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-variant disabled:opacity-50"
          >
            {projectCreateStatus === 'saving' ? 'Creating...' : 'New project'}
          </button>
        </div>
        {projectCreateStatus === 'error' && (
          <p className="mb-3 text-sm text-error">Could not create project.</p>
        )}
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
