import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const SHOULDER_REHAB_PLAN_PATH = path.join(VAULT_ROOT, 'structured', 'health', 'shoulder-rehab-plan.json');
const SHOULDER_REHAB_LOG_PATH = path.join(VAULT_ROOT, 'structured', 'health', 'shoulder-rehab-log.json');
const HEALTH_STATE_PATH = path.join(VAULT_ROOT, 'structured', 'health', 'health-state.json');

type CaptureActionId =
  | 'leave-in-inbox'
  | 'link-to-project'
  | 'add-today-achievement'
  | 'add-to-today-plan'
  | 'log-health-workout';

interface CaptureActionRequest {
  path: string;
  actionId: CaptureActionId;
  projectId?: string;
  note?: string;
}

function safeRelativeVaultPath(value: string) {
  const normalized = value.replace(/^\/+/, '');
  const full = path.resolve(VAULT_ROOT, normalized);
  if (!full.startsWith(VAULT_ROOT + path.sep)) throw new Error('Path outside vault');
  return { relative: normalized, full };
}

function safeProjectId(value?: string) {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return normalized || undefined;
}

async function appendJsonl(relativePath: string, entry: Record<string, unknown>) {
  const fullPath = path.join(VAULT_ROOT, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.appendFile(fullPath, JSON.stringify(entry) + '\n', 'utf-8');
}

function getSydneyDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function textBodyFromMarkdown(markdown: string) {
  return markdown
    .replace(/^---[\s\S]*?---\s*/, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('- ');
    })
    .join(' ')
    .trim();
}

function exerciseName(code: string) {
  const names: Record<string, string> = {
    CSR: 'Chest Supported Row',
    SCR: 'Seated Cable Row',
    GFP: 'Cable Face Pull',
    C: 'Suitcase / Farmer Carry',
  };
  return names[code] || code;
}

