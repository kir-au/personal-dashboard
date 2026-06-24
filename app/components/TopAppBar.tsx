'use client';

import { Search, Bell, User, Menu } from 'lucide-react';
import { useState } from 'react';

export default function TopAppBar() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side - Search */}
        <div className="flex items-center flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search across all files..."
              className="w-full pl-10 pr-4 py-2 bg-surface-variant border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-surface-variant rounded-lg relative">
            <Bell className="w-5 h-5 text-on-surface-variant" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
          </button>
          
          <div className="h-6 w-px bg-border"></div>
          
          <button className="flex items-center space-x-2 p-1.5 hover:bg-surface-variant rounded-lg">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left hidden md:block">
              <div className="text-sm font-medium text-on-surface">Kirill</div>
              <div className="text-xs text-on-surface-variant">Admin</div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
