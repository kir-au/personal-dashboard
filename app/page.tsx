'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import FileBrowser from "@/components/FileBrowser";
import HealthView from "@/components/HealthView";
import PlannerView from "@/components/PlannerView";
import RecentView from "@/components/RecentView";
import SearchView from "@/components/SearchView";
import Sidebar from "@/components/Sidebar";
import TodayView from "@/components/TodayView";
import TopAppBar from "@/components/TopAppBar";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

type DashboardView = 'today' | 'browse' | 'planner' | 'health' | 'recent';

function parseView(value: string | null): DashboardView {
  if (value === 'vault') return 'browse';
  if (value === 'planner' || value === 'health' || value === 'recent' || value === 'today') return value;
  return 'today';
}

export default function Home() {
  const [currentView, setCurrentView] = useState<DashboardView>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const isSearching = currentView === 'browse' && searchQuery.trim().length > 0;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewFromUrl = () => {
      setCurrentView(parseView(new URLSearchParams(window.location.search).get('view')));
    };

    syncViewFromUrl();
    const interval = window.setInterval(syncViewFromUrl, 300);
    return () => window.clearInterval(interval);
  }, []);

  const handleViewChange = (view: DashboardView) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', view === 'browse' ? 'vault' : view);
      window.history.replaceState(null, '', url.toString());
    }
    if (view !== 'browse') {
      setSearchQuery('');
    }
  };

  return (
    <>
      <div className="flex h-screen bg-background">
        <Sidebar currentView={currentView} onViewChange={handleViewChange} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopAppBar
            currentView={currentView}
            onViewChange={handleViewChange}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {isSearching ? (
              <SearchView query={searchQuery} />
            ) : currentView === 'today' ? (
              <TodayView />
            ) : currentView === 'planner' ? (
              <PlannerView />
            ) : currentView === 'health' ? (
              <HealthView />
            ) : currentView === 'browse' ? (
              <FileBrowser />
            ) : (
              <RecentView />
            )}
          </main>
        </div>
      </div>
      <PWAInstallPrompt />
    </>
  );
}
