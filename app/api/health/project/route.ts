import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const PLAN_PATH = path.join(VAULT_ROOT, 'structured', 'health', 'shoulder-rehab-plan.json');

function getTodayDate() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(now);
}

export async function GET() {
  try {
    const raw = await fsp.readFile(PLAN_PATH, 'utf-8');
    const plan = JSON.parse(raw);
    const todayDate = getTodayDate();
    const today = plan.days?.find((day: { date: string }) => day.date === todayDate) ?? null;

    return NextResponse.json({
      ...plan,
      todayDate,
      today,
      sourcePath: 'structured/health/shoulder-rehab-plan.json',
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
