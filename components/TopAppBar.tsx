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
  Menu
} from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const [authStatus, setAuthStatus] = useState<{
    enabled: boolean;
    user: { name?: string | null; email?: string | null; image?: string | null } | null;
  } | null>(null);
  const isVaultView = currentView === 'browse';

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

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-variant md:hidden"
            title="Open navigation"
          >
            <Menu className="h-5 w-5 text-on-surface-variant" />
          </button>

          {/* App logo/name */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PD</span>
            </div>
            <div>
              <h1 className="text-lg font-medium text-on-surface">Personal Dashboard</h1>
              <p className="text-xs text-on-surface-variant">Daily surface powered by Personal Vault</p>
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

        {/* Right section */}
        <div className="flex items-center space-x-2">
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
