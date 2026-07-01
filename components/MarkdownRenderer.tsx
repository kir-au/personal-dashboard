'use client';

import { useEffect, useState } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  sourcePath?: string;
}

function isLocalMarkdownHref(href: string) {
  return Boolean(href)
    && !href.startsWith('#')
    && !href.startsWith('/')
    && !href.includes('://')
    && !href.startsWith('mailto:')
    && !href.startsWith('tel:')
    && href.split('#')[0].split('?')[0].toLowerCase().endsWith('.md');
}

function isLocalVaultHref(href: string) {
  return Boolean(href)
    && !href.startsWith('#')
    && !href.startsWith('/')
    && !href.includes('://')
    && !href.startsWith('mailto:')
    && !href.startsWith('tel:');
}

function normalizeVaultPath(path: string) {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join('/');
}

function vaultReaderHref(sourcePath: string | undefined, href: string) {
  const [pathAndQuery, hash = ''] = href.split('#');
  const sourceDir = sourcePath?.includes('/')
    ? sourcePath.split('/').slice(0, -1).join('/')
    : '';
  const targetFile = normalizeVaultPath(sourceDir ? `${sourceDir}/${pathAndQuery}` : pathAndQuery);
  const targetDir = targetFile.includes('/') ? targetFile.split('/').slice(0, -1).join('/') : '';
  const params = new URLSearchParams({ view: 'vault' });
  if (targetDir) params.set('path', targetDir);
  params.set('file', targetFile);
  return `/?${params.toString()}${hash ? `#${hash}` : ''}`;
}

function vaultAssetHref(sourcePath: string | undefined, href: string) {
  const [pathAndQuery, hash = ''] = href.split('#');
  const sourceDir = sourcePath?.includes('/')
    ? sourcePath.split('/').slice(0, -1).join('/')
    : '';
  const targetFile = normalizeVaultPath(sourceDir ? `${sourceDir}/${pathAndQuery}` : pathAndQuery);
  return `/api/vault-asset/${encodeURIComponent(targetFile)}${hash ? `#${hash}` : ''}`;
}

function rewriteLocalMarkdownLinks(sourcePath?: string) {
  return function transformer(tree: any) {
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.tagName === 'a' && node.properties?.href && isLocalMarkdownHref(String(node.properties.href))) {
        node.properties.href = vaultReaderHref(sourcePath, String(node.properties.href));
      } else if (node.tagName === 'a' && node.properties?.href && isLocalVaultHref(String(node.properties.href))) {
        node.properties.href = vaultAssetHref(sourcePath, String(node.properties.href));
      }
      if (node.tagName === 'img' && node.properties?.src && isLocalVaultHref(String(node.properties.src))) {
        node.properties.src = vaultAssetHref(sourcePath, String(node.properties.src));
      }
      if (Array.isArray(node.children)) {
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };
}

export async function renderMarkdownToHtml(content: string, sourcePath?: string) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeHighlight, {
      detect: true,
      ignoreMissing: true,
    })
    .use((() => rewriteLocalMarkdownLinks(sourcePath)) as any)
    .use(rehypeStringify);

  const file = await processor.process(content);
  return String(file);
}

export function htmlToReadableText(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  container.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,hr').forEach((node) => {
    node.append(document.createTextNode('\n'));
  });
  return container.textContent?.replace(/\n{3,}/g, '\n\n').trim() ?? '';
}

export default function MarkdownRenderer({ content, className = '', sourcePath }: MarkdownRendererProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderMarkdown = async () => {
      try {
        setHtml(await renderMarkdownToHtml(content, sourcePath));
        setError(null);
      } catch (err) {
        console.error('Error rendering markdown:', err);
        setError('Failed to render markdown');
        // Fallback to simple preformatted text
        setHtml(`<pre class="whitespace-pre-wrap">${content}</pre>`);
      }
    };

    renderMarkdown();
  }, [content, sourcePath]);

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{content}</pre>
      </div>
    );
  }

  return (
    <div 
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
