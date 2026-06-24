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
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderMarkdown = async () => {
      try {
        const processor = unified()
          .use(remarkParse)
          .use(remarkGfm)
          .use(remarkRehype)
          .use(rehypeHighlight, {
            detect: true,
            ignoreMissing: true,
          })
          .use(rehypeStringify);

        const file = await processor.process(content);
        setHtml(String(file));
        setError(null);
      } catch (err) {
        console.error('Error rendering markdown:', err);
        setError('Failed to render markdown');
        // Fallback to simple preformatted text
        setHtml(`<pre class="whitespace-pre-wrap">${content}</pre>`);
      }
    };

    renderMarkdown();
  }, [content]);

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
