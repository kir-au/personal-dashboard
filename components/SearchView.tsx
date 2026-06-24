'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Loader2, AlertCircle } from 'lucide-react';
import MarkdownModal from './MarkdownModal';

interface SearchResult {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  mtime: number;
  frontmatter: Record<string, unknown>;
  content: string;
  score: number;
  matches: string[];
}

interface SearchViewProps {
  query: string;
}

export default function SearchView({ query }: SearchViewProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SearchResult | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: trimmedQuery, limit: '50' });
        const response = await fetch(`/api/search?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (data.error) {
          setError(data.error);
          setResults([]);
        } else {
          setResults(data.results || []);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError('Failed to search the vault');
          setResults([]);
          console.error(err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedQuery]);

  const summary = useMemo(() => {
    if (!trimmedQuery) return 'Type to search the vault.';
    if (loading) return `Searching for "${trimmedQuery}"...`;
    return `${results.length} result${results.length === 1 ? '' : 's'} for "${trimmedQuery}"`;
  }, [loading, results.length, trimmedQuery]);

  const fetchFileContent = async (file: SearchResult) => {
    setSelectedFile(file);
    setContentLoading(true);
    try {
      const response = await fetch(`/api/content/${encodeURIComponent(file.relativePath)}`);
      const data = await response.json();
      if (data.error) {
        setFileContent({
          path: file.relativePath,
          frontmatter: file.frontmatter || {},
          content: file.content || 'Content preview not available',
        });
      } else {
        setFileContent(data);
      }
    } catch (err) {
      console.error('Failed to fetch search result content:', err);
      setFileContent({
        path: file.relativePath,
        frontmatter: file.frontmatter || {},
        content: file.content || 'Failed to load content',
      });
    } finally {
      setContentLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  return (
    <div className="h-full">
      <div className="px-4 py-2 border-b border-border bg-surface-variant/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium text-on-surface">Search</h2>
        </div>
        <span className="text-xs text-on-surface-variant">{summary}</span>
      </div>

      <div className="overflow-auto" style={{ height: 'calc(100vh - 300px)' }}>
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
            <p className="mt-2 text-sm text-on-surface-variant">Searching vault...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-red-500">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-on-surface-variant">No matching vault files found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {results.map((file) => (
              <button
                key={file.relativePath}
                type="button"
                className="w-full px-4 py-3 hover:bg-hover transition-colors flex items-start text-left"
                onClick={() => fetchFileContent(file)}
              >
                <FileText className="w-4 h-4 text-blue-500 mt-1 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-on-surface truncate">
                      {String(file.frontmatter?.title || file.name)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                      {file.matches.join(', ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-mono truncate mt-0.5">
                    {file.relativePath}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">
                    {file.content}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <MarkdownModal
        file={selectedFile ? {
          name: selectedFile.name,
          path: selectedFile.path,
          relativePath: selectedFile.relativePath,
          size: selectedFile.size,
          mtime: selectedFile.mtime,
        } : null}
        content={fileContent}
        loading={contentLoading}
        onClose={closeModal}
      />
    </div>
  );
}
