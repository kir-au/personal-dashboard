'use client';

import { X, Copy, Download, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface MarkdownModalProps {
  file: {
    name: string;
    path: string;
    relativePath: string;
    size: number;
    mtime: number;
  } | null;
  content: any | null;
  loading: boolean;
  onClose: () => void;
}

export default function MarkdownModal({ file, content, loading, onClose }: MarkdownModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation when modal opens
    if (file) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden'; // Prevent scrolling
    } else {
      setIsVisible(false);
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [file]);

  if (!file) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCopy = async () => {
    if (content?.content) {
      await navigator.clipboard.writeText(content.content);
      // Could add toast notification here
    }
  };

  const handleDownload = () => {
    if (content?.content) {
      const blob = new Blob([content.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div 
          className="bg-surface dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border dark:border-gray-800 bg-surface dark:bg-gray-900">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-on-surface dark:text-gray-100 truncate">
                {file.name}
              </h2>
              <p className="text-xs text-on-surface-variant dark:text-gray-400 mt-0.5 truncate">
                {file.relativePath} • {formatDate(file.mtime)} • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={handleCopy}
                className="p-2 hover:bg-hover dark:hover:bg-gray-800 rounded transition-colors text-on-surface-variant dark:text-gray-400"
                title="Copy content"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-hover dark:hover:bg-gray-800 rounded transition-colors text-on-surface-variant dark:text-gray-400"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-hover dark:hover:bg-gray-800 rounded transition-colors text-on-surface dark:text-gray-300"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-on-surface-variant dark:text-gray-400">Loading file...</p>
                </div>
              </div>
            ) : content ? (
              <div className="h-full overflow-auto p-6">
                <MarkdownRenderer 
                  content={content.content}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-on-surface-variant dark:text-gray-400">Failed to load file content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
