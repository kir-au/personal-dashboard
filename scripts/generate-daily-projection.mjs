import fs from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const OUTPUT_PATH = path.join(VAULT_ROOT, 'structured', 'plans', 'daily-projection.json');

function getSydneyDate(offset = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offset);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function readJsonl(relativePath) {
  try {
    const raw = await fs.readFile(path.join(VAULT_ROOT, relativePath), 'utf-8');
    return raw.split('\n').map((line) => line.trim()).filter(Boolean).map(parseJsonLine).filter(Boolean);
  } catch {
    return [];
  }
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(VAULT_ROOT, relativePath), 'utf-8'));
  } catch {
    return fallback;
  }
}

function daysAgo(dateValue) {
  const time = new Date(dateValue || 0).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / 86_400_000;
}

function byProject(entries) {
  const result = new Map();
  for (const entry of entries) {
    const project = entry.projectId || entry.project || 'inbox';
    const list = result.get(project) || [];
    list.push(entry);
    result.set(project, list);
  }
  return result;
}

function task({ id, title, area, status = 'suggested', source, date, horizon, priority, projectId, detail }) {
  return { id, title, area, status, source, date, horizon, priority, projectId, detail };
}

async function main() {
  const today = getSydneyDate(0);
  const tomorrow = getSydneyDate(1);
  const captures = (await readJsonl('indexes/captures.jsonl')).filter((entry) => daysAgo(entry.created) <= 30);
  const projectSources = await readJsonl('indexes/project-conversations.jsonl');
  const aiInsights = await readJson('structured/projects/ai-insights.json', null);
  const healthPlan = await readJson('structured/health/5k-running-plan.json', null);
  const activityLog = await readJsonl('structured/health/activity-log.jsonl');
  const registry = await readJson('structured/projects/registry.json', { projects: [] });

  const capturesByProject = byProject(captures);
  const sourcesByProject = byProject(projectSources);
  const latestActivity = activityLog.slice().reverse().find((entry) => entry.date <= today);
  const tomorrowRun =
    healthPlan?.days?.find?.((day) => day.date === tomorrow) ||
    healthPlan?.weeks?.find?.((week) => week.starts === tomorrow);
  const tomorrowRunTitle = tomorrowRun?.title || (tomorrowRun ? `Week ${tomorrowRun.week}: Quality run` : null);
  const tomorrowRunPlan = tomorrowRun?.plan || tomorrowRun?.qualitySession || null;
  const healthRule = healthPlan?.rule || healthPlan?.rules?.[0] || 'Only progress if recovery is green.';

  const todayTasks = [
    task({
      id: 'today-ai-projection',
      title: 'Turn recent vault records into a visible Today/Tomorrow projection.',
      area: 'AI',
      status: 'planned',
      source: 'captures.jsonl + structured/projects + current Codex discussion',
      date: today,
      horizon: 'today',
      priority: 100,
      projectId: 'ai',
      detail: 'Generate assistant review cards and dated tasks from the last 30 days instead of static planner text.',
    }),
    task({
      id: 'today-health-logged',
      title: latestActivity
        ? `Health logged: ${latestActivity.summary}`
        : 'Log today’s health baseline if anything changed.',
      area: 'Health',
      status: latestActivity?.date === today ? 'done' : 'suggested',
      source: latestActivity?.rawPath || 'structured/health/activity-log.jsonl',
      date: today,
      horizon: 'today',
      priority: 90,
      projectId: 'health',
      detail: latestActivity?.calories?.totalEstimatedCalories
        ? `Estimated burn: ~${latestActivity.calories.totalEstimatedCalories} kcal.`
        : 'Keep health state current before adding more plans.',
    }),
    task({
      id: 'today-ai-capture-loop',
      title: 'Use the header capture/voice box as the control input when plans change.',
      area: 'AI',
      status: 'planned',
      source: 'Personal Assistant Rolling Strategy + recent voice capture tests',
      date: today,
      horizon: 'today',
      priority: 80,
      projectId: 'ai',
      detail: 'Capture raw first; processor decides whether it becomes task, health log, review item, or nothing.',
    }),
    task({
      id: 'today-wealth-review',
      title: 'Decide whether the super contribution/tax thread still needs action after EOFY.',
      area: 'Wealth',
      status: 'review',
      source: 'indexes/projects/wealth.json -> Супер-конtribьюшн и налоговые вычеты',
      date: today,
      horizon: 'today',
      priority: 70,
      projectId: 'wealth',
      detail: 'This is not an automatic task; it is a resurfaced review candidate from the Wealth sources.',
    }),
  ];

  const tomorrowTasks = [
    task({
      id: 'tomorrow-health-5k-week-1',
      title: tomorrowRun
        ? `${tomorrowRunTitle}: ${tomorrowRunPlan}`
        : 'Check the next running/health block.',
      area: 'Health',
      status: 'planned',
      source: 'structured/health/5k-running-plan.json',
      date: tomorrow,
      horizon: 'tomorrow',
      priority: 95,
      projectId: 'health',
      detail: healthRule,
    }),
    task({
      id: 'tomorrow-ai-processor',
      title: 'AI backlog: replace heuristic projection with a real review processor.',
      area: 'AI',
      status: 'suggested',
      source: 'structured/projects/ai-backlog.json',
      date: tomorrow,
      horizon: 'tomorrow',
      priority: 90,
      projectId: 'ai',
      detail: 'Why not done: current projection is rule-based and does not yet ask questions, create approval-ready updates, or deeply review raw project context.',
    }),
    task({
      id: 'tomorrow-business-promote-source',
      title: 'Promote one Business source into a concrete next action or mark it as reference.',
      area: 'Business',
      status: 'review',
      source: 'indexes/projects/business.json',
      date: tomorrow,
      horizon: 'tomorrow',
      priority: 65,
      projectId: 'business',
      detail: `${sourcesByProject.get('business')?.length || 0} linked Business sources exist, but no current dated commitment is selected.`,
    }),
  ];

  const reviewQueue = [
    task({
      id: 'review-ai-publishing-series-history',
      title: 'Review the old AI publishing series: drop it, or promote only what still matters.',
      area: 'AI',
      status: 'review',
      source: 'structured/projects/ai-publishing-plan.json + current project dashboard decision logic',
      horizon: 'this-week',
      priority: 95,
      projectId: 'ai',
      detail: 'The June publishing plan is now historical. It should not stay in the active AI project plan unless a specific article is still relevant and gets promoted into the current timeline.',
    }),
    task({
      id: 'review-ai-workstreams',
      title: aiInsights?.suggestedActions?.[0]?.title || 'Define project extraction format.',
      area: 'AI',
      status: 'review',
      source: 'structured/projects/ai-insights.json',
      horizon: 'this-week',
      priority: 85,
      projectId: 'ai',
      detail: aiInsights?.suggestedActions?.[0]?.description || '',
    }),
    task({
      id: 'review-health-running-reference',
      title: 'Add a clear reference for the 5K quality run if the session is still unclear.',
      area: 'Health',
      status: 'review',
      source: 'structured/health/5k-running-plan.json',
      horizon: 'this-week',
      priority: 75,
      projectId: 'health',
      detail: 'The Health timeline has a quality-run item but no visual/media reference. Either keep the text explanation, add a reference, or ask for a better example.',
    }),
    task({
      id: 'review-family-context',
      title: 'Keep Family visible but do not turn source history into task debt automatically.',
      area: 'Family',
      status: 'review',
      source: 'indexes/projects/family.json',
      horizon: 'this-week',
      priority: 50,
      projectId: 'family',
      detail: `${sourcesByProject.get('family')?.length || 0} linked Family sources exist. Surface only when there is an explicit commitment or decision.`,
    }),
  ];

  const projection = {
    title: 'Daily projection from Personal Vault',
    weekFocus: 'Use recent captures and project sources to choose a small number of visible commitments, not a static task list.',
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/generate-daily-projection.mjs',
    windowDays: 30,
    dates: { today, tomorrow },
    generatedFrom: [
      `${captures.length} captures from the last 30 days`,
      `${projectSources.length} project-linked conversations`,
      `${registry.projects?.length || 0} project registry entries`,
      'structured decisions, project notes, health plans, and activity logs',
    ],
    tasks: [...todayTasks, ...tomorrowTasks, ...reviewQueue],
    projectSignals: Array.from(new Set([...capturesByProject.keys(), ...sourcesByProject.keys()])).map((projectId) => ({
      projectId,
      captures: capturesByProject.get(projectId)?.length || 0,
      sources: sourcesByProject.get(projectId)?.length || 0,
    })),
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(projection, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(JSON.stringify({ today, tomorrow, tasks: projection.tasks.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
