import { NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const PLAN_PATH = path.join(VAULT_ROOT, 'structured', 'projects', 'ai-publishing-plan.json');

function getTodayDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export async function GET() {
  try {
    const raw = await fsp.readFile(PLAN_PATH, 'utf-8');
    const plan = JSON.parse(raw);
    const todayDate = getTodayDate();
    const today = plan.days?.find((day: { date: string }) => day.date === todayDate) ?? null;
    const upcoming = plan.days?.find((day: { date: string; completed?: boolean }) => day.date >= todayDate && !day.completed) ?? null;

    return NextResponse.json({
      ...plan,
      todayDate,
      today,
      upcoming,
      sourcePath: 'structured/projects/ai-publishing-plan.json',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'AI publishing plan not available',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 404 }
    );
  }
}
