import { NextRequest, NextResponse } from 'next/server';
import fsp from 'fs/promises';
import path from 'path';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const { path: encodedPath } = await params;
    const decoded = decodeURIComponent(encodedPath);
    const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(VAULT_ROOT, normalized);

    if (!fullPath.startsWith(VAULT_ROOT)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const bytes = await fsp.readFile(fullPath);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentTypeFor(fullPath),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
}
