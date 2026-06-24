'use client';

import {
  Brain,
  BriefcaseBusiness,
  Car,
  ChartCandlestick,
  Folder,
  Landmark,
  Plane,
  Repeat,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

interface ProjectViewProps {
  projectId: string;
}

const projects: Record<string, { title: string; icon: React.ReactNode; summary: string; next: string; status: string }> = {
  business: {
    title: 'Business',
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    summary: 'Product execution, operating system work, and business decisions from the vault.',
    next: 'Promote the strongest active business thread into a concrete Today task.',
    status: 'Active',
  },
  ai: {
    title: 'AI',
    icon: <Sparkles className="h-5 w-5" />,
    summary: 'AI usage, vault extraction, summarization, API/MCP boundaries, and automation ideas.',
    next: 'Define the capture -> summary -> index pipeline as a reusable local service.',
    status: 'Design',
  },
  family: {
    title: 'Family',
    icon: <Users className="h-5 w-5" />,
    summary: 'Life context that should remain visible even when product work becomes urgent.',
    next: 'Keep family context visible in Today without turning it into noisy task debt.',
    status: 'Visible',
  },
  wealth: {
    title: 'Wealth',
    icon: <TrendingUp className="h-5 w-5" />,
    summary: 'Investing, trading, financial planning, risk, and long-term wealth context.',
    next: 'Collect source notes before generating action recommendations.',
    status: 'Waiting',
  },
  travel: {
    title: 'Travel',
    icon: <Plane className="h-5 w-5" />,
    summary: 'Travel ideas, constraints, plans, and logistics from vault conversations.',
    next: 'Create a structured travel project only when an active trip exists.',
    status: 'Dormant',
  },
  routine: {
    title: 'Routine',
    icon: <Repeat className="h-5 w-5" />,
    summary: 'Repeated actions that stabilize the day: check-in, movement, food, focus, shutdown.',
    next: 'Pull routine commitments into Today as compact agenda blocks.',
    status: 'Daily',
  },
  trading: {
    title: 'Trading',
    icon: <ChartCandlestick className="h-5 w-5" />,
    summary: 'Trading notes, setups, risk rules, exchange tooling, and Binance project context.',
    next: 'Separate trading decisions from implementation tasks.',
    status: 'Watch',
  },
  car: {
    title: 'Car',
    icon: <Car className="h-5 w-5" />,
    summary: 'Car-related research, maintenance, decisions, and future planning.',
    next: 'Capture active car decisions when they become time-sensitive.',
    status: 'Dormant',
  },
  work: {
    title: 'Work',
    icon: <Folder className="h-5 w-5" />,
    summary: 'Work context, deliverables, constraints, and follow-up loops.',
    next: 'Connect work tasks to Today only when they are explicit commitments.',
    status: 'Open',
  },
  politics: {
    title: 'Politics',
    icon: <Landmark className="h-5 w-5" />,
    summary: 'Political notes and thinking that may be useful for later review.',
    next: 'Keep as reference unless a specific action is needed.',
    status: 'Reference',
  },
  startup: {
    title: 'Startup',
    icon: <Brain className="h-5 w-5" />,
    summary: 'Startup ideas, product strategy, and experiments emerging from vault discussions.',
    next: 'Convert only validated threads into Business or Today tasks.',
    status: 'Exploring',
  },
};

export default function ProjectView({ projectId }: ProjectViewProps) {
  const project = projects[projectId] || projects.business;

  return (
    <div className="flex w-full max-w-[1440px] flex-col gap-4 pb-8">
      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-primary">
          {project.icon}
          <span className="text-xs font-semibold uppercase tracking-wide">Project / Life Area</span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-on-surface">{project.title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">{project.summary}</p>
          </div>
          <span className="w-fit rounded border border-border bg-surface-variant px-3 py-1.5 text-xs text-on-surface-variant">
            {project.status}
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-base font-semibold text-on-surface">Next useful step</h3>
        <p className="mt-2 text-sm text-on-surface-variant">{project.next}</p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-base font-semibold text-on-surface">Vault connection</h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          This page is a placeholder for a structured project summary generated from the vault. The Health page is the reference implementation: a project becomes useful when it exposes today&apos;s concrete action and links back to its source files.
        </p>
      </section>
    </div>
  );
}
