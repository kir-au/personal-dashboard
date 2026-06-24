import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');

interface HorizonBlock {
  title: string;
  body: string;
  items: string[];
  source?: { label: string; path: string };
}

interface ActivityBlock {
  title: string;
  body: string;
  filesChanged: number;
  highlights: string[];
}

interface BriefPlanItem {
  area: 'Product / Work' | 'Health / Food / Energy' | 'Family / Life' | 'Admin / Loose ends';
  item: string;
  rationale?: string;
}

interface DailyBrief {
  orientation: string;
  doFirst: string;
  keepInMind: string;
  canWait: string;
  draftPlan: BriefPlanItem[];
  dayMap: DayMapBlock[];
  changedSinceYesterday: string;
  checkInQuestions: string[];
}

interface DayMapBlock {
  label: string;
  kind: 'check-in' | 'work' | 'health' | 'food' | 'family' | 'admin' | 'recovery';
  timeHint?: string;
  text: string;
  flexible: boolean;
}

interface ResumeResponse {
  headline: string;
  dailyBrief: DailyBrief;
  currentState: Array<{ label: string; status: string }>;
  recommendedAction: { title: string; why: string; agent: string; action: string };
  stillMatters: Array<{ title: string; path: string; reason: string }>;
  recentChanges: Array<{ relativePath: string; name: string; mtime: number; title: string; category: string }>;
  horizons: { year: HorizonBlock; month: HorizonBlock; week: HorizonBlock; today: HorizonBlock };
  activitySummary: { today: ActivityBlock; week: ActivityBlock };
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryForPath(relativePath: string): string {
  if (relativePath.startsWith('raw/')) return 'raw';
  if (relativePath.startsWith('structured/projects/')) return 'project';
  if (relativePath.startsWith('structured/decisions/')) return 'decision';
  if (relativePath.startsWith('structured/facts/')) return 'fact';
  if (relativePath.startsWith('structured/summaries/')) return 'summary';
  if (relativePath.startsWith('structured/profiles/')) return 'profile';
  if (relativePath.startsWith('structured/strategies/')) return 'strategy';
  if (relativePath.startsWith('structured/plans/')) return 'plan';
  if (relativePath.startsWith('indexes/')) return 'index';
  return 'other';
}

function getLocalMidnightMs(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return midnight.getTime();
}

function get7DaysAgoMs(): number {
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function linesAfterHeading(content: string, heading: string, maxLines = 15): string[] {
  const lines = content.split('\n');
  let found = false;
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Match ## or ### headings (case-insensitive prefix)
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

// ---------------------------------------------------------------------------
// Horizon builders
// ---------------------------------------------------------------------------

async function buildYearHorizon(): Promise<HorizonBlock> {
  const defaultBlock: HorizonBlock = {
    title: 'Year direction',
    body: 'Build a personal execution and memory system.',
    items: [],
  };

  const dirPath = path.join(VAULT_ROOT, 'structured', 'strategies');
  try {
    const entries = await fsp.readdir(dirPath);
    const file = entries.find(e => e.startsWith('2026') && e.endsWith('personal-direction.md'));
    if (!file) return defaultBlock;
    const content = await fsp.readFile(path.join(dirPath, file), 'utf-8');
    const { data, content: body } = matter(content);

    const bodyText = readFirstBodyLines(body);
    const goals = extractListItemsAfterHeading(body, 'Year Goals');

    return {
      title: (data as any)?.title || 'Year direction',
      body: bodyText || defaultBlock.body,
      items: goals.length > 0 ? goals : extractListItemsAfterHeading(body, 'Durable Focus Areas'),
      source: {
        label: (data as any)?.title || file,
        path: `structured/strategies/${file}`,
      },
    };
  } catch {
    return defaultBlock;
  }
}

async function buildMonthHorizon(): Promise<HorizonBlock> {
  const now = new Date();
  const currentMonth = now.toLocaleString('en-US', { month: 'long', timeZone: 'Australia/Sydney' });
  const currentYear = now.getFullYear(); // 2026

  const defaultBlock: HorizonBlock = {
    title: `Month focus — ${currentMonth} ${currentYear}`,
    body: 'Stabilize the system before adding scope.',
    items: [],
  };

  const planPath = path.join(VAULT_ROOT, 'structured', 'plans', '2026-05-24-2026-operating-plan.md');
  try {
    const content = await fsp.readFile(planPath, 'utf-8');
    const { data, content: planBody } = matter(content);

    // Find the monthly section for the current month
    const monthHeading = linesAfterHeading(planBody, 'Monthly Direction', 30);
    // Walk through monthly sections
    const lines = planBody.split('\n');
    let currentSection: string[] = [];
    let foundSection: string[] = [];
    let currentTheme = '';
    let foundTheme = '';
    let inTarget = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(/^###\s+(.+)/);
      if (sectionMatch) {
        // Check if this section is for the current month
        if (sectionMatch[1].toLowerCase().startsWith(currentMonth.toLowerCase())) {
          inTarget = true;
          foundTheme = sectionMatch[1];
          foundSection = [];
          continue;
        } else {
          inTarget = false;
        }
      }
      if (inTarget) {
        if (trimmed.startsWith('#')) break;
        if (trimmed) foundSection.push(trimmed);
      }
    }

    if (foundSection.length > 0) {
      const themeLine = foundTheme || `Direction for ${currentMonth}`;
      const body = foundSection.slice(0, 2).join(' ').substring(0, 250);
      const items = foundSection.slice(1).filter(l => l.startsWith('-')).map(l => l.replace(/^- /, '').trim());

      return {
        title: themeLine,
        body: body || defaultBlock.body,
        items: items.length > 0 ? items : [],
        source: {
          label: '2026 Operating Plan',
          path: 'structured/plans/2026-05-24-2026-operating-plan.md',
        },
      };
    }

    // Fallback: read the current month section info from the headings
    return {
      ...defaultBlock,
      source: {
        label: '2026 Operating Plan',
        path: 'structured/plans/2026-05-24-2026-operating-plan.md',
      },
    };
  } catch {
    return defaultBlock;
  }
}

async function buildWeekHorizon(): Promise<HorizonBlock> {
  const defaultBlock: HorizonBlock = {
    title: 'Week vector',
    body: 'Pick one product task, one health task, and one control task.',
    items: [],
  };

  const planPath = path.join(VAULT_ROOT, 'structured', 'plans', '2026-05-24-2026-operating-plan.md');
  const profilePath = path.join(VAULT_ROOT, 'structured', 'profiles', '2026-05-24-kirill-operating-profile.md');

  const items: string[] = [];

  try {
    const planContent = await fsp.readFile(planPath, 'utf-8');
    const { content: planBody } = matter(planContent);

    const weeklyDefault = linesAfterHeading(planBody, 'Weekly Default', 5);
    if (weeklyDefault.length > 0) {
      items.push(...weeklyDefault);
    }

    // Also pick the current product bridge hints
    const bridge = linesAfterHeading(planBody, 'Current Product Bridge', 8);
    if (bridge.length > 0) {
      items.push(...bridge);
    }
  } catch {
    // fallback
  }

  try {
    const profileContent = await fsp.readFile(profilePath, 'utf-8');
    const { data: profileData } = matter(profileContent);

    return {
      title: 'Week vector',
      body: items.length > 0 ? items.slice(0, 2).join('. ') : defaultBlock.body,
      items: [
        items.length > 0 ? items.slice(0, 1).join(' ') : 'One product task, one health task, one control task',
        ...(items.slice(1, 4) || []),
        'Use weekly review as the main execution loop',
      ],
      source: {
        label: (profileData as any)?.title || 'Operating Plan & Profile',
        path: 'structured/plans/2026-05-24-2026-operating-plan.md',
      },
    };
  } catch {
    return {
      ...defaultBlock,
      source: {
        label: 'Operating Plan & Profile',
        path: 'structured/plans/2026-05-24-2026-operating-plan.md',
      },
    };
  }
}

function buildTodayHorizon(todaySummary: ActivityBlock): HorizonBlock {
  const highlights = todaySummary.highlights;
  const items: string[] = [];

  if (highlights.length > 0) {
    items.push(`Review today's changes: ${highlights.slice(0, 3).join(', ')}`);
  } else {
    items.push('Review recent changes in the vault');
  }
  items.push('Choose the next small implementation step');
  items.push('Keep the session small and deterministic');

  return {
    title: 'Today vector',
    body: highlights.length > 0
      ? `${todaySummary.filesChanged} file(s) changed today.`
      : 'Understand what changed and choose the next small implementation step.',
    items,
  };
}

// ---------------------------------------------------------------------------
// Day Map builder
// ---------------------------------------------------------------------------

function buildDayMap(): DayMapBlock[] {
  return [
    {
      label: 'Morning check-in',
      kind: 'check-in',
      text: 'Voice-first check-in to capture energy, sleep, mood, body, alcohol, and main constraint.',
      flexible: false,
    },
    {
      label: 'Product / Work focus',
      kind: 'work',
      text: 'One product task. Keep it small enough to finish in under 90 minutes.',
      flexible: true,
    },
    {
      label: 'Food / Energy reminder',
      kind: 'food',
      text: 'Eat protein early. Hydrate. No alcohol for work activation.',
      flexible: true,
    },
    {
      label: 'Exercise / Recovery',
      kind: 'recovery',
      timeHint: 'Afternoon',
      text: 'Walk, stretch, or train. Protect the body baseline.',
      flexible: true,
    },
    {
      label: 'Family / Life',
      kind: 'family',
      text: 'Keep family and life context visible even if no task exists.',
      flexible: true,
    },
    {
      label: 'Admin / Loose ends',
      kind: 'admin',
      text: 'Review changed notes only if needed.',
      flexible: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Aggregate helpers (unchanged)
// ---------------------------------------------------------------------------

async function collectAllFiles() {
  const excluded = new Set(['config', 'exports', '.git']);
  const allFiles: Array<{
    relativePath: string;
    name: string;
    mtime: number;
    title: string;
    category: string;
  }> = [];

  async function walk(dir: string) {
    let entries: any;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true }) as any;
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const stats = await fsp.stat(fullPath);
          const content = await fsp.readFile(fullPath, 'utf-8');
          const { data } = matter(content);
          const relativePath = path.relative(VAULT_ROOT, fullPath);
          const title =
            (data as any)?.title ||
            entry.name.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          allFiles.push({ relativePath, name: entry.name, mtime: stats.mtimeMs, title, category: getCategoryForPath(relativePath) });
        } catch { /* skip */ }
      }
    }
  }

  await walk(VAULT_ROOT);
  allFiles.sort((a, b) => b.mtime - a.mtime);
  return allFiles;
}

async function collectStillMatters() {
  const items: Array<{ title: string; path: string; reason: string }> = [];
  const structuredDirs = ['projects', 'decisions', 'facts'];
  for (const dir of structuredDirs) {
    const dirPath = path.join(VAULT_ROOT, 'structured', dir);
    try {
      const entries = await fsp.readdir(dirPath);
      for (const entry of entries.sort().reverse().slice(0, 5)) {
        if (!entry.endsWith('.md')) continue;
        const fullPath = path.join(dirPath, entry);
        const content = await fsp.readFile(fullPath, 'utf-8');
        const { data } = matter(content);
        const imp = (data as any)?.importance ?? 5;
        if (imp >= 7 && (data as any)?.status === 'active') {
          const reason = (data as any)?.description
            ? (data as any).description.substring(0, 100)
            : `Active project with ${imp}/10 priority.`;
          items.push({ title: (data as any)?.title || entry.replace('.md', ''), path: `structured/${dir}/${entry}`, reason });
        }
      }
    } catch { /* skip */ }
  }
  return items.slice(0, 3);
}

function buildActivitySummary(
  files: Array<{ relativePath: string; mtime: number; title: string; category: string }>,
  sinceMs: number,
  label: string
): ActivityBlock {
  const relevant = files.filter((f) => f.mtime >= sinceMs);
  const catCounts = new Map<string, number>();
  for (const f of relevant) catCounts.set(f.category, (catCounts.get(f.category) || 0) + 1);

  const catLabels: Record<string, string> = {
    raw: 'raw logs', project: 'project notes', decision: 'decisions', fact: 'facts',
    summary: 'summaries', index: 'indexes', profile: 'profile updates', strategy: 'strategy notes', plan: 'plan updates', other: 'other',
  };
  const catSummary = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).map(([cat, count]) => `${count} ${catLabels[cat] || cat}`).join(', ');
  const highlights = relevant.slice(0, 5).map((f) => f.title);
  const filesChanged = relevant.length;
  const body = filesChanged === 0 ? `No files changed ${label.toLowerCase()}.` : `${filesChanged} file${filesChanged !== 1 ? 's' : ''} modified (${catSummary}).`;
  return { title: label, body, filesChanged, highlights };
}

