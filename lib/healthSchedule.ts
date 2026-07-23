import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const SCHEDULE_EVENTS_PATH = path.join(
  VAULT_ROOT,
  'structured',
  'health',
  'plan-schedule-events.jsonl'
);

export interface HealthScheduleEvent {
  id: string;
  type: 'move';
  planId: string;
  sourceDay: number;
  fromDate: string;
  toDate: string;
  created: string;
  source: 'health-dashboard';
}

export async function readLatestHealthScheduleEvents() {
  const events = await readHealthScheduleEvents();
  const latest = new Map<string, HealthScheduleEvent>();

  for (const event of events) {
    latest.set(scheduleKey(event.planId, event.sourceDay), event);
  }

  return latest;
}

export async function appendHealthScheduleEvent(
  event: Omit<HealthScheduleEvent, 'id' | 'created' | 'source' | 'type'>
) {
  const created = new Date().toISOString();
  const scheduleEvent: HealthScheduleEvent = {
    ...event,
    id: `health-schedule-${created.replace(/[:.]/g, '-')}`,
    type: 'move',
    created,
    source: 'health-dashboard',
  };

  await fsp.mkdir(path.dirname(SCHEDULE_EVENTS_PATH), { recursive: true });
  await fsp.appendFile(SCHEDULE_EVENTS_PATH, `${JSON.stringify(scheduleEvent)}\n`, 'utf-8');
  return scheduleEvent;
}

export function scheduleKey(planId: string, sourceDay: number) {
  return `${planId}:${sourceDay}`;
}

async function readHealthScheduleEvents() {
  try {
    const raw = await fsp.readFile(SCHEDULE_EVENTS_PATH, 'utf-8');
    return raw
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const event = JSON.parse(line) as HealthScheduleEvent;
          if (
            event.type !== 'move'
            || !event.planId
            || !Number.isInteger(event.sourceDay)
            || !isDateValue(event.toDate)
          ) {
            return [];
          }
          return [event];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function isDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
