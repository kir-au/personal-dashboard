import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';
import { readHealthPlans } from '@/lib/healthPlans';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const ACTIVITY_LOG_PATH = path.join(VAULT_ROOT, 'structured', 'health', 'activity-log.jsonl');

export async function GET() {
  try {
    const health = await readHealthPlans();
    const primaryPlan = health.plans.find((plan) => plan.projectId === 'shoulder-rehab') || health.plans[0];
    const activityLog = await readActivityLog();

    return NextResponse.json({
      ...(primaryPlan || {}),
      title: 'Health plans',
      goal: primaryPlan?.goal || 'Keep current health commitments visible and realistic.',
      rule: primaryPlan?.rule || 'Progress only when body response is green.',
      exerciseKey: health.plans.flatMap((plan) => plan.exerciseKey),
      notes: primaryPlan?.notes || [],
      plans: health.plans,
      days: health.days,
      todayDate: health.todayDate,
      today: health.today,
      upcoming: health.upcoming,
      activityLog,
      sourcePath: 'structured/health/*-plan.json',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Health project plan not available',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 404 }
    );
  }
}

async function readActivityLog() {
  try {
    const raw = await fsp.readFile(ACTIVITY_LOG_PATH, 'utf-8');
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  } catch {
    return [];
  }
}
