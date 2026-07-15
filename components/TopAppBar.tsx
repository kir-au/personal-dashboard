'use client';
import { 
  Search, 
  HelpCircle, 
  Settings, 
  Bell, 
  User,
  Check,
  Grid,
  Filter,
  RefreshCw,
  MoreVertical,
  Moon,
  Sun,
  Menu,
  MessageSquareText,
  Mic,
  Send,
  Square,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface TopAppBarProps {
  currentView?: string;
  onViewChange?: (view: any) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onMenuClick?: () => void;
}

export default function TopAppBar({ currentView, searchQuery, onSearchQueryChange, onMenuClick }: TopAppBarProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [captureSource, setCaptureSource] = useState<'manual' | 'voice'>('manual');
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'transcribing' | 'error'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const captureTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    enabled: boolean;
    user: { name?: string | null; email?: string | null; image?: string | null } | null;
  } | null>(null);
  const isVaultView = currentView === 'browse';
  const capturePlaceholder =
    currentView === 'health'
      ? 'Log health update: exercise, food, weight, pain, symptoms, recovery...'
      : currentView === 'today'
        ? 'Tell vault what changed, what to move, or what to remember...'
        : 'Capture note for this context...';

  useEffect(() => {
    const saved = window.localStorage.getItem('personal-dashboard-theme');
    const initialTheme = saved === 'dark' ? 'dark' : 'light';
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => setAuthStatus(data))
      .catch(() => setAuthStatus({ enabled: false, user: null }));
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;

    const closeSettings = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-settings-menu]')) setSettingsOpen(false);
    };

    window.addEventListener('click', closeSettings);
    return () => window.removeEventListener('click', closeSettings);
  }, [settingsOpen]);

  const setDashboardTheme = (nextTheme: 'light' | 'dark') => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('personal-dashboard-theme', nextTheme);
    setSettingsOpen(false);
  };

  const resizeCaptureTextarea = () => {
    const textarea = captureTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  };

  useEffect(() => {
    resizeCaptureTextarea();
  }, [captureText]);

  const saveCapture = async () => {
    const input = captureText.trim();
    if (!input) return;

    setCaptureStatus('saving');
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          source: captureSource,
          metadata: { surface: 'top-feedback-loop', currentView },
        }),
      });

      if (!res.ok) throw new Error('Capture failed');
      const data = await res.json();
      setCaptureText('');
      setCaptureSource('manual');
      setLastSavedPath(data.path || null);
      setCaptureStatus('saved');
      fetch('/api/planner/regenerate', { method: 'POST' })
        .then(() => window.dispatchEvent(new Event('planner-projection-changed')))
        .catch(() => window.dispatchEvent(new Event('planner-projection-changed')));
      window.setTimeout(() => setCaptureStatus('idle'), 3500);
    } catch {
      setCaptureStatus('error');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const startRecording = async () => {
    if (voiceStatus === 'recording') {
      stopRecording();
      return;
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceStatus('error');
      setVoiceError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;

        if (!audio.size) {
          setVoiceStatus('error');
          setVoiceError('No audio was recorded.');
          return;
        }

        setVoiceStatus('transcribing');
        try {
          const form = new FormData();
          form.set('audio', new File([audio], 'capture.webm', { type: audio.type || 'audio/webm' }));
          const response = await fetch('/api/capture/transcribe', {
            method: 'POST',
            body: form,
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.error || 'Transcription failed.');

          setCaptureText((current) => [current.trim(), data.text?.trim()].filter(Boolean).join('\n'));
          setCaptureSource('voice');
          setCaptureStatus('idle');
          setLastSavedPath(null);
          setVoiceStatus('idle');
        } catch (error) {
          setVoiceStatus('error');
          setVoiceError(error instanceof Error ? error.message : 'Transcription failed.');
        }
      };

      recorder.start();
      setVoiceStatus('recording');
    } catch (error) {
      setVoiceStatus('error');
      setVoiceError(error instanceof Error ? error.message : 'Could not start recording.');
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-border">
      <div className="grid grid-cols-[auto_minmax(360px,1fr)_auto] items-center gap-3 px-4 py-3 max-md:grid-cols-[auto_1fr_auto]">
        {/* Left section */}
        <div className="flex shrink-0 items-center space-x-3">
          <button
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-variant md:hidden"
            title="Open navigation"
          >
            <Menu className="h-5 w-5 text-on-surface-variant" />
          </button>

          {/* App logo/name */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center" title="Personal Dashboard">
              <span className="text-white font-bold text-sm">PD</span>
            </div>
          </div>

          {isVaultView && (
            <div className="hidden md:flex items-center bg-surface-variant rounded-lg px-3 py-2 w-64 lg:w-80">
              <Search className="w-4 h-4 text-on-surface-variant mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search vault files and indexes..."
                className="bg-transparent border-none outline-none w-full text-sm text-on-surface placeholder-on-surface-variant"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchQueryChange('')}
                  className="ml-2 p-0.5 rounded hover:bg-hover"
                  title="Clear search"
                >
                  <span className="text-xs text-on-surface-variant">x</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative hidden h-10 min-w-[360px] md:block" data-capture-loop>
          <div className="absolute left-1/2 top-0 z-50 w-full max-w-5xl -translate-x-1/2 rounded-lg border border-border bg-surface-variant px-3 py-1.5 shadow-sm transition-shadow focus-within:border-primary focus-within:bg-surface focus-within:shadow-lg">
            <div className="flex items-start gap-2">
              <MessageSquareText className="mt-1.5 h-4 w-4 shrink-0 text-primary" />
              <textarea
                ref={captureTextareaRef}
                rows={1}
                value={captureText}
                onChange={(event) => {
                  setCaptureText(event.target.value);
                  setCaptureSource('manual');
                  if (captureStatus !== 'idle') setCaptureStatus('idle');
                  if (lastSavedPath) setLastSavedPath(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    saveCapture();
                  }
                }}
                placeholder={capturePlaceholder}
                className="max-h-32 min-h-7 min-w-[240px] flex-1 resize-none overflow-y-auto border-none bg-transparent py-1 text-sm leading-5 text-on-surface outline-none placeholder:text-on-surface-variant/70"
              />
              {captureText && (
                <button
                  type="button"
                  onClick={() => {
                    setCaptureText('');
                    setCaptureSource('manual');
                    setCaptureStatus('idle');
                    setLastSavedPath(null);
                  }}
                  className="mt-1 rounded p-1 hover:bg-hover"
                  title="Clear"
                >
                  <X className="h-3.5 w-3.5 text-on-surface-variant" />
                </button>
              )}
              <button
                type="button"
                onClick={startRecording}
                disabled={voiceStatus === 'transcribing'}
                className={`mt-0.5 inline-flex h-7 shrink-0 items-center gap-1 rounded border px-2.5 text-xs font-medium ${
                  voiceStatus === 'recording'
                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                    : 'border-border bg-surface text-on-surface-variant hover:bg-hover'
                } disabled:opacity-40`}
                title={voiceStatus === 'recording' ? 'Stop recording' : 'Record voice capture'}
              >
                {voiceStatus === 'recording' ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {voiceStatus === 'recording' ? 'Stop' : voiceStatus === 'transcribing' ? 'Transcribing' : 'Voice'}
              </button>
              <button
                type="button"
                onClick={saveCapture}
                disabled={!captureText.trim() || captureStatus === 'saving'}
                className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1 rounded bg-primary px-2.5 text-xs font-medium text-white disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {captureStatus === 'saving' ? 'Saving' : 'Capture'}
              </button>
            </div>
            {(captureStatus !== 'idle' || voiceStatus !== 'idle') && (
              <div className="mt-1 border-t border-border/70 pt-1.5 text-xs text-on-surface-variant">
                {captureStatus === 'saved' && `Saved to ${lastSavedPath || 'vault'}.`}
                {captureStatus === 'error' && 'Save failed.'}
                {voiceStatus === 'recording' && 'Recording. Press Stop when finished.'}
                {voiceStatus === 'transcribing' && 'Transcribing voice capture...'}
                {voiceStatus === 'error' && `Voice failed: ${voiceError}`}
              </div>
            )}
          </div>
        </div>

        {/* Right section */}
        <div className="flex shrink-0 items-center justify-end space-x-2">
          {isVaultView && (
            <>
              <button 
                className="p-2 rounded-lg hover:bg-surface-variant hidden md:flex items-center justify-center"
                title="Refresh vault"
              >
                <RefreshCw className="w-4 h-4 text-on-surface-variant" />
              </button>
              
              <button 
                className="p-2 rounded-lg hover:bg-surface-variant hidden md:flex items-center justify-center"
                title="Vault filters"
              >
                <Filter className="w-4 h-4 text-on-surface-variant" />
              </button>
              
              <button 
                className="p-2 rounded-lg hover:bg-surface-variant hidden md:flex items-center justify-center"
                title="Vault view options"
              >
                <Grid className="w-4 h-4 text-on-surface-variant" />
              </button>
            </>
          )}

          {/* Mobile search button */}
          {isVaultView && <button 
            className="p-2 rounded-lg hover:bg-surface-variant md:hidden"
            title="Search"
          >
            <Search className="w-4 h-4 text-on-surface-variant" />
          </button>}

          {/* Notifications */}
          <button 
            className="p-2 rounded-lg hover:bg-surface-variant relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-on-surface-variant" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
          </button>

          {/* Help */}
          <button 
            className="p-2 rounded-lg hover:bg-surface-variant hidden md:flex"
            title="Help"
          >
            <HelpCircle className="w-4 h-4 text-on-surface-variant" />
          </button>

          {/* Settings */}
          <div className="relative" data-settings-menu>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setSettingsOpen((open) => !open);
              }}
              className="flex items-center justify-center rounded-lg p-2 hover:bg-surface-variant"
              title="Settings"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
            >
              <Settings className="h-4 w-4 text-on-surface-variant" />
            </button>
            {settingsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-border bg-surface p-2 shadow-lg"
              >
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Appearance</p>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    Choose the color mode for dashboard, calendar, and vault reading surfaces.
                  </p>
                </div>
                <button
                  role="menuitemradio"
                  aria-checked={theme === 'light'}
                  onClick={() => setDashboardTheme('light')}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-hover"
                >
                  <Sun className="mt-0.5 h-4 w-4 text-on-surface-variant" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-on-surface">Light mode</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">
                      Bright surfaces for planning, calendar review, and daytime use.
                    </span>
                  </span>
                  {theme === 'light' && <Check className="mt-0.5 h-4 w-4 text-primary" />}
                </button>
                <button
                  role="menuitemradio"
                  aria-checked={theme === 'dark'}
                  onClick={() => setDashboardTheme('dark')}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-hover"
                >
                  <Moon className="mt-0.5 h-4 w-4 text-on-surface-variant" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-on-surface">Dark mode</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">
                      Lower-luminance surfaces for evening use and reduced screen brightness.
                    </span>
                  </span>
                  {theme === 'dark' && <Check className="mt-0.5 h-4 w-4 text-primary" />}
                </button>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            {authStatus?.enabled && !authStatus.user ? (
              <a
                href="/login"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-variant"
              >
                Sign in
              </a>
            ) : authStatus?.enabled ? (
              <a
                href="/api/auth/signout"
                className="flex items-center space-x-2 rounded-lg p-1.5 hover:bg-surface-variant"
                title="Account"
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                  {authStatus?.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={authStatus.user.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <span className="hidden text-sm font-medium text-on-surface lg:inline">
                  {authStatus?.user?.name || 'Account'}
                </span>
                <MoreVertical className="hidden h-4 w-4 text-on-surface-variant lg:inline" />
              </a>
            ) : (
              <button
                type="button"
                className="flex cursor-default items-center space-x-2 rounded-lg p-1.5"
                title="Local development mode. Google authentication is not configured."
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="hidden text-sm font-medium text-on-surface lg:inline">Local</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isVaultView && <div className="md:hidden px-4 pb-3">
        <div className="flex items-center bg-surface-variant rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-on-surface-variant mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search vault files and indexes..."
            className="bg-transparent border-none outline-none w-full text-sm text-on-surface placeholder-on-surface-variant"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="ml-2 p-0.5 rounded hover:bg-hover"
              title="Clear search"
            >
              <span className="text-xs text-on-surface-variant">x</span>
            </button>
          )}
        </div>
      </div>}
    </header>
  );
}
