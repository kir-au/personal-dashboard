import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const PROJECT_INSIGHTS_ROOT = path.join(VAULT_ROOT, 'structured', 'projects');

function safeProjectId(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!normalized) throw new Error('Invalid project id');
  return normalized;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ project: string }> }
) {
  try {
    const { project } = await params;
    const projectId = safeProjectId(project);
    const insightsPath = path.join(PROJECT_INSIGHTS_ROOT, `${projectId}-insights.json`);

    if (!insightsPath.startsWith(PROJECT_INSIGHTS_ROOT)) {
      throw new Error('Access denied');
    }

    const raw = await fs.readFile(insightsPath, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('ENOENT') ? 404 : 500;

    return NextResponse.json({
      error: status === 404 ? 'Project insights not found' : 'Failed to read project insights',
      details: message,
    }, { status });
  }
}
