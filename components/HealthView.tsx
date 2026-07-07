'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Image as ImageIcon } from 'lucide-react';

interface ExerciseKey {
  code: string;
  label: string;
}

interface RehabDay {
  day: number;
  date: string;
  label: string;
  kind: string;
  title: string;
  plan: string;
  completed: boolean;
  completionStatus?: 'partial' | 'completed';
  planId?: string;
  projectId?: string;
  planTitle?: string;
  planStatus?: string;
  sourcePath?: string;
  sourceDay?: number;
  actual?: {
    summary?: string;
    completed?: ActualExercise[];
    remaining?: string[];
    rawPath?: string;
    painResponse?: {
      during: string | null;
      night: string | null;
      nextDay: string | null;
    };
  };
}

interface ActualExercise {
  code: string;
  name: string;
  load: string | null;
  sets: number | null;
  reps: number | null;
}

interface RehabPlan {
  title: string;
  startDate: string;
  goal: string;
  rule: string;
  exerciseKey: ExerciseKey[];
  notes: string[];
  days: RehabDay[];
  todayDate: string;
  today: RehabDay | null;
  upcoming?: RehabDay | null;
  plans?: Array<{
    id: string;
    projectId: string;
    title: string;
    status: string;
    startDate: string | null;
    goal: string;
    rule: string;
    sourcePath: string;
    today: RehabDay | null;
    upcoming: RehabDay | null;
    days: RehabDay[];
    notes: string[];
  }>;
  activityLog?: HealthActivityEntry[];
}

interface HealthActivityEntry {
  date: string;
  loggedAt?: string;
  updatedAt?: string;
  source?: string;
  rawPath?: string;
  status: string;
  summary: string;
  activities?: LoggedActivity[];
  calories?: {
    method?: string;
    bodyWeightKg?: number;
    totalEstimatedCalories?: number;
    assumptions?: string[];
  };
  notes?: string[];
}

interface LoggedActivity {
  code: string;
  name: string;
  durationMin?: number | null;
  distanceKm?: number | null;
  pace?: string;
  load?: string | null;
  reps?: number | null;
  met?: number;
  estimatedCalories?: number | null;
}

interface Exercise {
  code: string;
  name: string;
  image: string;
  dose: string;
  why: string;
  how: string;
  avoid: string;
  source: string;
}

interface ExerciseLibrary {
  exercises: Exercise[];
}

const kindStyle: Record<string, string> = {
  home: 'border-blue-300 bg-blue-50',
  gym: 'border-emerald-300 bg-emerald-50',
  recovery: 'border-amber-300 bg-amber-50',
  off: 'border-slate-300 bg-slate-50',
  review: 'border-violet-300 bg-violet-50',
  'run-quality': 'border-red-300 bg-red-50',
  'run-long': 'border-sky-300 bg-sky-50',
  activity: 'border-emerald-300 bg-emerald-50',
  plan: 'border-slate-300 bg-slate-50',
};

