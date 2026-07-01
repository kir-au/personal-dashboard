'use client';

import { useState, useEffect } from 'react';
import { Bookmark, CheckCircle2, ChevronRight, FileText, Folder, File, FileCode, FileImage, FileArchive, FileVideo, FileAudio, Star, Trash2 } from 'lucide-react';
import MarkdownModal from './MarkdownModal';

interface FileItem {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  mtime: number;
  review?: {
    important?: boolean;
    reviewLater?: boolean;
    relevant?: boolean;
    deletedAt?: string;
  } | null;
}

interface DirectoryItem {
  name: string;
  path: string;
  relativePath: string;
}

interface FileBrowserProps {
  initialPath?: string;
}

type ReviewFilter = 'all' | 'important' | 'reviewLater' | 'notRelevant';

function isTextPreviewable(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return [
    'md',
    'markdown',
    'txt',
    'json',
    'csv',
    'tsv',
    'yaml',
    'yml',
    'js',
    'ts',
    'jsx',
    'tsx',
    'css',
    'html',
    'xml',
    'py',
    'sh',
  ].includes(ext || '');
}

function discussionBaseName(fileName: string) {
  return fileName.replace(/\.(md|markdown)$/i, '');
}

export default function FileBrowser({ initialPath = '' }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window === 'undefined') return initialPath;
    return new URLSearchParams(window.location.search).get('path') || initialPath;
  });
  const [files, setFiles] = useState<FileItem[]>([]);
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const fetchDirectory = async (path: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (path) {
        params.set('path', path);
      }
      
      const response = await fetch(`/api/files?${params}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setFiles(data.files || []);
        setDirectories(data.directories || []);
        setCurrentPath(data.currentPath || '');
      }
    } catch (err) {
      setError('Failed to fetch directory contents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openMarkdownFile = async (relativePath: string) => {
    const name = relativePath.split('/').pop() || relativePath;
    setSelectedFile({
      name,
      path: relativePath,
      relativePath,
      size: 0,
      mtime: Date.now(),
      review: null,
    });
    if (isTextPreviewable(name)) {
      fetchFileContent(relativePath);
    } else {
      setFileContent(null);
      setContentLoading(false);
    }
  };

  const fetchFileContent = async (filePath: string) => {
    setContentLoading(true);
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await fetch(`/api/files/${encodedPath}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setFileContent(data);
      }
    } catch (err) {
      setError('Failed to fetch file content');
      console.error(err);
    } finally {
      setContentLoading(false);
    }
  };

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const filePath = params?.get('file');
    const directoryPath = filePath?.includes('/')
      ? filePath.split('/').slice(0, -1).join('/')
      : currentPath;

    fetchDirectory(directoryPath || currentPath);
    if (filePath) {
      openMarkdownFile(filePath);
    }
  }, []);

  const updateVaultPathInUrl = (path: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'vault');
    if (path) {
      url.searchParams.set('path', path);
    } else {
      url.searchParams.delete('path');
    }
    window.history.replaceState(null, '', url.toString());
  };

  const handleDirectoryClick = (dir: DirectoryItem) => {
    const newPath = dir.relativePath;
    setCurrentPath(newPath);
    updateVaultPathInUrl(newPath);
    fetchDirectory(newPath);
    setSelectedFile(null);
    setFileContent(null);
  };

  const handleFileClick = (file: FileItem) => {
    setSelectedFile(file);
    if (isTextPreviewable(file.name)) {
      fetchFileContent(file.relativePath);
    } else {
      setFileContent(null);
      setContentLoading(false);
    }
  };

  const updateReview = async (file: FileItem, patch: Record<string, boolean>) => {
    const previousFiles = files;
    const nextFiles = files.map((item) => (
      item.relativePath === file.relativePath
        ? { ...item, review: { ...(item.review || {}), ...patch } }
        : item
    ));
    setFiles(nextFiles);

    try {
      const response = await fetch('/api/vault-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.relativePath, ...patch }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to update review metadata');
      }
    } catch (err) {
      setFiles(previousFiles);
      setError(err instanceof Error ? err.message : 'Failed to update review metadata');
    }
  };

  const moveToTrash = async (file: FileItem) => {
    const confirmed = window.confirm(`Move "${file.name}" to vault trash?`);
    if (!confirmed) return;

    const previousFiles = files;
    setFiles(files.filter((item) => item.relativePath !== file.relativePath));
    if (selectedFile?.relativePath === file.relativePath) {
      setSelectedFile(null);
      setFileContent(null);
    }

    try {
      const response = await fetch('/api/vault-review', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.relativePath }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to move file to trash');
      }
    } catch (err) {
      setFiles(previousFiles);
      setError(err instanceof Error ? err.message : 'Failed to move file to trash');
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      setCurrentPath('');
      updateVaultPathInUrl('');
      fetchDirectory('');
      setSelectedFile(null);
      setFileContent(null);
      return;
    }
    const parts = currentPath.split('/').filter(p => p);
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
    updateVaultPathInUrl(newPath);
    fetchDirectory(newPath);
    setSelectedFile(null);
    setFileContent(null);
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
      case 'markdown':
      case 'txt':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'go':
      case 'rs':
      case 'php':
      case 'rb':
        return <FileCode className="w-4 h-4 text-yellow-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return <FileImage className="w-4 h-4 text-green-500" />;
      case 'pdf':
        return <File className="w-4 h-4 text-red-500" />;
      case 'zip':
      case 'tar':
      case 'gz':
      case 'rar':
      case '7z':
        return <FileArchive className="w-4 h-4 text-orange-500" />;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
      case 'webm':
        return <FileVideo className="w-4 h-4 text-purple-500" />;
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
        return <FileAudio className="w-4 h-4 text-pink-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const breadcrumbs = currentPath
    ? ['personal-vault', ...currentPath.split('/').filter(p => p)]
    : ['personal-vault'];
  const assetDirectories = directories.filter((dir) => dir.name.endsWith('.assets'));
  const regularDirectories = directories.filter((dir) => !dir.name.endsWith('.assets'));
  const assetDirectoryByBase = new Map(
    assetDirectories.map((dir) => [dir.name.replace(/\.assets$/, ''), dir])
  );

  const filteredFiles = files.filter((file) => {
    if (reviewFilter === 'important') return Boolean(file.review?.important);
    if (reviewFilter === 'reviewLater') return Boolean(file.review?.reviewLater);
    if (reviewFilter === 'notRelevant') return file.review?.relevant === false;
    return true;
  });

  const importantCount = files.filter((file) => file.review?.important).length;
  const reviewLaterCount = files.filter((file) => file.review?.reviewLater).length;
  const notRelevantCount = files.filter((file) => file.review?.relevant === false).length;

  return (
    <div className="h-full">
      {/* Breadcrumbs */}
      <div className="px-4 py-2 border-b border-border bg-surface-variant/50">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <ChevronRight className="w-3 h-3 mx-1 text-on-surface-variant" />}
                <button
                  onClick={() => handleBreadcrumbClick(index - 1)}
                  className={`px-2 py-1 rounded hover:bg-hover transition-colors ${
                    index === breadcrumbs.length - 1
                      ? 'font-medium text-on-surface'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {crumb}
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {[
              { id: 'all' as const, label: `All ${files.length}` },
              { id: 'important' as const, label: `Important ${importantCount}` },
              { id: 'reviewLater' as const, label: `Review later ${reviewLaterCount}` },
              { id: 'notRelevant' as const, label: `Not relevant ${notRelevantCount}` },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setReviewFilter(item.id)}
                className={`rounded border px-2 py-1 transition-colors ${
                  reviewFilter === item.id
                    ? 'border-primary bg-active text-primary'
                    : 'border-border bg-surface text-on-surface-variant hover:bg-hover'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* File list */}
      <div className="overflow-auto" style={{ height: 'calc(100vh - 300px)' }}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-on-surface-variant">Loading directory...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Directories first, except discussion asset bundles. */}
            {regularDirectories.map((dir) => (
              <div
                key={dir.relativePath}
                className="px-4 py-3 hover:bg-hover cursor-pointer transition-colors flex items-center"
                onClick={() => handleDirectoryClick(dir)}
              >
                <Folder className="w-5 h-5 text-blue-500 mr-3" />
                <div className="flex-1">
                  <div className="font-medium text-on-surface">{dir.name}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    Directory
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-on-surface-variant" />
              </div>
            ))}

            {/* Files */}
            {filteredFiles.map((file) => {
              const important = Boolean(file.review?.important);
              const reviewLater = Boolean(file.review?.reviewLater);
              const relevant = file.review?.relevant !== false;
              const assetDir = assetDirectoryByBase.get(discussionBaseName(file.name));

              return (
                <div key={file.relativePath}>
                  <div
                    className="px-4 py-3 hover:bg-hover cursor-pointer transition-colors flex items-center"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="mr-3">
                      {getFileIcon(file.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface truncate">{file.name}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5 flex items-center space-x-3">
                        <span>{formatDate(file.mtime)}</span>
                        <span>•</span>
                        <span>{formatSize(file.size)}</span>
                        {important && (
                          <>
                            <span>•</span>
                            <span className="text-primary">Important</span>
                          </>
                        )}
                        {reviewLater && (
                          <>
                            <span>•</span>
                            <span className="text-primary">Review later</span>
                          </>
                        )}
                        {!relevant && (
                          <>
                            <span>•</span>
                            <span className="text-error">Not relevant</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                      <button
                        onClick={() => updateReview(file, { important: !important })}
                        className={`rounded p-2 transition-colors ${important ? 'bg-active text-primary' : 'text-on-surface-variant hover:bg-hover'}`}
                        title={important ? 'Unmark important' : 'Mark important'}
                      >
                        <Star className={`h-4 w-4 ${important ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => updateReview(file, { reviewLater: !reviewLater })}
                        className={`rounded p-2 transition-colors ${reviewLater ? 'bg-active text-primary' : 'text-on-surface-variant hover:bg-hover'}`}
                        title={reviewLater ? 'Remove review-later bookmark' : 'Review later'}
                      >
                        <Bookmark className={`h-4 w-4 ${reviewLater ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => updateReview(file, { relevant: !relevant })}
                        className={`rounded p-2 transition-colors ${relevant ? 'text-on-surface-variant hover:bg-hover' : 'bg-orange-50 text-error'}`}
                        title={relevant ? 'Mark not relevant' : 'Mark relevant'}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveToTrash(file)}
                        className="rounded p-2 text-on-surface-variant transition-colors hover:bg-orange-50 hover:text-error"
                        title="Move to vault trash"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {assetDir && (
                    <div
                      className="border-t border-border/60 bg-surface-variant/25 px-4 py-2 pl-11 hover:bg-hover cursor-pointer transition-colors flex items-center"
                      onClick={() => handleDirectoryClick(assetDir)}
                    >
                      <Folder className="w-4 h-4 text-green-500 mr-3" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-on-surface truncate">{assetDir.name}</div>
                        <div className="text-xs text-on-surface-variant mt-0.5">
                          Assets for this discussion
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                    </div>
                  )}
                </div>
              );
            })}

            {regularDirectories.length === 0 && filteredFiles.length === 0 && (
              <div className="p-8 text-center">
                <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-on-surface-variant">
                  {files.length === 0 ? 'Empty directory' : 'No files match this review filter'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal for markdown viewing */}
      <MarkdownModal
        file={selectedFile}
        content={fileContent}
        loading={contentLoading}
        onClose={handleCloseModal}
      />
    </div>
  );
}
