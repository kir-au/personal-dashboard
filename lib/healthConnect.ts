import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const IMPORT_INDEX_PATH = path.join(VAULT_ROOT, 'indexes', 'health-connect-imports.jsonl');

interface HealthConnectImportIndex {
  created?: string;
  sha256?: string;
  path?: string;
  parser?: string | null;
  parserVersion?: number | null;
  coverage?: {
    lastDate?: string | null;
  } | null;
}

interface HealthConnectDay {
  date?: string;
  steps?: number | null;
  stepsSource?: string | null;
  distanceKm?: number | null;
  distanceSource?: string | null;
  exportedCaloriesKcal?: number | null;
  caloriesSource?: string | null;
  heartRateAverageBpm?: number | null;
  heartRateMinimumBpm?: number | null;
  heartRateMaximumBpm?: number | null;
  heartRateSource?: string | null;
  hrvAverageMs?: number | null;
  sleepHours?: number | null;
  sleepSource?: string | null;
  exerciseMinutes?: number | null;
  exerciseSessions?: number | null;
  exerciseTypes?: string | null;
  weightKg?: number | null;
}

interface HealthConnectSummary {
  daily?: HealthConnectDay[];
}

export interface HealthConnectActivity {
  date: string;
  loggedAt: string;
  source: 'health-connect';
  rawPath: string;
  status: 'synced';
  summary: string;
  activities: Array<{
    code: string;
    name: string;
    durationMin?: number | null;
    distanceKm?: number | null;
    load?: string | null;
    reps?: number | null;
  }>;
  calories?: {
    method: string;
    totalEstimatedCalories: number | null;
    quality: 'unverified';
    assumptions: string[];
  };
  notes: string[];
}

function readJsonl<T>(raw: string): T[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-AU').format(value);
}

function formatValue(value: number, digits = 1) {
  return new Intl.NumberFormat('en-AU', {
    maximumFractionDigits: digits,
  }).format(value);
}

function toActivity(day: HealthConnectDay, rawPath: string, loggedAt: string): HealthConnectActivity | null {
  if (!day.date) return null;
  const activities: HealthConnectActivity['activities'] = [];
  const summaryParts: string[] = [];
  const notes: string[] = [];

  if (typeof day.steps === 'number') {
    activities.push({ code: 'steps', name: 'Steps', reps: day.steps });
    summaryParts.push(`${formatNumber(day.steps)} steps`);
    if (day.stepsSource) notes.push(`Steps source: ${day.stepsSource}.`);
  }
  if (typeof day.distanceKm === 'number') {
    activities.push({ code: 'distance', name: 'Distance', distanceKm: day.distanceKm });
    summaryParts.push(`${formatValue(day.distanceKm, 2)} km`);
    if (day.distanceSource) notes.push(`Distance source: ${day.distanceSource}.`);
  }
  if (typeof day.exerciseMinutes === 'number') {
    activities.push({
      code: 'exercise',
      name: day.exerciseTypes || 'Exercise session',
      durationMin: day.exerciseMinutes,
    });
    summaryParts.push(`${formatValue(day.exerciseMinutes)} min ${String(day.exerciseTypes || 'exercise').toLowerCase()}`);
  }
  if (typeof day.sleepHours === 'number') {
    summaryParts.push(`${formatValue(day.sleepHours, 2)} h sleep`);
    if (day.sleepSource) notes.push(`Sleep source: ${day.sleepSource}.`);
  }
  if (typeof day.heartRateAverageBpm === 'number') {
    const range = day.heartRateMinimumBpm !== null && day.heartRateMaximumBpm !== null
      ? ` (${day.heartRateMinimumBpm}-${day.heartRateMaximumBpm})`
      : '';
    notes.push(`Heart rate: ${day.heartRateAverageBpm} bpm average${range}${day.heartRateSource ? ` from ${day.heartRateSource}` : ''}.`);
  }
  if (typeof day.hrvAverageMs === 'number') notes.push(`HRV: ${formatValue(day.hrvAverageMs)} ms average.`);
  if (typeof day.weightKg === 'number') notes.push(`Weight: ${formatValue(day.weightKg, 2)} kg.`);

  if (summaryParts.length === 0 && notes.length === 0) return null;

  return {
    date: day.date,
    loggedAt,
    source: 'health-connect',
    rawPath,
    status: 'synced',
    summary: `Health Connect: ${summaryParts.join('; ') || 'vitals synced'}`,
    activities,
    calories: {
      method: 'Fitbit energy via Health Connect',
      totalEstimatedCalories: typeof day.exportedCaloriesKcal === 'number' ? day.exportedCaloriesKcal : null,
      quality: 'unverified',
      assumptions: [
        'This is a device-reported energy stream, not a Personal Vault calorie-burn calculation.',
        'The value is not used for calorie balance because it does not match Fitbit total daily energy shown in the Fitbit UI.',
        ...(day.caloriesSource ? [`Energy source: ${day.caloriesSource}.`] : []),
      ],
    },
    notes,
  };
}

export async function readHealthConnectActivityLog(options: { since?: string } = {}) {
  try {
    const imports = readJsonl<HealthConnectImportIndex>(await fsp.readFile(IMPORT_INDEX_PATH, 'utf-8'));
    const latestByHash = new Map<string, HealthConnectImportIndex>();
    for (const entry of imports) {
      if (entry.sha256) latestByHash.set(entry.sha256, entry);
    }
    const latestImport = [...latestByHash.values()]
      .filter((entry) => entry.parser === 'health-connect-sqlite' && entry.path)
      .sort((a, b) => {
        const byCoverage = String(a.coverage?.lastDate || '').localeCompare(String(b.coverage?.lastDate || ''));
        return byCoverage || String(a.created || '').localeCompare(String(b.created || ''));
      })
      .at(-1);
    if (!latestImport?.path) return [];

    const summaryRelativePath = latestImport.path.replace(/\.md$/i, '.assets/health-connect-summary.json');
    const summaryPath = path.resolve(VAULT_ROOT, summaryRelativePath);
    if (!summaryPath.startsWith(`${VAULT_ROOT}${path.sep}`)) return [];
    const summary = JSON.parse(await fsp.readFile(summaryPath, 'utf-8')) as HealthConnectSummary;

    return (summary.daily || [])
      .filter((day) => day.date && (!options.since || day.date >= options.since))
      .map((day) => toActivity(day, latestImport.path!, latestImport.created || ''))
      .filter((entry): entry is HealthConnectActivity => Boolean(entry))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}