export default function HealthView() {
  const [plan, setPlan] = useState<RehabPlan | null>(null);
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [selectedExerciseCode, setSelectedExerciseCode] = useState<string | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const dayRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/health/project').then((res) => res.json()),
      fetch('/api/health/exercises').then((res) => res.json()).catch(() => ({ exercises: [] })),
    ])
      .then(([planData, exerciseData]: [RehabPlan, ExerciseLibrary]) => {
        setPlan(planData);
        setExerciseLibrary(exerciseData.exercises || []);
        const requestedDay = typeof window !== 'undefined'
          ? Number(new URLSearchParams(window.location.search).get('day'))
          : NaN;
        const planDays = buildDisplayedDays(planData);
        const initialDay = planDays.find((day) => day.day === requestedDay) || planData.today || planData.upcoming || planDays[0] || null;
        setSelectedDayNumber(initialDay?.day || null);
        const firstTodayCode = extractExerciseCodes(initialDay?.plan || '', exerciseData.exercises || [])[0];
        setSelectedExerciseCode(firstTodayCode || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const exerciseByCode = useMemo(() => {
    return Object.fromEntries(exerciseLibrary.map((exercise) => [exercise.code, exercise]));
  }, [exerciseLibrary]);

  const selectedExercise = selectedExerciseCode ? exerciseByCode[selectedExerciseCode] : null;
  const activityByDate = useMemo(() => {
    const map = new Map<string, HealthActivityEntry[]>();
    for (const entry of plan?.activityLog || []) {
      const entries = map.get(entry.date) || [];
      entries.push(entry);
      map.set(entry.date, entries);
    }
    return map;
  }, [plan?.activityLog]);
  const displayedDays = useMemo(() => {
    return plan ? buildDisplayedDays(plan) : [];
  }, [plan]);
  const selectedDay = useMemo(() => {
    if (!plan) return null;
    return displayedDays.find((day) => day.day === selectedDayNumber) || plan.today || plan.upcoming || displayedDays[0] || null;
  }, [displayedDays, plan, selectedDayNumber]);

  useEffect(() => {
    if (!selectedDayNumber) return;
    const timeline = timelineRef.current;
    const dayRow = dayRefs.current[selectedDayNumber];
    if (!timeline || !dayRow) return;

    const rowTop = dayRow.offsetTop - timeline.offsetTop;
    timeline.scrollTo({ top: Math.max(rowTop, 0), behavior: 'auto' });
  }, [selectedDayNumber, plan]);

  const selectDay = (day: RehabDay) => {
    setSelectedDayNumber(day.day);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'health');
      url.searchParams.set('day', String(day.day));
      window.history.replaceState(null, '', url.toString());
    }
    const firstCode = extractExerciseCodes(day.plan, exerciseLibrary)[0];
    setSelectedExerciseCode(firstCode || null);
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-on-surface-variant">Loading health plan...</div>;
  }

  if (!plan) {
    return <div className="rounded-lg border border-border bg-surface p-4">Health plan is not available.</div>;
  }

  return (
    <div className="flex w-full max-w-[1440px] flex-col gap-4 pb-8">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-on-surface">Plan timeline</h3>
            <p className="text-xs text-on-surface-variant">Plan, logged activity, completion, and calories in one place.</p>
          </div>
          <span className="text-xs text-on-surface-variant">
            {displayedDays[0]?.label} - {displayedDays[displayedDays.length - 1]?.label}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[140px_112px_120px_1fr] bg-surface-variant px-3 py-2 text-xs font-semibold text-on-surface">
            <div>Plan</div>
            <div>Date</div>
            <div>Type</div>
            <div>Plan</div>
          </div>
          <div ref={timelineRef} className="max-h-[460px] overflow-y-auto scroll-smooth">
            {displayedDays.map((day) => {
              const isToday = day.date === plan.todayDate;
              const isSelected = day.day === selectedDay?.day;
              const isPast = plan.today && day.date < plan.todayDate;
              const dayActivities = activityByDate.get(day.date) || [];
              const loggedCalories = dayActivities.reduce((sum, entry) => sum + (entry.calories?.totalEstimatedCalories || 0), 0);
              return (
                <div
                  key={`${day.date}-${day.day}`}
                  ref={(node) => {
                    dayRefs.current[day.day] = node;
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectDay(day)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectDay(day);
                    }
                  }}
                  className={`grid w-full grid-cols-[140px_112px_120px_1fr] border-t border-border px-3 py-3 text-left text-sm transition-colors hover:bg-hover ${
                    isSelected ? 'bg-active' : isToday ? 'bg-blue-50' : isPast ? 'bg-surface text-on-surface-variant opacity-70' : 'bg-surface'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-on-surface">{day.planTitle || 'Health'}</p>
                    {day.sourceDay ? (
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {day.projectId === '5k-running' ? `Week ${day.sourceDay}` : `Day ${day.sourceDay}`}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-on-surface-variant">{day.label}</div>
                  <div>
                    <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${kindStyle[day.kind] || kindStyle.plan}`}>
                      {day.kind}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-on-surface">{day.title}</p>
                      <p className="mt-1 text-on-surface-variant">{day.plan}</p>
                      {dayActivities.length > 0 && (
                        <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                          Logged: {dayActivities.map((entry) => entry.summary).join(' / ')}
                          {loggedCalories ? ` · ~${loggedCalories} kcal` : ''}
                        </p>
                      )}
                      {day.actual?.summary && (
                        <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                          Plan done: {day.actual.summary}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {extractExerciseCodes(day.plan, exerciseLibrary).map((code) => (
                          <button
                            key={`${day.day}-${code}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedExerciseCode(code);
                            }}
                            className="rounded border border-primary/30 bg-surface px-2 py-0.5 text-xs text-primary hover:bg-active"
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                    </div>
                    <span
                      className={`mt-1 rounded-full border p-1.5 ${
                        day.completed
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : dayActivities.length
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : day.completionStatus === 'partial'
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-border text-on-surface-variant'
                      }`}
                      title={day.completed || dayActivities.length ? 'Completed/logged activity' : day.completionStatus === 'partial' ? 'Partially logged' : 'Not completed'}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {selectedExercise ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="overflow-hidden rounded-lg border border-border bg-surface-variant">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/vault-asset/${encodeURIComponent(selectedExercise.image)}`}
                alt={selectedExercise.name}
                className="h-64 w-full object-cover"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <ImageIcon className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Exercise detail</span>
              </div>
              <h3 className="text-xl font-semibold text-on-surface">
                {selectedExercise.code}. {selectedExercise.name}
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant"><strong>Dose:</strong> {selectedExercise.dose}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-surface-variant p-3">
                  <p className="text-xs font-semibold uppercase text-on-surface-variant">Why</p>
                  <p className="mt-1 text-sm text-on-surface">{selectedExercise.why}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-variant p-3">
                  <p className="text-xs font-semibold uppercase text-on-surface-variant">How</p>
                  <p className="mt-1 text-sm text-on-surface">{selectedExercise.how}</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-semibold uppercase text-orange-700">Avoid</p>
                  <p className="mt-1 text-sm text-on-surface">{selectedExercise.avoid}</p>
                </div>
              </div>
              <a
                href={selectedExercise.source}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Source
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </section>
      ) : selectedDay ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Selected plan detail</span>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold text-on-surface">{selectedDay.title}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{selectedDay.plan}</p>
            </div>
            <span className={`inline-flex w-fit rounded border px-2 py-0.5 text-xs ${kindStyle[selectedDay.kind] || kindStyle.plan}`}>
              {selectedDay.kind}
            </span>
          </div>

          {selectedDay.kind === 'run-quality' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface-variant p-3">
                <p className="text-xs font-semibold uppercase text-on-surface-variant">Session</p>
                <p className="mt-1 text-sm text-on-surface">
                  Controlled intervals: run 500m, recover for 60 seconds, repeat for the planned count.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface-variant p-3">
                <p className="text-xs font-semibold uppercase text-on-surface-variant">Execution</p>
                <p className="mt-1 text-sm text-on-surface">
                  Keep the effort repeatable, not all-out. Warm up first and stop if post-laser recovery is not green.
                </p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-semibold uppercase text-orange-700">Needs reference</p>
                <p className="mt-1 text-sm text-on-surface">
                  No exercise media is attached yet. If this remains unclear, add a running reference to the Health plan.
                </p>
              </div>
            </div>
          ) : selectedDay.kind === 'run-long' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface-variant p-3">
                <p className="text-xs font-semibold uppercase text-on-surface-variant">Session</p>
                <p className="mt-1 text-sm text-on-surface">
                  Conversational long run. The goal is aerobic volume, not pace.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface-variant p-3">
                <p className="text-xs font-semibold uppercase text-on-surface-variant">Execution</p>
                <p className="mt-1 text-sm text-on-surface">
                  Stay easy enough to speak in full sentences and keep recovery constraints visible.
                </p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-semibold uppercase text-orange-700">Avoid</p>
                <p className="mt-1 text-sm text-on-surface">
                  Do not turn this into a race effort or add intensity if recovery is not green.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-border bg-surface-variant p-3">
              <p className="text-sm text-on-surface-variant">
                No exercise media is linked for this selected item. Log completion or add a reference if this plan needs more detail.
              </p>
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-on-surface">Exercise key reference</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.exerciseKey.map((item) => (
              <button
                key={item.code}
                onClick={() => setSelectedExerciseCode(item.code)}
                className={`rounded border px-2 py-1 text-left text-xs ${
                  selectedExerciseCode === item.code
                    ? 'border-primary bg-primary text-white'
                    : 'border-teal-300 bg-teal-50 text-teal-950 hover:border-primary'
                }`}
              >
                <strong>{item.code}</strong> = {item.label}
              </button>
            ))}
          </div>
        </details>
      </section>

    </div>
  );
}

function buildDisplayedDays(plan: RehabPlan): RehabDay[] {
  const days = [...(plan.days || [])];
  const plannedDates = new Set(days.map((day) => day.date));
  for (const entry of plan.activityLog || []) {
    if (plannedDates.has(entry.date)) continue;
    days.push({
      day: 900000 + days.length,
      date: entry.date,
      label: formatShortDate(entry.date),
      kind: 'activity',
      title: 'Logged activity',
      plan: entry.summary,
      completed: true,
      completionStatus: 'completed',
      planId: 'activity-log',
      projectId: 'health',
      planTitle: 'Health activity',
    });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function extractExerciseCodes(planText: string, exercises: Exercise[]) {
  const codes = exercises.map((exercise) => exercise.code).sort((a, b) => b.length - a.length);
  return codes.filter((code) => {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^A-Z])${escaped}([^A-Z]|$)`).test(planText);
  });
}

function formatShortDate(dateValue: string) {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateValue}T00:00:00`));
}
