'use client';

import { 
  Brain,
  BriefcaseBusiness,
  Car,
  ChartCandlestick,
  Dumbbell,
  HardDrive, 
  Clock, 
  ChevronRight,
  CalendarDays,
  Folder,
  Landmark,
  LayoutDashboard,
  Plane,
  Repeat,
  Sparkles,
  TrendingUp,
  Users
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

interface SidebarProps {
  currentView: 'today' | 'browse' | 'planner' | 'health' | 'recent';
  onViewChange: (view: 'today' | 'browse' | 'planner' | 'health' | 'recent') => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [recentCount, setRecentCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetch('/api/recent?limit=1')
      .then(res => res.json())
      .then(data => {
        if (data.totalFiles !== undefined) {
          setRecentCount(data.totalFiles);
        }
      })
      .catch(() => {}); // Silent fail
  }, []);

  const mainItems: SidebarItem[] = [
    {
      id: 'today',
      label: 'Today',
      icon: <LayoutDashboard className="w-5 h-5" />,
      active: currentView === 'today',
      onClick: () => onViewChange('today'),
    },
    {
      id: 'vault',
      label: 'Vault',
      icon: <HardDrive className="w-5 h-5" />,
      active: currentView === 'browse',
      onClick: () => onViewChange('browse'),
    },
    {
      id: 'planner',
      label: 'Planner',
      icon: <CalendarDays className="w-5 h-5" />,
      active: currentView === 'planner',
      onClick: () => onViewChange('planner'),
    },
    {
      id: 'recent',
      label: 'Recent Changes',
      icon: <Clock className="w-5 h-5" />,
      count: recentCount,
      active: currentView === 'recent',
      onClick: () => onViewChange('recent'),
    },
  ];

  const contextItems: SidebarItem[] = [
    {
      id: 'health',
      label: 'Health',
      icon: <Dumbbell className="w-4 h-4" />,
      active: currentView === 'health',
      onClick: () => onViewChange('health'),
    },
    { id: 'business', label: 'Business', icon: <BriefcaseBusiness className="w-4 h-4" /> },
    { id: 'ai', label: 'AI', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'family', label: 'Family', icon: <Users className="w-4 h-4" /> },
    { id: 'wealth', label: 'Wealth', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'travel', label: 'Travel', icon: <Plane className="w-4 h-4" /> },
    { id: 'routine', label: 'Routine', icon: <Repeat className="w-4 h-4" /> },
    { id: 'trading', label: 'Trading', icon: <ChartCandlestick className="w-4 h-4" /> },
    { id: 'car', label: 'Car', icon: <Car className="w-4 h-4" /> },
    { id: 'work', label: 'Work', icon: <Folder className="w-4 h-4" /> },
    { id: 'politics', label: 'Politics', icon: <Landmark className="w-4 h-4" /> },
    { id: 'startup', label: 'Startup', icon: <Brain className="w-4 h-4" /> },
  ];

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} border-r border-border bg-surface flex flex-col transition-all duration-200 flex-shrink-0`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-surface border border-border rounded-full flex items-center justify-center z-10 hover:bg-surface-variant"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3">
          <h3 className={`text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2 ${collapsed ? 'text-center' : 'px-3'}`}>
            {collapsed ? '·' : 'Navigation'}
          </h3>
          <ul className="space-y-1">
            {mainItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={item.onClick}
                  className={`w-full flex items-center ${collapsed ? 'justify-center px-3' : 'px-3'} py-2 rounded-lg text-sm transition-colors ${
                    item.active
                      ? 'bg-active text-primary font-medium'
                      : 'hover:bg-surface-variant text-on-surface'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`${item.active ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="ml-3 flex-1 text-left">{item.label}</span>
                      {item.count !== undefined && (
                        <span className="text-xs bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded">
                          {item.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 px-3">
          <h3 className={`text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2 ${collapsed ? 'text-center' : 'px-3'}`}>
            {collapsed ? '·' : 'Projects'}
          </h3>
          <ul className="space-y-1">
            {contextItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={item.onClick}
                  className={`w-full flex items-center ${collapsed ? 'justify-center px-3' : 'px-3'} py-2 rounded-lg text-sm transition-colors hover:bg-surface-variant text-on-surface`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={item.active ? 'text-primary' : 'text-on-surface-variant'}>{item.icon}</span>
                  {!collapsed && <span className="ml-3 flex-1 text-left">{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
