'use client';
import { 
  Search, 
  HelpCircle, 
  Settings, 
  Bell, 
  User,
  Grid,
  Filter,
  RefreshCw,
  MoreVertical,
  Moon,
  Sun
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface TopAppBarProps {
  currentView?: string;
  onViewChange?: (view: any) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export default function TopAppBar({ currentView, searchQuery, onSearchQueryChange }: TopAppBarProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const isVaultView = currentView === 'browse';

  useEffect(() => {
    const saved = window.localStorage.getItem('personal-dashboard-theme');
    const initialTheme = saved === 'dark' ? 'dark' : 'light';
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('personal-dashboard-theme', nextTheme);
  };

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left section */}
        <div className="flex items-center space-x-4">
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

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-surface-variant hidden md:flex items-center justify-center"
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-on-surface-variant" />
            ) : (
              <Sun className="w-4 h-4 text-on-surface-variant" />
            )}
          </button>

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
          <button 
            className="p-2 rounded-lg hover:bg-surface-variant"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-on-surface-variant" />
          </button>

          {/* User menu */}
          <div className="relative">
            <button 
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-surface-variant"
              title="Account"
            >
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-on-surface hidden lg:inline">Kirill</span>
              <MoreVertical className="w-4 h-4 text-on-surface-variant hidden lg:inline" />
            </button>
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
