'use client';

import { useState } from 'react';
import { 
  Home, 
  Folder, 
  Clock, 
  Star, 
  Tag, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  Search,
  User,
  HelpCircle
} from 'lucide-react';

const navigationItems = [
  { icon: Home, label: 'Home', count: null },
  { icon: Folder, label: 'All Files', count: 142 },
  { icon: Clock, label: 'Recent', count: 24 },
  { icon: Star, label: 'Favorites', count: 8 },
  { icon: Tag, label: 'Tags', count: null },
  { icon: FileText, label: 'Documents', count: 89 },
  { icon: Search, label: 'Search', count: null },
];

const secondaryItems = [
  { icon: User, label: 'Profile' },
  { icon: Settings, label: 'Settings' },
  { icon: HelpCircle, label: 'Help' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`h-screen bg-surface border-r border-border flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo/Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <span className="text-white font-bold">V</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-on-surface">Vault</h1>
                <p className="text-xs text-on-surface-variant">Personal AI Memory</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center mx-auto">
              <span className="text-white font-bold">V</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-surface-variant rounded"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} p-2.5 rounded hover:bg-surface-variant transition-colors text-sm`}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="w-4 h-4 text-on-surface-variant" />
              {!collapsed && <span className="text-on-surface">{item.label}</span>}
            </div>
            {!collapsed && item.count !== null && (
              <span className="text-xs bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Secondary navigation */}
      <div className="p-3 border-t border-border space-y-1">
        {secondaryItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} p-2.5 rounded hover:bg-surface-variant transition-colors text-sm`}
          >
            <item.icon className="w-4 h-4 text-on-surface-variant" />
            {!collapsed && <span className="ml-3 text-on-surface">{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Storage indicator */}
      {!collapsed && (
        <div className="p-3 border-t border-border">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Storage</span>
              <span className="text-on-surface font-medium">4.2 GB / 10 GB</span>
            </div>
            <div className="h-1.5 bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: '42%' }}></div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
