'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, FileText, Folder, Calendar, Tag, User, File, FileCode, FileImage, FileArchive, FileVideo, FileAudio } from 'lucide-react';
import MarkdownModal from './MarkdownModal';

interface FileItem {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  mtime: number;
}

interface DirectoryItem {
  name: string;
  path: string;
  relativePath: string;
}

interface FileBrowserProps {
  initialPath?: string;
}

export default function FileBrowser({ initialPath = '' }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
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
    fetchDirectory(currentPath);
  }, []);

  const handleDirectoryClick = (dir: DirectoryItem) => {
    const newPath = dir.relativePath;
    setCurrentPath(newPath);
    fetchDirectory(newPath);
    setSelectedFile(null);
    setFileContent(null);
  };

  const handleFileClick = (file: FileItem) => {
    setSelectedFile(file);
    fetchFileContent(file.relativePath);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      setCurrentPath('');
      fetchDirectory('');
      setSelectedFile(null);
      setFileContent(null);
      return;
    }
    const parts = currentPath.split('/').filter(p => p);
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
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

  return (
    <div className="h-full">
      {/* Breadcrumbs */}
      <div className="px-4 py-2 border-b border-border bg-surface-variant/50">
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
            {/* Directories first */}
            {directories.map((dir) => (
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
            {files.map((file) => (
              <div
                key={file.relativePath}
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
                  </div>
                </div>
              </div>
            ))}

            {directories.length === 0 && files.length === 0 && (
              <div className="p-8 text-center">
                <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-on-surface-variant">Empty directory</p>
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
