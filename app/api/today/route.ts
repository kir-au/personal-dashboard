import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');

// ---------------------------------------------------------------------------
// Types — mobile-ready TodayBrief contract
// ---------------------------------------------------------------------------

type BriefArea = 'Product / Work' | 'Health / Food / Energy' | 'Family / Life' | 'Admin / Loose ends';
type DayMapKind = 'check-in' | 'work' | 'health' | 'food' | 'family' | 'admin' | 'recovery';

interface DraftPlanItem {
  area: BriefArea;
  item: string;
  rationale?: string;
}

interface DayMapBlock {
  label: string;
  kind: DayMapKind;
  timeHint?: string;
  text: string;
  flexible: boolean;
}

interface TodayBrief {
  notificationTitle: string;
  notificationBody: string;
  doFirst: string;
  keepInMind: string;
  canWait: string;
  draftPlan: DraftPlanItem[];
  dayMap: DayMapBlock[];
  checkInPrompt: string;
  rawTranscriptPath?: string;
}

// ---------------------------------------------------------------------------
// Helpers (subset of resume/route.ts patterns)
// ---------------------------------------------------------------------------

function getLocalMidnightMs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function linesAfterHeading(content: string, heading: string, maxLines = 15): string[] {
  const lines = content.split('\n');
  let found = false;
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!found && trimmed.replace(/^#+\s+/, '').toLowerCase().startsWith(heading.toLowerCase())) {
      found = true;
      continue;
    }
    if (found) {
      if (trimmed.startsWith('#')) break;
      if (trimmed) result.push(trimmed.replace(/^- /, '').trim());
      if (result.length >= maxLines) break;
    }
  }
  return result;
}

function extractListItemsAfterHeading(content: string, heading: string): string[] {
  const lines = content.split('\n');
  let found = false;
  const items: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!found && trimmed.replace(/^#+\s+/, '').toLowerCase().startsWith(heading.toLowerCase())) {
      found = true;
      continue;
    }
    if (found) {
      if (trimmed.startsWith('#')) break;
      const bullet = trimmed.match(/^[-*]\s+(.+)/);
      if (bullet) items.push(bullet[1]);
      const numbered = trimmed.match(/^\d+\.\s+(.+)/);
      if (numbered) items.push(numbered[1]);
    }
  }
  return items;
}

function readFirstBodyLines(content: string): string {
  return content
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .slice(0, 3)
    .join(' ')
    .substring(0, 250);
}

async function readYearDirectionBody(): Promise<string> {
  const dirPath = path.join(VAULT_ROOT, 'structured', 'strategies');
  try {
    const entries = await fsp.readdir(dirPath);
    const file = entries.find(e => e.startsWith('2026') && e.endsWith('personal-direction.md'));
    if (!file) return 'Build a personal execution and memory system.';
    const content = await fsp.readFile(path.join(dirPath, file), 'utf-8');
    const { content: body } = matter(content);
    return readFirstBodyLines(body) || 'Build a personal execution and memory system.';
  } catch {
    return 'Build a personal execution and memory system.';
  }
}

async function readWeekBody(): Promise<string> {
  const planPath = path.join(VAULT_ROOT, 'structured', 'plans', '2026-05-24-2026-operating-plan.md');
  try {
    const content = await fsp.readFile(planPath, 'utf-8');
    const { content: planBody } = matter(content);
    const items = linesAfterHeading(planBody, 'Weekly Default', 3);
    return items.length > 0 ? items.slice(0, 2).join('. ') : 'Pick one product task, one health task, and one control task.';
  } catch {
    return 'Pick one product task, one health task, and one control task.';
  }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildDayMap(): DayMapBlock[] {
  return [
    { label: 'Morning check-in', kind: 'check-in', text: 'Voice-first check-in to capture energy, sleep, mood, body, alcohol, and main constraint.', flexible: false },
    { label: 'Product / Work focus', kind: 'work', text: 'One product task. Keep it small enough to finish in under 90 minutes.', flexible: true },
    { label: 'Food / Energy reminder', kind: 'food', text: 'Eat protein early. Hydrate. No alcohol for work activation.', flexible: true },
    { label: 'Exercise / Recovery', kind: 'recovery', timeHint: 'Afternoon', text: 'Walk, stretch, or train. Protect the body baseline.', flexible: true },
    { label: 'Family / Life', kind: 'family', text: 'Keep family and life context visible even if no task exists.', flexible: true },
    { label: 'Admin / Loose ends', kind: 'admin', text: 'Review changed notes only if needed.', flexible: true },
  ];
}

function buildDraftPlan(): DraftPlanItem[] {
  return [
    { area: 'Product / Work', item: 'Focus on one clear product task. Keep the session small.' },
    { area: 'Health / Food / Energy', item: 'Protect energy. Eat protein early, hydrate, and do not use alcohol for activation.', rationale: 'Operating profile guardrails' },
    { area: 'Family / Life', item: 'Keep family/life context visible even if no task exists yet.' },
    { area: 'Admin / Loose ends', item: 'Review changed notes only if needed.' },
  ];
}

// ---------------------------------------------------------------------------
// Check-in prompt
// ---------------------------------------------------------------------------

function buildCheckInPrompt(): string {
  return 'Tell me where you are this morning.';
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const [yearBody, weekBody] = await Promise.all([
      readYearDirectionBody(),
      readWeekBody(),
    ]);

    // Derive notification content from day map and week
    const notificationTitle = 'Your morning brief is ready';
    const notificationBody = `${weekBody.substring(0, 100)}`;

    const doFirst = 'One clear product task. Keep the session small.';
    const keepInMind = 'Protect energy. Eat protein early, hydrate. Keep the session small — one pass, not scope creep.';
    const canWait = 'Everything not directly blocking the next action.';

    const brief: TodayBrief = {
      notificationTitle,
      notificationBody,
      doFirst,
      keepInMind,
      canWait,
      draftPlan: buildDraftPlan(),
      dayMap: buildDayMap(),
      checkInPrompt: buildCheckInPrompt(),
      rawTranscriptPath: undefined, // populated after first check-in send
    };

    return NextResponse.json(brief);
  } catch (error) {
    console.error('Today API error:', error);
    return NextResponse.json({
      notificationTitle: 'Your morning brief is ready',
      notificationBody: 'One clear task. Keep the session small.',
      doFirst: 'One clear product task.',
      keepInMind: 'Protect energy. Keep the session small.',
      canWait: 'Everything not directly blocking the next action.',
      draftPlan: buildDraftPlan(),
      dayMap: buildDayMap(),
      checkInPrompt: 'Tell me where you are this morning.',
    } satisfies TodayBrief);
  }
}
