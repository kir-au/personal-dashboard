import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VAULT_PATH = path.join(process.env.HOME || '', 'personal-vault');

function safeJoinVault(relativePath: string) {
  const normalized = path.normalize(relativePath || '').replace(/^(\.\.(\/|\\|$))+/, '');
  const targetPath = path.join(VAULT_PATH, normalized);
  if (!targetPath.startsWith(VAULT_PATH)) {
    throw new Error('Access denied');
  }
  return { targetPath, relativePath: path.relative(VAULT_PATH, targetPath) };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedPath = searchParams.get('path') || '';
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let targetPath = VAULT_PATH;
    let currentPath = '';
    
    if (requestedPath) {
      const safe = safeJoinVault(requestedPath);
      targetPath = safe.targetPath;
      currentPath = safe.relativePath;
    } else if (year) {
      targetPath = path.join(targetPath, year);
      if (month) {
        targetPath = path.join(targetPath, month);
      }
      currentPath = path.relative(VAULT_PATH, targetPath);
    }

    // Check if path exists
    try {
      await fs.access(targetPath);
    } catch {
      return NextResponse.json({ 
        files: [], 
        directories: [],
        currentPath,
        exists: false 
      });
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    
    const files = entries
      .filter(entry => entry.isFile() && !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: path.join(targetPath, entry.name),
        relativePath: path.relative(VAULT_PATH, path.join(targetPath, entry.name)),
        size: 0, // We'll get this separately
        mtime: 0
      }));

    const directories = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: path.join(targetPath, entry.name),
        relativePath: path.relative(VAULT_PATH, path.join(targetPath, entry.name))
      }));

    // Get file stats
    for (const file of files) {
      try {
        const stats = await fs.stat(file.path);
        file.size = stats.size;
        file.mtime = stats.mtimeMs;
      } catch (err) {
        console.error(`Error getting stats for ${file.path}:`, err);
      }
    }

    // Sort files by name (date) descending
    files.sort((a, b) => b.name.localeCompare(a.name));
    
    // Sort directories by name (year/month) descending
    directories.sort((a, b) => b.name.localeCompare(a.name));

    return NextResponse.json({ 
      files, 
      directories,
      currentPath,
      vaultRoot: VAULT_PATH,
      exists: true
    });
  } catch (error) {
    console.error('Error reading vault:', error);
    return NextResponse.json({ 
      error: 'Failed to read vault directory',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
