'use client';

import { X, Copy, Download, ClipboardCheck, FileArchive, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import MarkdownRenderer, { htmlToReadableText, renderMarkdownToHtml } from './MarkdownRenderer';

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

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function getPreviewKind(fileName: string) {
  const ext = getExtension(fileName);
  if (['md', 'markdown', 'txt', 'json', 'csv', 'tsv', 'yaml', 'yml', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 'py', 'sh'].includes(ext)) {
    return 'text';
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['zip', 'tar', 'gz', 'tgz', 'rar', '7z'].includes(ext)) {
    return 'archive';
  }
  return 'unsupported';
}

function vaultAssetHref(relativePath: string) {
  return `/api/vault-asset/${encodeURIComponent(relativePath)}`;
}

export default function MarkdownModal({ file, content, loading, onClose }: MarkdownModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<'md' | 'plain' | 'rich' | null>(null);
  const [mediumHtml, setMediumHtml] = useState('');
  const previewKind = file ? getPreviewKind(file.name) : 'unsupported';
  const canCopyText = previewKind === 'text' && Boolean(content?.content);

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

  useEffect(() => {
    let cancelled = false;

    const prepareMediumHtml = async () => {
      if (previewKind !== 'text' || !content?.content || !file) {
        setMediumHtml('');
        return;
      }

      try {
        const html = await renderMarkdownToHtml(content.content, content.path || file.relativePath);
        if (!cancelled) setMediumHtml(html);
      } catch (error) {
        console.error('Failed to prepare Medium copy HTML:', error);
        if (!cancelled) setMediumHtml('');
      }
    };

    prepareMediumHtml();

    return () => {
      cancelled = true;
    };
  }, [content, file, previewKind]);

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

  const markCopied = (format: 'md' | 'plain' | 'rich') => {
    setCopiedFormat(format);
    window.setTimeout(() => {
      setCopiedFormat((current) => current === format ? null : current);
    }, 1600);
  };

  const handleCopyMarkdown = async () => {
    if (content?.content) {
      await navigator.clipboard.writeText(content.content);
      markCopied('md');
    }
  };

  const handleCopyPlainText = async () => {
    if (!content?.content) return;

    const html = mediumHtml || await renderMarkdownToHtml(content.content, content.path || file.relativePath);
    await navigator.clipboard.writeText(htmlToReadableText(html) || content.content);
    markCopied('plain');
  };

  const handleCopyRichText = async () => {
    if (!content?.content) return;

    const html = mediumHtml || await renderMarkdownToHtml(content.content, content.path || file.relativePath);
    const readableText = htmlToReadableText(html);

    try {
      if ('ClipboardItem' in window && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([readableText || content.content], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(readableText || content.content);
      }
    } catch (error) {
      const container = document.createElement('div');
      container.innerHTML = html;
      container.setAttribute('contenteditable', 'true');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(container);
      selection?.removeAllRanges();
      selection?.addRange(range);
      const copied = document.execCommand('copy');
      selection?.removeAllRanges();
      container.remove();

      if (!copied) throw error;
    }

    markCopied('rich');
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = vaultAssetHref(file.relativePath);
    a.download = file.name;
    a.click();
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
          className="bg-surface rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-on-surface truncate">
                {file.name}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                {file.relativePath} • {formatDate(file.mtime)} • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              {previewKind === 'text' && (
                <>
                  <button
                    onClick={handleCopyMarkdown}
                    disabled={!canCopyText}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 hover:bg-hover rounded transition-colors text-xs text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
                    title="Copy raw Markdown"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedFormat === 'md' ? 'Copied' : 'Copy MD'}</span>
                  </button>
                  <button
                    onClick={handleCopyPlainText}
                    disabled={!canCopyText}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 hover:bg-hover rounded transition-colors text-xs text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
                    title="Copy readable plain text without Markdown syntax"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{copiedFormat === 'plain' ? 'Copied' : 'Copy Plain Text'}</span>
                  </button>
                  <button
                    onClick={handleCopyRichText}
                    disabled={!canCopyText}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 hover:bg-hover rounded transition-colors text-xs text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
                    title="Copy formatted rich text"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>{copiedFormat === 'rich' ? 'Copied' : 'Copy Rich Text'}</span>
                  </button>
                </>
              )}
              <button
                onClick={handleDownload}
                className="p-2 hover:bg-hover rounded transition-colors text-on-surface-variant"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-hover rounded transition-colors text-on-surface"
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
                  <p className="mt-2 text-sm text-on-surface-variant">Loading file...</p>
                </div>
              </div>
            ) : previewKind === 'text' && content ? (
              <div className="h-full overflow-auto p-6">
                <MarkdownRenderer 
                  content={content.content}
                  sourcePath={content.path || file.relativePath}
                />
              </div>
            ) : previewKind === 'image' ? (
              <div className="h-full overflow-auto bg-surface-variant/30 p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vaultAssetHref(file.relativePath)}
                  alt={file.name}
                  className="mx-auto max-h-full max-w-full rounded border border-border bg-surface object-contain"
                />
              </div>
            ) : previewKind === 'pdf' ? (
              <iframe
                src={vaultAssetHref(file.relativePath)}
                title={file.name}
                className="h-full w-full border-0 bg-surface"
              />
            ) : (
              <div className="h-full overflow-auto bg-surface-variant/20 p-6">
                <div
                  className="rounded-lg border border-border bg-surface p-6 shadow-sm"
                  style={{ width: '100%', minWidth: 0 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-border bg-surface-variant/60">
                      <FileArchive className="h-5 w-5 text-on-surface-variant" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">File preview</p>
                      <h3 className="text-lg font-semibold text-on-surface">Preview unavailable</h3>
                    </div>
                  </div>
                  <p
                    className="mt-4 text-sm leading-6 text-on-surface-variant"
                    style={{ maxWidth: 760, wordBreak: 'normal', overflowWrap: 'normal' }}
                  >
                    {previewKind === 'archive'
                      ? 'This is an archive file. The vault reader does not unpack ZIP archives in the browser because they can contain multiple files and nested folders. Download it to open the archive locally.'
                      : 'This file type is stored in the vault, but it cannot be rendered safely in the reader. Download it to open it with a local app.'}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center gap-2 rounded border border-primary bg-active px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <Download className="h-4 w-4" />
                      Download file
                    </button>
                    {file.size > 0 && (
                      <span className="text-xs text-on-surface-variant">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