// ---------------------------------------------------------------------------
// Daily Brief builder
// ---------------------------------------------------------------------------

async function buildDailyBrief(
  yearHorizon: HorizonBlock,
  monthHorizon: HorizonBlock,
  weekHorizon: HorizonBlock,
  todaySummary: ActivityBlock,
  topRecent: Array<{ relativePath: string; title: string; category: string }>,
): Promise<DailyBrief> {
  // Orientation: derived from today's context
  const todayChangedCount = todaySummary.filesChanged;
  const orientation = todayChangedCount > 0
    ? `You updated the Personal Vault direction last night. Today the useful move is to make the dashboard simpler and more actionable.`
    : `The system has your year direction and monthly focus ready. Today's useful move is a small, visible improvement to the dashboard.`;

  // doFirst: prioritise the recommended action in human terms
  const doFirst = 'Simplify Resume Me into a morning brief. Turn the horizon tabs into a single Today screen that orients you in under 30 seconds.';

  const keepInMind = 'Protect energy. Eat protein early, hydrate, and do not use alcohol for activation. Keep the session small — one pass, not scope creep.';

  const canWait = 'Old Planner JSON reconciliation. The vault has the data; no urgent migration needed today.';

  // Draft plan from vault data
  const draftPlan: BriefPlanItem[] = [
    { area: 'Product / Work', item: 'Simplify Resume Me into a morning brief. Keep it to one shaping pass.' },
    { area: 'Health / Food / Energy', item: 'Protect energy. Eat protein early, hydrate, and do not use alcohol for activation.', rationale: 'Operating profile guardrails' },
    { area: 'Family / Life', item: 'Keep family/life context visible even if no task exists yet.' },
    { area: 'Admin / Loose ends', item: 'Review today\'s changed notes only if needed.' },
  ];

  // What changed since yesterday
  const recentTitles = topRecent.slice(0, 3).map(f => f.title);
  const changedSinceYesterday = todayChangedCount > 0
    ? `Today ${todayChangedCount} note(s) changed: ${recentTitles.join(', ')}. The vault now has up-to-date direction, plan, and profile context — the UI needs to translate that into today\'s plan.`
    : `No notes have been modified today. The vault has your operating profile, year direction, and monthly plan ready to use.`;

  const checkInQuestions = [
    'What changed since this morning?',
    'How is your energy?',
    'What is blocking the next action?',
    'Should we continue, reduce scope, or switch context?',
  ];

  const dayMap = buildDayMap();

  return { orientation, doFirst, keepInMind, canWait, draftPlan, dayMap, changedSinceYesterday, checkInQuestions };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const allFiles = await collectAllFiles();
    const topRecent = allFiles.slice(0, 5);
    const topStill = await collectStillMatters();

    const midnightMs = getLocalMidnightMs();
    const weekAgoMs = get7DaysAgoMs();

    const todaySummary = buildActivitySummary(allFiles, midnightMs, 'Today');
    const weekSummary = buildActivitySummary(allFiles, weekAgoMs, 'This week');

    const [yearHorizon, monthHorizon, weekHorizon] = await Promise.all([
      buildYearHorizon(),
      buildMonthHorizon(),
      buildWeekHorizon(),
    ]);
    const todayHorizon = buildTodayHorizon(todaySummary);

    const dailyBrief = await buildDailyBrief(yearHorizon, monthHorizon, weekHorizon, todaySummary, topRecent);

    const response: ResumeResponse = {
      headline: 'What are we doing next?',
      dailyBrief,
      currentState: [
        { label: 'Personal Vault UI', status: 'Resume Me is live with vault-derived horizons and activity summaries.' },
        { label: 'Moltis', status: 'Backend and Playwright MCP available for browser verification.' },
        { label: 'Planner convergence', status: 'Old Planner JSON imported into vault as structured notes. Resume Me reads them directly.' },
      ],
      recommendedAction: {
        title: 'Test the vault-driven horizons',
        why: 'Year, month, and week horizons now read from Personal Vault structured notes instead of hardcoded copy. Verify the content is accurate and useful.',
        agent: 'Personal Vault Coder',
        action: 'Navigate horizons on the Resume Me screen and confirm each matches its source file.',
      },
      stillMatters: topStill,
      recentChanges: topRecent,
      horizons: {
        year: yearHorizon,
        month: monthHorizon,
        week: weekHorizon,
        today: todayHorizon,
      },
      activitySummary: {
        today: todaySummary,
        week: weekSummary,
      },
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Resume API error:', error);
    return NextResponse.json({
      headline: 'What are we doing next?',
      dailyBrief: {
        orientation: 'The system has your direction ready. Take a small step forward.',
        doFirst: 'Check the vault files are accessible.',
        keepInMind: 'Keep one pass, not scope creep.',
        canWait: 'Everything not directly blocking the next action.',
        draftPlan: [
          { area: 'Product / Work', item: 'Fix the reading issue and verify localhost.' },
          { area: 'Health / Food / Energy', item: 'Protect energy and baseline health.' },
          { area: 'Family / Life', item: 'Keep context visible.' },
          { area: 'Admin / Loose ends', item: 'Review today only if needed.' },
        ],
        dayMap: buildDayMap(),
        changedSinceYesterday: 'Vault API encountered an error. File content may be temporarily unavailable.',
        checkInQuestions: ['What changed since this morning?', 'How is your energy?', 'What is blocking the next action?', 'Should we continue, reduce scope, or switch context?'],
      },
      currentState: [{ label: 'Vault status', status: 'Could not read persisted state.' }],
      recommendedAction: {
        title: 'Review vault file structure',
        why: 'The resume endpoint encountered an error.',
        agent: 'Personal Vault Coder',
        action: 'Check file permissions and retry.',
      },
      stillMatters: [],
      recentChanges: [],
      horizons: {
        year: { title: 'Year', body: 'Data unavailable.', items: [] },
        month: { title: 'Month', body: 'Data unavailable.', items: [] },
        week: { title: 'Week', body: 'Data unavailable.', items: [] },
        today: { title: 'Today', body: 'Data unavailable.', items: [] },
      },
      activitySummary: {
        today: { title: 'Today', body: 'No data.', filesChanged: 0, highlights: [] },
        week: { title: 'Week', body: 'No data.', filesChanged: 0, highlights: [] },
      },
      updatedAt: new Date().toISOString(),
    } as ResumeResponse);
  }
}
