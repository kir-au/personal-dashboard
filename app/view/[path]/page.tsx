'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Skeleton } from '@/components/ui/skeleton';

interface FileMetadata {
  name: string;
  path: string;
  size: number;
  modified: string;
  created: string;
  content: string;
}

export default function MarkdownViewerPage() {
  const params = useParams();
  const [file, setFile] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const path = Array.isArray(params.path) ? params.path.join('/') : params.path;

  useEffect(() => {
    const fetchFile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/files/${encodeURIComponent(path || "")}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.statusText}`);
        }
        
        const data = await response.json();
        setFile(data);
        setError(null);
      } catch (err) {
        console.error('Error loading file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    if (path) {
      fetchFile();
    }
  }, [path]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Error Loading File
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'File not found'}
          </p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to files
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Minimal header with just file path */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {file.name}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {file.path}
              </p>
            </div>
            <a
              href="/"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap ml-4"
            >
              Back to files
            </a>
          </div>
        </div>
      </div>

      {/* Clean markdown content */}
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <MarkdownRenderer 
              content={file.content} 
              className="min-h-[calc(100vh-120px)]"
            />
          </div>

          {/* Minimal footer with basic info */}
          <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex flex-wrap gap-4">
              <span>Size: {formatFileSize(file.size)}</span>
              <span>Modified: {formatDate(file.modified)}</span>
              <a
                href={`/api/files/${encodeURIComponent(path || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                View raw
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
