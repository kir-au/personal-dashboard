import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const PROJECT_INDEX_ROOT = path.join(VAULT_ROOT, 'indexes', 'projects');

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
    const indexPath = path.join(PROJECT_INDEX_ROOT, `${projectId}.json`);

    if (!indexPath.startsWith(PROJECT_INDEX_ROOT)) {
      throw new Error('Access denied');
    }

    const raw = await fs.readFile(indexPath, 'utf-8');
    const data = JSON.parse(raw);

    return NextResponse.json({
      ...data,
      conversations: Array.isArray(data.conversations) ? data.conversations : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('ENOENT') ? 404 : 500;

    return NextResponse.json({
      error: status === 404 ? 'Project sources not found' : 'Failed to read project sources',
      details: message,
      conversations: [],
    }, { status });
  }
}
