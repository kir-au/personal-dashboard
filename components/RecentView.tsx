'use client';

import { useState, useEffect } from 'react';
import { 
  Clock, FileText, BookOpen, FileCode, 
  Star, BookMarked, FolderOpen, ChevronRight,
  RefreshCw, Sparkles, Zap, Archive, Brain,
  File
} from 'lucide-react';
import MarkdownModal from './MarkdownModal';

interface RecentFile {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  mtime: number;
  category: string;
  title: string;
  preview: string;
  frontmatter: Record<string, unknown>;
}

interface FileItem {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  mtime: number;
}

export default function RecentView() {
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<RecentFile | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const fetchRecent = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/recent?limit=50');
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setFiles(data.files || []);
      }
    } catch (err) {
      setError('Failed to fetch recent files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchFileContent = async (file: RecentFile) => {
    setContentLoading(true);
    setSelectedFile(file);
    try {
      // Convert the absolute path to a relative path from VAULT_ROOT
      // Use the new /api/content/ endpoint that works with full vault paths
      const encodedPath = encodeURIComponent(file.relativePath);
      const response = await fetch(`/api/content/${encodedPath}`);
      const data = await response.json();
      
      if (data.error) {
        // Fallback: parse the content we already have
        setFileContent({
          path: file.relativePath,
          frontmatter: file.frontmatter || {},
          content: file.preview || 'Content preview not available'
        });
      } else {
        setFileContent(data);
      }
    } catch (err) {
      console.error('Failed to fetch file content:', err);
      setFileContent({
        path: file.relativePath,
        frontmatter: file.frontmatter || {},
        content: file.preview || 'Failed to load content'
      });
    } finally {
      setContentLoading(false);
    }
  };

  const handleFileClick = (file: RecentFile) => {
    fetchFileContent(file);
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      const mins = Math.round(diffMs / (1000 * 60));
      return `${mins}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.round(diffHours)}h ago`;
    }
    if (diffHours < 48) return 'Yesterday';
    
    return date.toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    raw: { label: 'Raw', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
    project: { label: 'Project', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
    decision: { label: 'Decision', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
    fact: { label: 'Fact', icon: <Brain className="w-3.5 h-3.5" />, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
    summary: { label: 'Summary', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' },
    index: { label: 'Index', icon: <Archive className="w-3.5 h-3.5" />, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' },
    root: { label: 'Root', icon: <FolderOpen className="w-3.5 h-3.5" />, color: 'text-gray-500 bg-gray-50 dark:bg-gray-800' },
    other: { label: 'Other', icon: <File className="w-3.5 h-3.5" />, color: 'text-gray-500 bg-gray-50 dark:bg-gray-800' },
  };

  const getCategory = (cat: string) => categoryConfig[cat] || categoryConfig.other;

  // Group files by time periods
  const groups: { label: string; files: RecentFile[] }[] = [];
  const now = new Date();
  const today: RecentFile[] = [];
  const thisWeek: RecentFile[] = [];
  const thisMonth: RecentFile[] = [];
  const older: RecentFile[] = [];

  for (const file of files) {
    const diffDays = (now.getTime() - file.mtime) / (1000 * 60 * 60 * 24);
    if (diffDays < 1) today.push(file);
    else if (diffDays < 7) thisWeek.push(file);
    else if (diffDays < 30) thisMonth.push(file);
    else older.push(file);
  }

  if (today.length) groups.push({ label: 'Today', files: today });
  if (thisWeek.length) groups.push({ label: 'This Week', files: thisWeek });
  if (thisMonth.length) groups.push({ label: 'This Month', files: thisMonth });
  if (older.length) groups.push({ label: 'Older', files: older });

  return (
    <div className="h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border bg-surface-variant/50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium text-on-surface">Recent Changes</h2>
        </div>
        <button
          onClick={fetchRecent}
          className="p-1.5 hover:bg-hover rounded transition-colors text-on-surface-variant"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-auto" style={{ height: 'calc(100vh - 300px)' }}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-on-surface-variant">Loading recent files...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-on-surface-variant">No recent files found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groups.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div className="px-4 py-2 bg-surface-variant/30">
                  <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    {group.label}
                  </span>
                  <span className="text-xs text-on-surface-variant ml-2">
                    ({group.files.length})
                  </span>
                </div>

                {/* Files */}
                {group.files.map((file) => {
                  const cat = getCategory(file.category);
                  return (
                    <div
                      key={file.relativePath}
                      className="px-4 py-2.5 hover:bg-hover cursor-pointer transition-colors flex items-start"
                      onClick={() => handleFileClick(file)}
                    >
                      {/* Icon */}
                      <div className={`mt-0.5 p-1.5 rounded ${cat.color}`}>
                        {cat.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 ml-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-on-surface truncate">
                            {file.title}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cat.color}`}>
                            {cat.label}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[11px] text-on-surface-variant font-mono truncate">
                            {file.relativePath}
                          </span>
                        </div>
                        {file.preview && (
                          <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">
                            {file.preview}
                          </p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="ml-3 flex-shrink-0 text-right">
                        <span className="text-[11px] text-on-surface-variant">
                          {formatDate(file.mtime)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for markdown viewing */}
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
        onClose={handleCloseModal}
      />
    </div>
  );
}
