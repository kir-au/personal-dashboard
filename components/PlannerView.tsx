'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Database, RefreshCw, Shield } from 'lucide-react';
import AssistantActionsPanel, { type AssistantReview, type AssistantTask } from './AssistantActionsPanel';

type PlannerTask = AssistantTask;

interface PlannerProjection {
  title: string;
  weekFocus: string;
  generatedFrom: string[];
  tasks: PlannerTask[];
}

const areaColor: Record<PlannerTask['area'], string> = {
  Product: 'border-emerald-500 bg-emerald-500/5',
  Health: 'border-amber-500 bg-amber-500/5',
  Family: 'border-rose-500 bg-rose-500/5',
  Admin: 'border-slate-500 bg-slate-500/5',
  AI: 'border-blue-500 bg-blue-500/5',
  Business: 'border-emerald-500 bg-emerald-500/5',
  Wealth: 'border-violet-500 bg-violet-500/5',
  Routine: 'border-cyan-500 bg-cyan-500/5',
  Work: 'border-slate-500 bg-slate-500/5',
  Travel: 'border-sky-500 bg-sky-500/5',
  Trading: 'border-indigo-500 bg-indigo-500/5',
  Car: 'border-slate-500 bg-slate-500/5',
  Politics: 'border-slate-500 bg-slate-500/5',
  Startup: 'border-blue-500 bg-blue-500/5',
};

export default function PlannerView() {
  const [projection, setProjection] = useState<PlannerProjection | null>(null);
  const [assistantReview, setAssistantReview] = useState<AssistantReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOptions: RequestInit = { cache: 'no-store' };
    const cacheBust = `t=${Date.now()}`;

    Promise.all([
      fetch(`/api/planner?${cacheBust}`, fetchOptions).then((res) => res.json()),
      fetch(`/api/assistant/review?${cacheBust}`, fetchOptions).then((res) => res.json()).catch(() => null),
    ])
      .then(([projectionData, assistantReviewData]) => {
        setProjection(projectionData);
        setAssistantReview(assistantReviewData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-on-surface-variant">
        Loading planner projection...
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-on-surface-variant">
        Planner projection is not available.
      </div>
    );
  }

  const reviewTasks = projection.tasks
    .filter((task) => task.horizon === 'this-week' || task.status === 'review')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 6);

  return (
    <div className="flex w-full max-w-[1440px] flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-on-surface">This week</h3>
            <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-variant">
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {projection.tasks.map((task) => (
              <article key={task.id} className={`rounded-lg border p-3 ${areaColor[task.area]}`}>
                <div className="flex items-start gap-3">
                  {task.status === 'done' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 text-on-surface-variant" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-on-surface-variant">{task.area}</span>
                      <span className="text-xs text-on-surface-variant">/</span>
                      <span className="text-xs text-on-surface-variant">{task.status}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-on-surface">{task.title}</p>
                    <p className="mt-2 text-xs text-on-surface-variant">{task.source}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <AssistantActionsPanel assistantReview={assistantReview} reviewTasks={reviewTasks} compact />

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-on-surface">Source boundary</h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              This dashboard should read planner state from the headless Personal Vault API. The filesystem remains the private memory store.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-on-surface">Inputs</h3>
            </div>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              {projection.generatedFrom.map((source) => (
                <li key={source} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{source}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
