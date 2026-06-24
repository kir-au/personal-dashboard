import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const { path: filePath } = await params;
    
    // Decode URL components
    const decodedPath = decodeURIComponent(filePath);
    const fullPath = path.join(VAULT_ROOT, decodedPath);
    
    // Security check: ensure the path is within the vault
    const resolvedRoot = path.resolve(VAULT_ROOT);
    const resolvedFull = path.resolve(fullPath);
    if (!resolvedFull.startsWith(resolvedRoot)) {
      return NextResponse.json({ 
        error: 'Access denied' 
      }, { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(resolvedFull);
    } catch {
      return NextResponse.json({ 
        error: 'File not found',
        path: decodedPath
      }, { status: 404 });
    }

    // Read file content
    const content = await fs.readFile(resolvedFull, 'utf-8');
    
    // Parse frontmatter
    const { data: frontmatter, content: markdownContent } = matter(content);
    
    // Get file stats
    const stats = await fs.stat(resolvedFull);

    return NextResponse.json({
      path: decodedPath,
      fullPath: resolvedFull,
      frontmatter,
      content: markdownContent,
      rawContent: content,
      stats: {
        size: stats.size,
        mtime: stats.mtimeMs,
        ctime: stats.ctimeMs
      }
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json({ 
      error: 'Failed to read file',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