function parseWorkout(markdown: string) {
  const body = textBodyFromMarkdown(markdown);
  const completed: Array<{ code: string; name: string; load: string | null; sets: number | null; reps: number | null }> = [];

  const csr = body.match(/\bCSR\b.*?(\d+)\s*sets?.*?(\d+)\s*kg.*?(\d+)\s*reps?/i);
  if (csr) {
    completed.push({
      code: 'CSR',
      name: exerciseName('CSR'),
      sets: Number(csr[1]),
      load: `${csr[2]} kg`,
      reps: Number(csr[3]),
    });
  }

  const facePull = body.match(/(?:face pull|тяга к лбу).*?(\d+)\s*kg/i);
  if (facePull) {
    completed.push({
      code: 'GFP',
      name: exerciseName('GFP'),
      load: `${facePull[1]} kg`,
      sets: null,
      reps: null,
    });
  }

  const scr = body.match(/\bSCR\b.*?(\d+)\s*kg.*?(\d+)\s*sets?/i);
  if (scr) {
    completed.push({
      code: 'SCR',
      name: exerciseName('SCR'),
      load: `${scr[1]} kg`,
      sets: Number(scr[2]),
      reps: null,
    });
  }

  const carry = body.match(/(?:farmer'?s? carry|farmers carry|farmer carry|carry).*?(\d+)\s*(?:times|sets?|раза|раз)?.*?(\d+)\s*kg/i)
    || body.match(/(?:farmer'?s? carry|farmers carry|farmer carry|carry).*?(\d+)\s*kg.*?(\d+)\s*(?:times|sets?|раза|раз)/i);
  if (carry) {
    const first = Number(carry[1]);
    const second = Number(carry[2]);
    const firstIsLoad = /kg/i.test(carry[0].slice(carry[0].indexOf(carry[1]), carry[0].indexOf(carry[2])));
    completed.push({
      code: 'C',
      name: exerciseName('C'),
      load: `${firstIsLoad ? first : second} kg`,
      sets: firstIsLoad ? second : first,
      reps: null,
    });
  }

  if (/(?:walk|ходьб|прогулк).*?(?:done|completed|сделан|был сделан|закрыт|закрой|earlier|раньше|намного больше)/i.test(body)) {
    completed.push({
      code: 'walk',
      name: 'Walk',
      load: null,
      sets: null,
      reps: null,
    });
  }

  return { reportedText: body, completed };
}

function mergeCompleted(
  existing: Array<{ code: string; name: string; load: string | null; sets: number | null; reps: number | null }> = [],
  incoming: Array<{ code: string; name: string; load: string | null; sets: number | null; reps: number | null }>
) {
  const byCode = new Map(existing.map((item) => [item.code, item]));
  for (const item of incoming) {
    byCode.set(item.code, item);
  }
  return Array.from(byCode.values());
}

async function applyHealthWorkout(capturePath: { relative: string; full: string }, appliedAt: string) {
  const markdown = await fs.readFile(capturePath.full, 'utf-8');
  const parsed = parseWorkout(markdown);
  if (!parsed.completed.length) {
    return { applied: false, reason: 'No supported workout exercises parsed from capture.' };
  }

  const today = getSydneyDate();
  const [planRaw, logRaw, stateRaw] = await Promise.all([
    fs.readFile(SHOULDER_REHAB_PLAN_PATH, 'utf-8'),
    fs.readFile(SHOULDER_REHAB_LOG_PATH, 'utf-8').catch(() => '{"projectId":"shoulder-rehab","entries":[]}'),
    fs.readFile(HEALTH_STATE_PATH, 'utf-8').catch(() => '{}'),
  ]);

  const plan = JSON.parse(planRaw);
  const log = JSON.parse(logRaw);
  const state = JSON.parse(stateRaw);
  const day = Array.isArray(plan.days) ? plan.days.find((item: any) => item.date === today) : null;
  if (!day) {
    return { applied: false, reason: `No shoulder rehab day found for ${today}.` };
  }

  const existingActual = day.actual || {};
  const completed = mergeCompleted(existingActual.completed || [], parsed.completed);
  const completedCodes = new Set(completed.map((item) => item.code));
  const plannedRemaining = ['CSR', 'SCR', 'GFP', 'C', 'walk']
    .filter((code) => !completedCodes.has(code))
    .map((code) => {
      if (code === 'C') return 'C 4x30 sec/side';
      if (code === 'walk') return 'walk 20 min';
      if (code === 'GFP') return 'GFP 3x15';
      if (code === 'CSR') return 'CSR 3x10';
      return 'SCR 3x10';
    });

  const logEntry = {
    date: today,
    loggedAt: appliedAt,
    planWeek: Math.ceil(day.day / 7),
    planDay: day.day,
    session: day.title,
    status: plannedRemaining.length ? 'partial' : 'completed',
    source: 'capture-action',
    rawPath: capturePath.relative,
    reportedText: parsed.reportedText,
    completed: parsed.completed,
    plannedRemaining,
    painResponse: {
      during: null,
      night: null,
      nextDay: null,
    },
    notes: [
      'Logged through /api/capture/action.',
      'SCR reps were not confirmed.',
      'Face pull sets and reps were not stated.',
    ],
  };

  log.updatedAt = appliedAt;
  log.projectId = log.projectId || 'shoulder-rehab';
  log.entries = Array.isArray(log.entries) ? log.entries : [];
  const existingLogIndex = log.entries.findIndex((entry: any) => entry.rawPath === capturePath.relative);
  if (existingLogIndex >= 0) {
    log.entries[existingLogIndex] = logEntry;
  } else {
    log.entries.push(logEntry);
  }

  day.completed = plannedRemaining.length === 0;
  day.completionStatus = plannedRemaining.length ? 'partial' : 'completed';
  day.loggedAt = appliedAt;
  day.actual = {
    ...existingActual,
    rawPath: capturePath.relative,
    summary: completed.map((item) => {
      const load = item.load ? ` ${item.load}` : '';
      const sets = item.sets ? ` ${item.sets} sets` : '';
      const reps = item.reps ? ` x ${item.reps} reps` : '';
      return `${item.code}${load}${sets}${reps}`;
    }).join('; '),
    completed,
    remaining: plannedRemaining,
    painResponse: existingActual.painResponse || {
      during: null,
      night: null,
      nextDay: null,
    },
  };

  state.updatedAt = appliedAt;
  state.lastWorkout = {
    date: today,
    loggedAt: appliedAt,
    planWeek: Math.ceil(day.day / 7),
    planDay: day.day,
    session: day.title,
    status: day.completionStatus,
    summary: day.actual.summary,
    rawPath: capturePath.relative,
  };
  state.openQuestions = [
    'Confirm SCR reps for the 40 kg sets.',
    'Confirm face pull sets and reps at 20 kg.',
    ...(plannedRemaining.includes('walk 20 min') ? ['Was the walk completed for Day 10?'] : []),
    'Any pain during the session, night pain, or next-day pain after Day 10?',
  ];

  await Promise.all([
    fs.writeFile(SHOULDER_REHAB_PLAN_PATH, JSON.stringify(plan, null, 2) + '\n', 'utf-8'),
    fs.writeFile(SHOULDER_REHAB_LOG_PATH, JSON.stringify(log, null, 2) + '\n', 'utf-8'),
    fs.writeFile(HEALTH_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8'),
  ]);

  return { applied: true, planDay: day.day, date: today, completed };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CaptureActionRequest;
    if (!body.path || !body.actionId) {
      return NextResponse.json({ ok: false, error: 'Missing path or actionId' }, { status: 400 });
    }

    const capturePath = safeRelativeVaultPath(body.path);
    await fs.access(capturePath.full);

    const now = new Date().toISOString();
    const projectId = safeProjectId(body.projectId);
    const baseEntry = {
      appliedAt: now,
      actionId: body.actionId,
      path: capturePath.relative,
      projectId: projectId || null,
      note: body.note || null,
      status: 'pending',
    };

    await appendJsonl('indexes/capture-actions.jsonl', baseEntry);

    if (body.actionId === 'link-to-project') {
      if (!projectId) {
        return NextResponse.json({ ok: false, error: 'Missing projectId for link-to-project' }, { status: 400 });
      }
      await appendJsonl('indexes/project-captures.jsonl', baseEntry);
    }

    if (body.actionId === 'add-today-achievement') {
      await appendJsonl('structured/today/achievements.jsonl', baseEntry);
    }

    if (body.actionId === 'add-to-today-plan') {
      await appendJsonl('structured/today/plan-overrides.jsonl', baseEntry);
    }

    if (body.actionId === 'log-health-workout') {
      await appendJsonl('structured/health/pending-workouts.jsonl', baseEntry);
      const healthResult = await applyHealthWorkout(capturePath, now);
      return NextResponse.json({ ok: true, action: baseEntry, healthResult });
    }

    return NextResponse.json({ ok: true, action: baseEntry });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
