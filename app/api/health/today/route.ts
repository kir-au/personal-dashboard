import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';
import { readHealthPlans } from '@/lib/healthPlans';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const HEALTH_STATE_PATH = path.join(VAULT_ROOT, 'structured', 'health', 'health-state.json');

const fallbackHealthState = {
  updatedAt: new Date().toISOString(),
  area: 'health',
  activeProject: {
    id: 'health',
    title: 'Health',
    status: 'unknown',
    phase: 'No structured health project is available yet.',
    sourcePath: null,
  },
  today: {
    title: 'Health today',
    primaryAction: 'Capture current energy, sleep, body state, and training constraints.',
    details: ['Add a health check-in so the dashboard can suggest a practical next action.'],
    avoid: [],
    progressionRule: 'Do not progress training without current body-state information.',
  },
  lastWorkout: null,
  openQuestions: ['How is the shoulder today?', 'What was the last workout?'],
  sources: [],
};

export async function GET() {
  try {
    const raw = await fsp.readFile(HEALTH_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const healthPlans = await readHealthPlans().catch(() => null);
    const commitment = healthPlans?.today || healthPlans?.upcoming || null;
    if (!commitment) return NextResponse.json(parsed);
    const commitmentPlan = healthPlans?.plans.find((plan) => plan.id === commitment.planId) || null;
    const rules = commitmentPlan?.notes?.length
      ? commitmentPlan.notes
      : [commitmentPlan?.rule || parsed.today?.progressionRule || 'Progress only when body response is green.'];

    return NextResponse.json({
      ...parsed,
      activeProject: {
        ...parsed.activeProject,
        id: commitment.projectId || parsed.activeProject?.id || 'health',
        title: commitment.planTitle || parsed.activeProject?.title || 'Health',
        status: commitment.planStatus || parsed.activeProject?.status || 'active',
        phase: commitmentPlan?.goal || parsed.activeProject?.phase || null,
        sourcePath: commitment.sourcePath || parsed.activeProject?.sourcePath || null,
      },
      today: {
        ...parsed.today,
        title: commitment.planTitle || parsed.today?.title || 'Health today',
        primaryAction: commitment.title,
        details: [commitment.plan],
        avoid: rules.filter((item) => /do not|if |avoid|only if|recovery|fatigue|pain|swelling|symptoms/i.test(item)).slice(0, 8),
        progressionRule: commitmentPlan?.rule || rules[0] || parsed.today?.progressionRule,
      },
      planCommitment: commitment,
      todayActivity: parsed.todayActivity || null,
      healthPlans: healthPlans?.plans.map((plan) => ({
        id: plan.id,
        projectId: plan.projectId,
        title: plan.title,
        status: plan.status,
        today: plan.today,
        upcoming: plan.upcoming,
      })),
    });
  } catch {
    return NextResponse.json(fallbackHealthState);
  }
}
