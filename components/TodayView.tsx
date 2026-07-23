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
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

interface PlannerTask {
  id: string;
  title: string;
  area: 'Product' | 'Health' | 'Family' | 'Admin' | 'AI' | 'Business' | 'Wealth' | 'Routine' | 'Work' | 'Travel' | 'Trading' | 'Car' | 'Politics' | 'Startup';
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

interface DaySnapshot {
  date: string;
  changedSummary: string;
  captures: Array<{
    title: string;
    path: string | null;
    source: string;
    intent: string;
    projectId: string | null;
    created: string | null;
  }>;
  healthActivities: Array<{
    summary: string;
    status: string;
    rawPath: string | null;
    calories: number | null;
    caloriesMethod?: string;
    caloriesQuality?: string;
    activities: Array<{
      code?: string;
      name?: string;
      durationMin?: number;
      distanceKm?: number | null;
      load?: string | null;
      reps?: number | null;
      estimatedCalories?: number;
    }>;
  }>;
  pendingQuestions: Array<{
    question: string;
    capturePath: string;
    reviewPath: string;
    interpretation: string;
    proposals: Array<{
      label?: string;
      reason?: string;
    }>;
    approvalRequired: boolean;
  }>;
}

interface AgendaItem {
  id: string;
  area: PlannerTask['area'];
  status: PlannerTask['status'];
  title: string;
  details: string[];
  sources: string[];
  priority: number;
  href?: string;
  timeLabel: string;
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

const areaIcon: Record<PlannerTask['area'], React.ReactNode> = {
  Product: <Target className="h-4 w-4 text-emerald-400" />,
  Health: <Dumbbell className="h-4 w-4 text-amber-400" />,
  Family: <Users className="h-4 w-4 text-rose-400" />,
  Admin: <Folder className="h-4 w-4 text-slate-400" />,
  AI: <Sparkles className="h-4 w-4 text-blue-500" />,
  Business: <BriefcaseBusiness className="h-4 w-4 text-emerald-500" />,
  Wealth: <TrendingUp className="h-4 w-4 text-violet-500" />,
  Routine: <Activity className="h-4 w-4 text-cyan-500" />,
  Work: <BriefcaseBusiness className="h-4 w-4 text-slate-500" />,
  Travel: <Folder className="h-4 w-4 text-sky-500" />,
  Trading: <TrendingUp className="h-4 w-4 text-indigo-500" />,
  Car: <Folder className="h-4 w-4 text-slate-500" />,
  Politics: <Folder className="h-4 w-4 text-slate-500" />,
  Startup: <Sparkles className="h-4 w-4 text-blue-500" />,
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

function projectHref(projectId?: string) {
  if (!projectId) return undefined;
  if (projectId === 'health') return '/?view=health';
  return `/?view=project&project=${encodeURIComponent(projectId)}`;
}

function statusRank(status: PlannerTask['status']) {
  if (status === 'planned') return 4;
  if (status === 'suggested') return 3;
  if (status === 'review') return 2;
  return 1;
}

function dayOrder(area: PlannerTask['area']) {
  if (area === 'Routine') return 10;
  if (area === 'Health') return 20;
  if (area === 'Business' || area === 'AI' || area === 'Product') return 30;
  if (area === 'Work' || area === 'Admin') return 40;
  if (area === 'Wealth') return 50;
  if (area === 'Family') return 60;
  return 70;
}

function timeLabel(area: PlannerTask['area']) {
  if (area === 'Routine') return 'Morning / day control';
  if (area === 'Health') return 'Movement / recovery';
  if (area === 'Business' || area === 'AI' || area === 'Product') return 'Focus block';
  if (area === 'Work' || area === 'Admin') return 'Admin block';
  if (area === 'Wealth') return 'Review block';
  if (area === 'Family') return 'Life buffer';
  return 'Later';
}

export default function TodayView() {
  const [planner, setPlanner] = useState<PlannerProjection | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [healthPlan, setHealthPlan] = useState<RehabPlan | null>(null);
  const [publishingPlan, setPublishingPlan] = useState<PublishingPlan | null>(null);
  const [daySnapshot, setDaySnapshot] = useState<DaySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialSelectedDate());

  useEffect(() => {
    let cancelled = false;

    const loadToday = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      const fetchOptions: RequestInit = { cache: 'no-store' };
      const cacheBust = `t=${Date.now()}`;

      const [plannerData, resumeData, healthPlanData, publishingPlanData] = await Promise.all([
        fetch(`/api/planner?${cacheBust}`, fetchOptions).then((res) => res.json()),
        fetch(`/api/resume?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
        fetch(`/api/health/project?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
        fetch(`/api/projects/ai-publishing?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
      ]);

      if (!cancelled) {
        setPlanner(plannerData);
        setResume(resumeData);
        setHealthPlan(healthPlanData);
        setPublishingPlan(publishingPlanData);
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

  useEffect(() => {
    let cancelled = false;
    const cacheBust = `t=${Date.now()}`;

    fetch(`/api/day?date=${encodeURIComponent(selectedDate)}&${cacheBust}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDaySnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setDaySnapshot(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const plannedTasks = useMemo(() => {
    const tasks = planner?.tasks ?? [];
    const exact = tasks.filter((task) => task.date === selectedDate);
    if (exact.length > 0) return exact.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return tasks
      .filter((task) => !task.date && task.horizon !== 'this-week')
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [planner, selectedDate]);
  const todayDate = healthPlan?.todayDate ?? publishingPlan?.todayDate ?? getSydneyDate();
  const healthDay = healthPlan?.days?.find((day) => day.date === selectedDate) ?? null;
  const healthLink = healthDay ? `/?view=health&day=${healthDay.day}` : '/?view=health';
  const publishingDay =
    publishingPlan?.days?.find((day) => day.date === selectedDate) ??
    (selectedDate === todayDate ? publishingPlan?.upcoming ?? null : null);
  const agendaTasks = useMemo(() => {
    const tasks: PlannerTask[] = [];
    if (healthDay) {
      tasks.push({
        id: `health-plan-${healthDay.day}`,
        title: healthDay.title,
        area: 'Health',
        status: healthDay.completed ? 'done' : 'planned',
        source: 'structured/health plan',
        date: selectedDate,
        horizon: 'today',
        priority: 92,
        projectId: 'health',
        detail: healthDay.plan,
      });
    }

    for (const [index, activity] of (daySnapshot?.healthActivities ?? []).entries()) {
      tasks.push({
        id: `health-activity-${selectedDate}-${index}`,
        title: `Health logged: ${activity.summary}`,
        area: 'Health',
        status: 'done',
        source: activity.rawPath || 'structured/health/activity-log.jsonl',
        date: selectedDate,
        horizon: 'history',
        priority: 94,
        projectId: 'health',
        detail: activity.calories
          ? activity.caloriesQuality === 'unverified'
            ? `Fitbit energy via Health Connect: ~${activity.calories} kcal (unverified; not used for calorie balance).`
            : `Estimated activity energy: ~${activity.calories} kcal.`
          : 'Logged activity.',
      });
    }

    const healthActivityPaths = new Set((daySnapshot?.healthActivities ?? []).map((activity) => activity.rawPath).filter(Boolean));
    const healthCaptures = (daySnapshot?.captures ?? []).filter(
      (capture) => capture.projectId === 'health' && (!capture.path || !healthActivityPaths.has(capture.path))
    );
    if (healthCaptures.length > 0) {
      const hasCompletedHealthEvent = healthCaptures.some((capture) =>
        /workout|health_metric|exercise|nutrition/i.test(capture.intent)
      );
      tasks.push({
        id: `health-captures-${selectedDate}`,
        title: `Health captured ${healthCaptures.length} note${healthCaptures.length === 1 ? '' : 's'}`,
        area: 'Health',
        status: hasCompletedHealthEvent ? 'done' : 'suggested',
        source: 'indexes/captures.jsonl',
        date: selectedDate,
        horizon: 'history',
        priority: hasCompletedHealthEvent ? 88 : 64,
        projectId: 'health',
        detail: healthCaptures.slice(0, 3).map((capture) => capture.title).join('; '),
      });
    }

    const nonHealthCaptures = (daySnapshot?.captures ?? []).filter((capture) => capture.projectId !== 'health');
    if (nonHealthCaptures.length > 0) {
      tasks.push({
        id: `vault-captures-${selectedDate}`,
        title: `Vault captured ${nonHealthCaptures.length} note${nonHealthCaptures.length === 1 ? '' : 's'}`,
        area: 'Admin',
        status: 'done',
        source: 'indexes/captures.jsonl',
        date: selectedDate,
        horizon: 'history',
        priority: 40,
        projectId: undefined,
        detail: nonHealthCaptures.slice(0, 3).map((capture) => capture.title).join('; '),
      });
    }

    tasks.push(...plannedTasks);

    if (publishingDay) {
      tasks.push({
        id: `ai-publishing-${publishingDay.day}`,
        title: publishingDay.title,
        area: 'AI',
        status: 'planned',
        source: 'structured/ai publishing plan',
        date: selectedDate,
        horizon: 'today',
        priority: 76,
        projectId: 'ai',
        detail: publishingDay.plan,
      });
    }

    const byArea = new Map<string, AgendaItem>();
    for (const task of tasks) {
      const key = task.projectId || task.area;
      const href = task.id.startsWith('health-plan-') ? healthLink : projectHref(task.projectId);
      const existing = byArea.get(key);
      const details = [task.detail || task.title].filter(Boolean);
      const sources = [task.source].filter(Boolean);

      if (!existing) {
        byArea.set(key, {
          id: key,
          area: task.area,
          status: task.status,
          title: task.title,
          details,
          sources,
          priority: task.priority ?? 0,
          href,
          timeLabel: timeLabel(task.area),
        });
        continue;
      }

      existing.status = statusRank(task.status) > statusRank(existing.status) ? task.status : existing.status;
      existing.priority = Math.max(existing.priority, task.priority ?? 0);
      existing.href = existing.href || href;
      if (statusRank(task.status) >= statusRank(existing.status) && task.status === 'planned') {
        existing.title = task.title;
      }
      if (task.title !== existing.title && !existing.details.includes(task.title)) {
        existing.details.push(task.title);
      }
      for (const detail of details) {
        if (!existing.details.includes(detail)) existing.details.push(detail);
      }
      for (const source of sources) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
      }
    }

    return Array.from(byArea.values()).sort((a, b) => {
      const order = dayOrder(a.area) - dayOrder(b.area);
      if (order !== 0) return order;
      return b.priority - a.priority;
    });
  }, [daySnapshot, healthDay, healthLink, plannedTasks, publishingDay, selectedDate]);
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
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-on-surface-variant">
        Loading today...
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-none min-w-0 flex-col gap-4 overflow-hidden pb-8">
      <div className="flex w-full max-w-full min-w-0 flex-col">
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
                    <a href="/?view=planner" className={dateNavButtonClass}>
                      Planner
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
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
              {(daySnapshot?.pendingQuestions?.length ?? 0) > 0 && (
                <div className="mb-3 flex flex-col gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-violet-800 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 shrink-0" />
                      <h4 className="text-sm font-semibold">{daySnapshot?.pendingQuestions.length} item(s) need decision</h4>
                    </div>
                    <p className="mt-1 truncate text-xs text-violet-700">
                      {daySnapshot?.pendingQuestions[0]?.question}
                    </p>
                  </div>
                  <a
                    href="/?view=planner"
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded border border-violet-200 bg-surface px-3 text-xs font-medium text-violet-700 hover:bg-violet-100"
                  >
                    Review
                  </a>
                </div>
              )}
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {agendaTasks.map((task) => {
                  return (
                    <article key={task.id} className={`grid gap-3 p-3 sm:grid-cols-[136px_minmax(0,1fr)_auto] ${agendaRowClass[task.status]}`}>
                      <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant sm:block">
                        <div className="flex items-center gap-2 sm:mb-1">
                          {areaIcon[task.area]}
                          <span>{task.area}</span>
                        </div>
                        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${agendaStatusClass[task.status]}`}>
                          {task.status}
                        </span>
                        <p className="mt-2 hidden text-[11px] leading-snug text-on-surface-variant sm:block">{task.timeLabel}</p>
                      </div>
                      <div className="min-w-0">
                        {task.href ? (
                          <a href={task.href} className="text-sm font-semibold leading-snug text-on-surface hover:text-primary hover:underline">
                            {task.title}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold leading-snug text-on-surface">{task.title}</p>
                        )}
                        <div className="mt-1 space-y-1">
                          {task.details.map((detail) => (
                            <p key={detail} className="text-sm leading-relaxed text-on-surface-variant">{detail}</p>
                          ))}
                        </div>
                        <p className="mt-2 truncate text-xs text-on-surface-variant">{task.sources.join(' + ')}</p>
                      </div>
                      {task.href ? (
                        <a
                          href={task.href}
                          className="inline-flex h-8 shrink-0 items-center justify-center gap-1 self-start rounded border border-border bg-surface px-3 text-xs font-medium text-primary hover:bg-active"
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </article>
                  );
                })}
                {agendaTasks.length === 0 && (
                  <p className="p-3 text-sm text-on-surface-variant">No dated tasks selected for this day yet.</p>
                )}
              </div>
            </div>

          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-base font-semibold text-on-surface">What changed</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              {daySnapshot?.changedSummary ?? resume?.dailyBrief?.changedSinceYesterday ?? 'Recent vault changes will be summarized here.'}
            </p>
          </section>
        </div>
      </div>

    </div>
  );
}
