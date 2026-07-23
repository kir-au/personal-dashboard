import { NextResponse } from 'next/server';
import { appendHealthScheduleEvent } from '@/lib/healthSchedule';
import { readHealthPlans } from '@/lib/healthPlans';

interface MoveHealthSessionRequest {
  planId?: string;
  sourceDay?: number;
  toDate?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as MoveHealthSessionRequest;
    const planId = String(body.planId || '').trim();
    const sourceDay = Number(body.sourceDay);
    const toDate = String(body.toDate || '').trim();

    if (!planId || !Number.isInteger(sourceDay) || sourceDay < 1 || !isDateValue(toDate)) {
      return NextResponse.json(
        { error: 'planId, sourceDay, and a valid toDate are required.' },
        { status: 400 }
      );
    }

    const health = await readHealthPlans();
    const plan = health.plans.find((candidate) => candidate.id === planId);
    const session = plan?.days.find((day) => day.sourceDay === sourceDay);
    if (!plan || !session) {
      return NextResponse.json({ error: 'The selected health session was not found.' }, { status: 404 });
    }
    if (session.completed) {
      return NextResponse.json({ error: 'Completed health sessions cannot be moved.' }, { status: 409 });
    }

    if (session.date === toDate) {
      return NextResponse.json({ event: null, session, unchanged: true });
    }

    const event = await appendHealthScheduleEvent({
      planId,
      sourceDay,
      fromDate: session.date,
      toDate,
    });

    return NextResponse.json({
      event,
      session: {
        ...session,
        date: toDate,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Unable to move the health session.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

function isDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}
