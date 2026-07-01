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
  Users,
  X
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
  currentView: 'today' | 'browse' | 'planner' | 'health' | 'recent' | 'project';
  onViewChange: (view: 'today' | 'browse' | 'planner' | 'health' | 'recent' | 'project') => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ currentView, onViewChange, mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [recentCount, setRecentCount] = useState<number | undefined>(undefined);
  const drawerCollapsed = collapsed && !mobileOpen;

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
      onClick: () => {
        onViewChange('today');
        onMobileClose?.();
      },
    },
    {
      id: 'vault',
      label: 'Vault',
      icon: <HardDrive className="w-5 h-5" />,
      active: currentView === 'browse',
      onClick: () => {
        onViewChange('browse');
        onMobileClose?.();
      },
    },
    {
      id: 'planner',
      label: 'Planner',
      icon: <CalendarDays className="w-5 h-5" />,
      active: currentView === 'planner',
      onClick: () => {
        onViewChange('planner');
        onMobileClose?.();
      },
    },
    {
      id: 'recent',
      label: 'Recent Changes',
      icon: <Clock className="w-5 h-5" />,
      count: recentCount,
      active: currentView === 'recent',
      onClick: () => {
        onViewChange('recent');
        onMobileClose?.();
      },
    },
  ];

  const contextItems: SidebarItem[] = [
    {
      id: 'health',
      label: 'Health',
      icon: <Dumbbell className="w-4 h-4" />,
      active: currentView === 'health',
      onClick: () => {
        onViewChange('health');
        onMobileClose?.();
      },
    },
    ...[
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
    ].map((item) => ({
      ...item,
      active: currentView === 'project' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('project') === item.id,
      onClick: () => {
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('view', 'project');
          url.searchParams.set('project', item.id);
          window.history.replaceState(null, '', url.toString());
        }
        onViewChange('project');
        onMobileClose?.();
      },
    })),
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-surface flex flex-col transition-transform duration-200 md:relative md:z-auto md:translate-x-0 md:flex-shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-16' : 'md:w-64'}`}
      >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 hidden w-6 h-6 bg-surface border border-border rounded-full md:flex items-center justify-center z-10 hover:bg-surface-variant"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      <button
        onClick={onMobileClose}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-variant md:hidden"
        title="Close navigation"
      >
        <X className="h-5 w-5 text-on-surface-variant" />
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-12 md:py-4">
        <div className="px-3">
          <h3 className={`text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2 ${drawerCollapsed ? 'text-center' : 'px-3'}`}>
            {drawerCollapsed ? '·' : 'Navigation'}
          </h3>
          <ul className="space-y-1">
            {mainItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={item.onClick}
                  className={`w-full flex items-center ${drawerCollapsed ? 'justify-center px-3' : 'px-3'} py-2 rounded-lg text-sm transition-colors ${
                    item.active
                      ? 'bg-active text-primary font-medium'
                      : 'hover:bg-surface-variant text-on-surface'
                  }`}
                  title={drawerCollapsed ? item.label : undefined}
                >
                  <span className={`${item.active ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {item.icon}
                  </span>
                  {!drawerCollapsed && (
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
          <h3 className={`text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2 ${drawerCollapsed ? 'text-center' : 'px-3'}`}>
            {drawerCollapsed ? '·' : 'Projects'}
          </h3>
          <ul className="space-y-1">
            {contextItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={item.onClick}
                  className={`w-full flex items-center ${drawerCollapsed ? 'justify-center px-3' : 'px-3'} py-2 rounded-lg text-sm transition-colors ${
                    item.active ? 'bg-active text-primary font-medium' : 'hover:bg-surface-variant text-on-surface'
                  }`}
                  title={drawerCollapsed ? item.label : undefined}
                >
                  <span className={item.active ? 'text-primary' : 'text-on-surface-variant'}>{item.icon}</span>
                  {!drawerCollapsed && <span className="ml-3 flex-1 text-left">{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      </aside>
    </>
  );
}
