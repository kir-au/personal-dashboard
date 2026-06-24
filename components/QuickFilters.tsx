'use client';

import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  FileText, 
  Image as ImageIcon,
  FileCode,
  Users,
  Star,
  Download,
  X
} from 'lucide-react';
import { useState } from 'react';

interface FilterOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

const timeFilters: FilterOption[] = [
  { id: 'today', label: 'Today', icon: <Calendar className="w-4 h-4" /> },
  { id: 'yesterday', label: 'Yesterday', icon: <Calendar className="w-4 h-4" /> },
  { id: 'last-week', label: 'Last 7 days', icon: <Clock className="w-4 h-4" /> },
  { id: 'last-month', label: 'Last 30 days', icon: <Clock className="w-4 h-4" /> },
  { id: 'this-year', label: 'This year', icon: <Calendar className="w-4 h-4" /> },
];

const typeFilters: FilterOption[] = [
  { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" />, count: 24 },
  { id: 'images', label: 'Images', icon: <ImageIcon className="w-4 h-4" />, count: 8 },
  { id: 'code', label: 'Code', icon: <FileCode className="w-4 h-4" />, count: 15 },
  { id: 'shared', label: 'Shared', icon: <Users className="w-4 h-4" />, count: 3 },
  { id: 'starred', label: 'Starred', icon: <Star className="w-4 h-4" />, count: 5 },
  { id: 'downloaded', label: 'Recently downloaded', icon: <Download className="w-4 h-4" />, count: 12 },
];

export default function QuickFilters() {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['today']));
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const toggleFilter = (filterId: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filterId)) {
      newFilters.delete(filterId);
    } else {
      newFilters.add(filterId);
    }
    setActiveFilters(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters(new Set());
  };

  const visibleTypeFilters = showMoreFilters ? typeFilters : typeFilters.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Active filters bar */}
      {activeFilters.size > 0 && (
        <div className="flex items-center justify-between bg-surface-variant rounded-lg px-4 py-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-on-surface-variant">
              {activeFilters.size} filter{activeFilters.size !== 1 ? 's' : ''} active
            </span>
            <div className="flex items-center space-x-1">
              {Array.from(activeFilters).map((filterId) => {
                const allFilters = [...timeFilters, ...typeFilters];
                const filter = allFilters.find(f => f.id === filterId);
                if (!filter) return null;
                
                return (
                  <button
                    key={filterId}
                    className="inline-flex items-center bg-surface border border-border rounded-full pl-2.5 pr-1.5 py-1 text-xs hover:bg-hover transition-colors"
                    onClick={() => toggleFilter(filterId)}
                  >
                    <span className="mr-1.5 text-on-surface-variant">{filter.icon}</span>
                    <span className="mr-1 text-on-surface">{filter.label}</span>
                    <X className="w-3 h-3 text-on-surface-variant" />
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={clearAllFilters}
            className="text-sm text-primary hover:text-primary-dark font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Time filters */}
      <div>
        <h3 className="text-sm font-medium text-on-surface mb-2 flex items-center">
          <Clock className="w-4 h-4 mr-2 text-on-surface-variant" />
          Time
        </h3>
        <div className="flex flex-wrap gap-2">
          {timeFilters.map((filter) => (
            <button
              key={filter.id}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border transition-colors ${
                activeFilters.has(filter.id)
                  ? 'bg-active border-primary text-primary'
                  : 'bg-surface border-border text-on-surface hover:bg-surface-variant'
              }`}
              onClick={() => toggleFilter(filter.id)}
            >
              <span className="mr-1.5">{filter.icon}</span>
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type filters */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-on-surface flex items-center">
            <FileText className="w-4 h-4 mr-2 text-on-surface-variant" />
            Type
          </h3>
          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className="text-xs text-primary hover:text-primary-dark font-medium"
          >
            {showMoreFilters ? 'Show less' : 'Show more'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleTypeFilters.map((filter) => (
            <button
              key={filter.id}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border transition-colors ${
                activeFilters.has(filter.id)
                  ? 'bg-active border-primary text-primary'
                  : 'bg-surface border-border text-on-surface hover:bg-surface-variant'
              }`}
              onClick={() => toggleFilter(filter.id)}
            >
              <span className="mr-1.5">{filter.icon}</span>
              {filter.label}
              {filter.count !== undefined && (
                <span className="ml-1.5 text-xs bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded">
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-on-surface">142</div>
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xs text-on-surface-variant mt-1">Total files</div>
        </div>
        
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-on-surface">4.2 GB</div>
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div className="text-xs text-on-surface-variant mt-1">Storage used</div>
        </div>
        
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-on-surface">24</div>
            <Calendar className="w-5 h-5 text-warning" />
          </div>
          <div className="text-xs text-on-surface-variant mt-1">This month</div>
        </div>
        
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-on-surface">3</div>
            <Users className="w-5 h-5 text-on-surface-variant" />
          </div>
          <div className="text-xs text-on-surface-variant mt-1">Shared</div>
        </div>
      </div>
    </div>
  );
}
