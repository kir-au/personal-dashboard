import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const VAULT_ROOT = path.join(process.env.HOME || '', 'personal-vault');

const EXCLUDED_DIRS = new Set(['config', 'exports', '.git']);

async function getAllMarkdownFiles(dir: string, baseDepth = 0): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          const subFiles = await getAllMarkdownFiles(fullPath, baseDepth + 1);
          files.push(...subFiles);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return files;
}

function getCategoryLabel(filePath: string): string {
  const relativePath = path.relative(VAULT_ROOT, filePath);
  if (relativePath.startsWith('raw/')) return 'raw';
  if (relativePath.startsWith('structured/projects/')) return 'project';
  if (relativePath.startsWith('structured/decisions/')) return 'decision';
  if (relativePath.startsWith('structured/facts/')) return 'fact';
  if (relativePath.startsWith('structured/summaries/')) return 'summary';
  if (relativePath.startsWith('indexes/')) return 'index';
  if (relativePath === 'README.md') return 'root';
  return 'other';
}

function extractTitle(content: string, filename: string): string {
  // Try to get title from frontmatter (first line starting with "title:" or "# ")
  const titleMatch = content.match(/^title:\s*(.+)$/m);
  if (titleMatch) return titleMatch[1].replace(/^["']|["']$/g, '');
  
  // Try first h1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1];
  
  // Fall back to filename without extension and date prefix
  const name = path.basename(filename, '.md');
  // Try to make it readable: "2026-05-23-codex-review-moltis-config" -> "Codex Review Moltis Config"
  const readable = name
    .replace(/^\d{4}-\d{2}-\d{2}-/, '') // Remove date prefix
    .replace(/[-_]/g, ' ')               // Replace separators with spaces
    .replace(/\b\w/g, c => c.toUpperCase()); // Title case
  return readable || name;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const allFiles = await getAllMarkdownFiles(VAULT_ROOT);
    
    const fileInfos: Array<{
      path: string;
      relativePath: string;
      name: string;
      size: number;
      mtime: number;
      category: string;
      title: string;
      preview: string;
      frontmatter: Record<string, unknown>;
    }> = [];

    for (const filePath of allFiles) {
      try {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const { data: frontmatter, content: markdownContent } = matter(content);
        const relativePath = path.relative(VAULT_ROOT, filePath);
        
        // Extract a short preview (first few lines of content)
        const previewLines = markdownContent
          .split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .slice(0, 3)
          .join(' ')
          .substring(0, 200);

        fileInfos.push({
          path: filePath,
          relativePath,
          name: path.basename(filePath),
          size: stats.size,
          mtime: stats.mtimeMs,
          category: getCategoryLabel(filePath),
          title: frontmatter?.title || extractTitle(content, filePath),
          preview: previewLines,
          frontmatter
        });
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
      }
    }

    // Sort by modification time descending (newest first)
    fileInfos.sort((a, b) => b.mtime - a.mtime);
    
    const limitedResults = fileInfos.slice(0, limit);

    return NextResponse.json({
      files: limitedResults,
      count: limitedResults.length,
      totalFiles: fileInfos.length,
      vaultRoot: VAULT_ROOT
    });
  } catch (error) {
    console.error('Error fetching recent files:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch recent files',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
