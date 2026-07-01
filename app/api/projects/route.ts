import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');
const REGISTRY_PATH = path.join(VAULT_ROOT, 'structured', 'projects', 'registry.json');

type ProjectRecord = {
  id: string;
  title: string;
  status?: string;
  area?: string;
  summary?: string;
  next?: string;
  icon?: string;
  archived?: boolean;
  system?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function readRegistry(): Promise<{ updatedAt: string; projects: ProjectRecord[] }> {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return { updatedAt: new Date().toISOString(), projects: [] };
  }
}

async function writeRegistry(projects: ProjectRecord[]) {
  await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await fs.writeFile(REGISTRY_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), projects }, null, 2) + '\n', 'utf-8');
}

export async function GET() {
  const registry = await readRegistry();
  return NextResponse.json({
    ...registry,
    projects: registry.projects.filter((project) => !project.archived),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = String(body.title || '').trim();
    if (!title) {
      return NextResponse.json({ ok: false, error: 'Missing project title' }, { status: 400 });
    }

    const registry = await readRegistry();
    const id = slugify(String(body.id || title));
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Invalid project id' }, { status: 400 });
    }
    if (registry.projects.some((project) => project.id === id && !project.archived)) {
      return NextResponse.json({ ok: false, error: 'Project already exists' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id,
      title,
      status: String(body.status || 'open').toLowerCase(),
      area: String(body.area || id).toLowerCase(),
      summary: String(body.summary || 'New project. Capture sources first, then extract actions.'),
      next: String(body.next || 'Add the first relevant capture or source.'),
      icon: String(body.icon || 'project'),
      createdAt: now,
      updatedAt: now,
    };

    const projects = [...registry.projects.filter((item) => item.id !== id), project];
    await writeRegistry(projects);

    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
