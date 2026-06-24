'use client';

import { ChevronRight, Home, Folder } from 'lucide-react';
import { useState, useEffect } from 'react';

interface BreadcrumbItem {
  name: string;
  path: string;
  icon: typeof Home | typeof Folder;
}

export default function Breadcrumbs() {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { name: 'Personal Dashboard', path: '', icon: Home },
  ]);

  // In a real implementation, this would come from the file browser state
  // For now, we'll simulate based on URL or state management
  useEffect(() => {
    // This would be replaced with actual path from file browser
    const currentPath = ''; // Root
    const pathParts = currentPath.split('/').filter(Boolean);
    
    const newBreadcrumbs: BreadcrumbItem[] = [
      { name: 'Personal Dashboard', path: '', icon: Home },
    ];
    
    pathParts.forEach((part, index) => {
      const path = pathParts.slice(0, index + 1).join('/');
      newBreadcrumbs.push({
        name: part,
        path,
        icon: Folder,
      });
    });
    
    setBreadcrumbs(newBreadcrumbs);
  }, []);

  const handleBreadcrumbClick = (path: string, index: number) => {
    // Navigate to the breadcrumb path
    console.log('Navigate to:', path);
    // In a real implementation, this would update the file browser
    // For example: setCurrentPath(path);
  };

  return (
    <nav className="flex items-center text-sm" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {breadcrumbs.map((crumb, index) => {
          const Icon = crumb.icon;
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <li key={crumb.path || 'root'} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-3 h-3 mx-1 text-on-surface-variant flex-shrink-0" />
              )}
              
              <button
                onClick={() => handleBreadcrumbClick(crumb.path, index)}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded transition-colors ${
                  isLast
                    ? 'text-on-surface font-medium'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
                }`}
                aria-current={isLast ? 'page' : undefined}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-none">{crumb.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
      
      {/* Current path display for mobile */}
      <div className="ml-auto md:hidden">
        <div className="text-xs text-on-surface-variant bg-surface-variant px-2 py-1 rounded">
          {breadcrumbs.length} level{breadcrumbs.length !== 1 ? 's' : ''} deep
        </div>
      </div>
    </nav>
  );
}
