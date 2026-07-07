import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const HEALTH_ROOT = path.join(VAULT_ROOT, 'structured', 'health');

export interface HealthPlanDay {
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
    rawPath?: string;
    painResponse?: {
      during: string | null;
      night: string | null;
      nextDay: string | null;
    };
  };
  planId?: string;
  projectId?: string;
  planTitle?: string;
  planStatus?: string;
  sourcePath?: string;
  sourceDay?: number;
}

export interface HealthPlanSummary {
  id: string;
  projectId: string;
  title: string;
  status: string;
  startDate: string | null;
  goal: string;
  rule: string;
  sourcePath: string;
  today: HealthPlanDay | null;
  upcoming: HealthPlanDay | null;
  days: HealthPlanDay[];
  notes: string[];
  exerciseKey: Array<{ code: string; label: string }>;
}

function getSydneyDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function addDays(dateValue: string, offset: number) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function normalizePlanRules(plan: any) {
  if (Array.isArray(plan.rules)) return plan.rules;
  if (typeof plan.rule === 'string') return [plan.rule];
  return [];
}

function normalizePlanNotes(plan: any) {
  if (Array.isArray(plan.notes)) return plan.notes;
  return normalizePlanRules(plan);
}

function normalizeDailyPlan(plan: any, sourcePath: string): HealthPlanSummary {
  const sourceDays = Array.isArray(plan.days) ? plan.days : [];
  const days: HealthPlanDay[] = sourceDays.map((day: any) => ({
    ...day,
    kind: day.kind || 'plan',
    planId: plan.id,
    projectId: plan.projectId,
    planTitle: plan.title,
    planStatus: plan.status || 'active',
    sourcePath,
    sourceDay: day.day,
  }));

  return {
    id: plan.id || path.basename(sourcePath, '.json'),
    projectId: plan.projectId || plan.id || 'health',
    title: plan.title || 'Health plan',
    status: plan.status || 'active',
    startDate: plan.startDate || days[0]?.date || null,
    goal: plan.goal || '',
    rule: plan.rule || normalizePlanRules(plan).join(' '),
    sourcePath,
    today: null,
    upcoming: null,
    days,
    notes: normalizePlanNotes(plan),
    exerciseKey: Array.isArray(plan.exerciseKey) ? plan.exerciseKey : [],
  };
}

function normalizeWeeklyRunningPlan(plan: any, sourcePath: string): HealthPlanSummary {
  const days: HealthPlanDay[] = [];
  const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];

  for (const week of weeks) {
    if (!week.starts) continue;
    days.push({
      day: days.length + 1,
      date: week.starts,
      label: formatDateLabel(week.starts),
      kind: 'run-quality',
      title: `Week ${week.week}: Quality run`,
      plan: week.qualitySession,
      completed: false,
      planId: plan.id,
      projectId: plan.projectId,
      planTitle: plan.title,
      planStatus: plan.status || 'planned',
      sourcePath,
      sourceDay: week.week,
    });

    const sunday = addDays(week.starts, 4);
    days.push({
      day: days.length + 1,
      date: sunday,
      label: formatDateLabel(sunday),
      kind: 'run-long',
      title: `Week ${week.week}: Long run`,
      plan: week.sundayLongRun,
      completed: false,
      planId: plan.id,
      projectId: plan.projectId,
      planTitle: plan.title,
      planStatus: plan.status || 'planned',
      sourcePath,
      sourceDay: week.week,
    });
  }

  return {
    id: plan.id || path.basename(sourcePath, '.json'),
    projectId: plan.projectId || plan.id || 'health',
    title: plan.title || 'Running plan',
    status: plan.status || 'planned',
    startDate: plan.startDate || days[0]?.date || null,
    goal: plan.goal || '',
    rule: normalizePlanRules(plan)[0] || '',
    sourcePath,
    today: null,
    upcoming: null,
    days,
    notes: normalizePlanNotes(plan),
    exerciseKey: [],
  };
}

function normalizePlan(plan: any, sourcePath: string): HealthPlanSummary {
  if (Array.isArray(plan.days)) return normalizeDailyPlan(plan, sourcePath);
  if (Array.isArray(plan.weeks)) return normalizeWeeklyRunningPlan(plan, sourcePath);
  return normalizeDailyPlan({ ...plan, days: [] }, sourcePath);
}

async function listHealthPlanFiles() {
  const entries = await fsp.readdir(HEALTH_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('-plan.json'))
    .map((entry) => path.join(HEALTH_ROOT, entry.name))
    .sort();
}

export async function readHealthPlans() {
  const todayDate = getSydneyDate();
  const files = await listHealthPlanFiles();
  const plans: HealthPlanSummary[] = [];

  for (const file of files) {
    const raw = await fsp.readFile(file, 'utf-8');
    const relativePath = path.relative(VAULT_ROOT, file);
    const plan = normalizePlan(JSON.parse(raw), relativePath);
    plan.days.sort((a, b) => a.date.localeCompare(b.date) || (a.planTitle || '').localeCompare(b.planTitle || ''));
    plan.today = plan.days.find((day) => day.date === todayDate) || null;
    plan.upcoming = plan.days.find((day) => day.date >= todayDate && !day.completed) || null;
    plans.push(plan);
  }

  const combinedDays = plans
    .flatMap((plan) => plan.days)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.planTitle || '').localeCompare(b.planTitle || ''))
    .map((day, index) => ({ ...day, day: index + 1 }));
  const combinedPlans = plans.map((plan) => {
    const days = combinedDays.filter((day) => day.planId === plan.id);
    return {
      ...plan,
      days,
      today: days.find((day) => day.date === todayDate) || null,
      upcoming: days.find((day) => day.date >= todayDate && !day.completed) || null,
    };
  });

  return {
    todayDate,
    plans: combinedPlans,
    days: combinedDays,
    today: combinedDays.find((day) => day.date === todayDate) || null,
    upcoming: combinedDays.find((day) => day.date >= todayDate && !day.completed) || null,
  };
}
