import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    title: 'Weekly plan from Personal Vault',
    weekFocus: 'Use the vault as the source of truth, then generate a small set of tasks that can move the day and week forward.',
    generatedFrom: [
      'Raw conversations and check-ins',
      'Structured decisions and long-term goals',
      'Project summaries and recent changes',
      'Health, family, and energy constraints',
    ],
    tasks: [
      {
        id: 'product-dashboard-boundary',
        title: 'Separate Personal Vault as headless memory backend and keep dashboard as the human surface.',
        area: 'Product',
        status: 'planned',
        source: 'Vault direction and current architecture discussion',
      },
      {
        id: 'product-planner-projection',
        title: 'Replace standalone Planner ownership with generated week/today projection.',
        area: 'Product',
        status: 'suggested',
        source: 'Planner state/plan.json concept',
      },
      {
        id: 'health-energy-baseline',
        title: 'Keep the day plan energy-aware: food, hydration, recovery, and small execution block.',
        area: 'Health',
        status: 'suggested',
        source: 'Operating profile and morning resurfacing notes',
      },
      {
        id: 'family-visible',
        title: 'Keep family/life context visible even when the main task is product work.',
        area: 'Family',
        status: 'suggested',
        source: 'Today brief and day map requirements',
      },
      {
        id: 'admin-backup-boundary',
        title: 'Define backup/export and access-control model before broader agent write access.',
        area: 'Admin',
        status: 'suggested',
        source: 'Personal Vault access-control decision',
      },
    ],
  });
}
