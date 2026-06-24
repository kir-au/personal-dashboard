'use client';

import { FileText, Folder, Calendar, Tag, TrendingUp } from 'lucide-react';

interface StatCard {
  id: string;
  label: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function StatsCards() {
  const stats: StatCard[] = [
    {
      id: 'total-files',
      label: 'Total Files',
      value: '142',
      change: '+12 this week',
      icon: FileText,
      color: 'text-blue-500'
    },
    {
      id: 'folders',
      label: 'Folders',
      value: '8',
      icon: Folder,
      color: 'text-green-500'
    },
    {
      id: 'this-month',
      label: 'This Month',
      value: '24',
      change: '+8 from last month',
      icon: Calendar,
      color: 'text-purple-500'
    },
    {
      id: 'tags',
      label: 'Unique Tags',
      value: '18',
      icon: Tag,
      color: 'text-orange-500'
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        
        return (
          <div
            key={stat.id}
            className="bg-surface border border-border rounded-lg p-3 md:p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-on-surface-variant mb-1">
                  {stat.label}
                </p>
                <p className="text-xl md:text-2xl font-bold text-on-surface">
                  {stat.value}
                </p>
                {stat.change && (
                  <div className="flex items-center mt-1">
                    <TrendingUp className="w-3 h-3 text-success mr-1" />
                    <span className="text-xs text-success">{stat.change}</span>
                  </div>
                )}
              </div>
              
              <div className={`p-2 rounded-lg ${stat.color.replace('text-', 'bg-')}/10`}>
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
