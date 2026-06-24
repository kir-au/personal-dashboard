import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

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
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(fallbackHealthState);
  }
}
