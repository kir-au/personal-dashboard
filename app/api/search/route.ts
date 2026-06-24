import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const VAULT_PATH = path.join(process.env.HOME || '', 'personal-vault');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getAllMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllMarkdownFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '50');
    const queryPattern = query ? new RegExp(escapeRegExp(query), 'g') : null;

    if (!query || query.trim() === '') {
      return NextResponse.json({ 
        results: [],
        count: 0,
        query: ''
      });
    }

    // Get all markdown files
    const allFiles = await getAllMarkdownFiles(VAULT_PATH);
    const results: Array<{
      path: string;
      relativePath: string;
      name: string;
      size: number;
      mtime: number;
      frontmatter: any;
      content: string;
      score: number;
      matches: string[];
    }> = [];

    for (const filePath of allFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const { data: frontmatter, content: markdownContent } = matter(content);
        const relativePath = path.relative(VAULT_PATH, filePath);
        const stats = await fs.stat(filePath);

        // Simple search scoring
        let score = 0;
        const matches: string[] = [];

        // Check in frontmatter
        const frontmatterStr = JSON.stringify(frontmatter).toLowerCase();
        if (frontmatterStr.includes(query)) {
          score += 3;
          matches.push('frontmatter');
        }

        // Check in content
        const contentLower = markdownContent.toLowerCase();
        if (contentLower.includes(query)) {
          score += 1;
          matches.push('content');
          
          // Count occurrences
          const occurrences = queryPattern ? (contentLower.match(queryPattern) || []).length : 0;
          score += Math.min(occurrences * 0.1, 2); // Max 2 points for frequency
        }

        // Check in filename
        const fileName = path.basename(filePath).toLowerCase();
        if (fileName.includes(query)) {
          score += 2;
          matches.push('filename');
        }

        if (score > 0) {
          results.push({
            path: filePath,
            relativePath,
            name: path.basename(filePath),
            size: stats.size,
            mtime: stats.mtimeMs,
            frontmatter,
            content: markdownContent.substring(0, 500) + '...', // Preview
            score,
            matches
          });
        }
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
        // Continue with other files
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Limit results
    const limitedResults = results.slice(0, limit);

    return NextResponse.json({
      results: limitedResults,
      count: limitedResults.length,
      totalMatches: results.length,
      query
    });
  } catch (error) {
    console.error('Error searching vault:', error);
    return NextResponse.json({ 
      error: 'Failed to search vault',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
