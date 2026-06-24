'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Footprints, HeartPulse, Image as ImageIcon, RotateCcw } from 'lucide-react';

interface ExerciseKey {
  code: string;
  label: string;
}

interface RehabDay {
  day: number;
  date: string;
  label: string;
  kind: 'home' | 'gym' | 'recovery' | 'off' | 'review';
  title: string;
  plan: string;
  completed: boolean;
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

const kindStyle: Record<RehabDay['kind'], string> = {
  home: 'border-blue-300 bg-blue-50',
  gym: 'border-emerald-300 bg-emerald-50',
  recovery: 'border-amber-300 bg-amber-50',
  off: 'border-slate-300 bg-slate-50',
  review: 'border-violet-300 bg-violet-50',
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
        const initialDay = planData.days?.find((day) => day.day === requestedDay) || planData.today || planData.days?.[0] || null;
        setSelectedDayNumber(initialDay?.day || null);
        const firstTodayCode = extractExerciseCodes(initialDay?.plan || '', exerciseData.exercises || [])[0];
        setSelectedExerciseCode(firstTodayCode || exerciseData.exercises?.[0]?.code || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const exerciseByCode = useMemo(() => {
    return Object.fromEntries(exerciseLibrary.map((exercise) => [exercise.code, exercise]));
  }, [exerciseLibrary]);

  const selectedExercise = selectedExerciseCode ? exerciseByCode[selectedExerciseCode] : null;
  const selectedDay = useMemo(() => {
    if (!plan) return null;
    return plan.days.find((day) => day.day === selectedDayNumber) || plan.today || plan.days[0] || null;
  }, [plan, selectedDayNumber]);
  const selectedDayCodes = useMemo(() => {
    return extractExerciseCodes(selectedDay?.plan || '', exerciseLibrary);
  }, [selectedDay, exerciseLibrary]);

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
    if (firstCode) setSelectedExerciseCode(firstCode);
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-on-surface-variant">Loading health plan...</div>;
  }

  if (!plan) {
    return <div className="rounded-lg border border-border bg-surface p-4">Health plan is not available.</div>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8">
      {selectedDay && (
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-primary/30 bg-surface p-5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded border border-primary/30 bg-active px-2 py-1 text-xs font-semibold uppercase text-primary">
                {selectedDay.date === plan.todayDate ? 'Today' : 'Selected day'}
              </span>
              <span className="text-sm text-on-surface-variant">
                Week {Math.ceil(selectedDay.day / 7)} / Day {selectedDay.day} · {selectedDay.label}
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-on-surface">{selectedDay.title}</h2>
            <p className="mt-2 text-base text-on-surface">{selectedDay.plan}</p>

            {selectedDayCodes.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {selectedDayCodes.map((code) => {
                  const exercise = exerciseByCode[code];
                  return (
                    <button
                      key={code}
                      onClick={() => setSelectedExerciseCode(code)}
                      className={`min-h-20 rounded-lg border p-3 text-left transition-colors ${
                        selectedExerciseCode === code
                          ? 'border-primary bg-active shadow-sm'
                          : 'border-border bg-surface-variant hover:border-primary/50 hover:bg-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${
                          selectedExerciseCode === code ? 'bg-primary text-white' : 'bg-surface text-primary'
                        }`}>
                          {code}
                        </span>
                        <span className="text-sm font-semibold text-on-surface">{exercise?.name || code}</span>
                      </div>
                      {exercise?.dose && (
                        <p className="mt-2 text-xs text-on-surface-variant">{exercise.dose}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <HeartPulse className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Health / Shoulder Rehab</span>
            </div>
            <h3 className="text-base font-semibold text-on-surface">{plan.title}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">{plan.goal}</p>
            <div className="mt-3 rounded-lg border-l-4 border-orange-500 bg-orange-50 px-3 py-2">
              <p className="text-sm text-on-surface">
                <strong>Rule:</strong> {plan.rule}
              </p>
            </div>
          </aside>
        </section>
      )}

      {selectedExercise && (
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
      )}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-on-surface">Plan timeline</h3>
            <p className="text-xs text-on-surface-variant">Opens on the current selected day. Scroll up for completed days.</p>
          </div>
          <span className="text-xs text-on-surface-variant">
            {plan.days[0]?.label} - {plan.days[plan.days.length - 1]?.label}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[84px_112px_120px_1fr] bg-surface-variant px-3 py-2 text-xs font-semibold text-on-surface">
            <div>Day</div>
            <div>Date</div>
            <div>Type</div>
            <div>Plan</div>
          </div>
          <div ref={timelineRef} className="max-h-[460px] overflow-y-auto scroll-smooth">
            {plan.days.map((day) => {
              const isToday = day.date === plan.todayDate;
              const isSelected = day.day === selectedDay?.day;
              const isPast = plan.today && day.date < plan.todayDate;
              return (
                <div
                  key={day.day}
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
                  className={`grid w-full grid-cols-[84px_112px_120px_1fr] border-t border-border px-3 py-3 text-left text-sm transition-colors hover:bg-hover ${
                    isSelected ? 'bg-active' : isToday ? 'bg-blue-50' : isPast ? 'bg-surface text-on-surface-variant opacity-70' : 'bg-surface'
                  }`}
                >
                  <div className="font-semibold text-on-surface">Day {day.day}</div>
                  <div className="text-on-surface-variant">{day.label}</div>
                  <div>
                    <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${kindStyle[day.kind]}`}>
                      {day.kind}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-on-surface">{day.title}</p>
                      <p className="mt-1 text-on-surface-variant">{day.plan}</p>
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
                    <span className="mt-1 rounded-full border border-border p-1.5 text-on-surface-variant" title={isPast ? 'Completed day' : 'Mark complete'}>
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

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

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Footprints className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-on-surface">Walking/cardio</h3>
          </div>
          <p className="text-sm text-on-surface-variant">{plan.notes[0]}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-on-surface">Do not add yet</h3>
          </div>
          <p className="text-sm text-on-surface-variant">{plan.notes[1]}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-on-surface">Progression</h3>
          </div>
          <p className="text-sm text-on-surface-variant">{plan.notes[2]}</p>
        </div>
      </section>
    </div>
  );
}

function extractExerciseCodes(planText: string, exercises: Exercise[]) {
  const codes = exercises.map((exercise) => exercise.code).sort((a, b) => b.length - a.length);
  return codes.filter((code) => {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^A-Z])${escaped}([^A-Z]|$)`).test(planText);
  });
}
