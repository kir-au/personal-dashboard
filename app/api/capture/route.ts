import { NextRequest, NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');

type CaptureSource = 'manual' | 'voice' | 'chat' | 'email' | 'file';

interface CaptureRequest {
  input: string;
  source?: CaptureSource;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'capture';
}

function classify(input: string) {
  const lower = input.toLowerCase();
  const isHealth = [
    'shoulder',
    'rehab',
    'gym',
    'workout',
    'pain',
    'sleep',
    'energy',
    'protein',
    'tennis',
    'volleyball',
  ].some((token) => lower.includes(token));

  const project = lower.includes('shoulder') || lower.includes('rehab') ? 'shoulder-rehab' : undefined;
  const type = isHealth ? 'health-log' : 'capture';
  const area = isHealth ? 'health' : 'inbox';

  return {
    area,
    type,
    project,
    dashboardRelevance: isHealth ? 'health-card' : 'review-queue',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CaptureRequest;
    const input = body.input?.trim();

    if (!input) {
      return NextResponse.json({ ok: false, error: 'Missing input' }, { status: 400 });
    }

    const now = body.createdAt ? new Date(body.createdAt) : new Date();
    const iso = now.toISOString();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    const classification = classify(input);

    const rawDir = path.join(VAULT_ROOT, 'raw', year, month);
    await fsp.mkdir(rawDir, { recursive: true });

    const titleSeed = input.split(/\s+/).slice(0, 8).join(' ');
    const filename = `${date}-capture-${slugify(titleSeed)}.md`;
    const fullPath = path.join(rawDir, filename);
    const relativePath = path.relative(VAULT_ROOT, fullPath);

    const content = [
      '---',
      `title: "Capture - ${date}"`,
      `created: "${iso}"`,
      `source: "${body.source || 'manual'}"`,
      `area: "${classification.area}"`,
      `type: "${classification.type}"`,
      classification.project ? `project: "${classification.project}"` : '',
      `dashboardRelevance: "${classification.dashboardRelevance}"`,
      'privacy: private',
      '---',
      '',
      '# Capture',
      '',
      input,
      '',
      '## Classification',
      '',
      `- area: ${classification.area}`,
      `- type: ${classification.type}`,
      classification.project ? `- project: ${classification.project}` : '',
      `- dashboard relevance: ${classification.dashboardRelevance}`,
      '',
    ].filter(Boolean).join('\n');

    await fsp.writeFile(fullPath, content, 'utf-8');

    return NextResponse.json({
      ok: true,
      path: relativePath,
      classification,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
