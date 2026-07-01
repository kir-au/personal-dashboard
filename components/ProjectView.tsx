'use client';

import { useEffect, useState } from 'react';
import {
  Brain,
  Archive,
  BriefcaseBusiness,
  Car,
  ChartCandlestick,
  ExternalLink,
  FileText,
  Folder,
  Landmark,
  Plane,
  Repeat,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import MarkdownModal from './MarkdownModal';

interface ProjectViewProps {
  projectId: string;
}

interface ProjectPlanDay {
  day: number;
  date: string;
  label: string;
  kind: string;
  title: string;
  plan: string;
  output?: string;
}

interface ProjectPlan {
  title: string;
  goal: string;
  rule: string;
  todayDate: string;
  today: ProjectPlanDay | null;
  upcoming: ProjectPlanDay | null;
  days: ProjectPlanDay[];
}

interface ProjectSourceConversation {
  project: string;
  projectTitle: string;
  order: number;
  conversationId: string;
  title: string;
  snippetFromProjectUi?: string | null;
  rawPath: string;
  created?: string | null;
  updated?: string | null;
  vaultDate?: string | null;
  messageCount?: number;
  assetCount?: number;
  source?: string;
  matchMethod?: string;
}

interface ProjectSources {
  project: string;
  title: string;
  description?: string;
  chatgptProjectTemplateId?: string;
  conversationCount?: number;
  uiConfirmedConversationCount?: number;
  conversations: ProjectSourceConversation[];
}

interface ProjectInsightWorkstream {
  title: string;
  why: string;
  nextStep: string;
  sourceTitles?: string[];
}

interface ProjectInsightAction {
  title: string;
  horizon: string;
  description: string;
  target: string;
  sourceTitles?: string[];
}

interface ProjectInsights {
  project: string;
  title: string;
  summary: string;
  currentFocus?: string;
  workstreams?: ProjectInsightWorkstream[];
  suggestedActions?: ProjectInsightAction[];
}

interface RegistryProject {
  id: string;
  title: string;
  status?: string;
  summary?: string;
  next?: string;
  icon?: string;
  system?: boolean;
}

interface SelectedVaultFile {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  mtime: number;
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

function iconForProject(icon?: string) {
  switch (icon) {
    case 'business': return <BriefcaseBusiness className="h-5 w-5" />;
    case 'ai': return <Sparkles className="h-5 w-5" />;
    case 'family': return <Users className="h-5 w-5" />;
    case 'wealth': return <TrendingUp className="h-5 w-5" />;
    case 'travel': return <Plane className="h-5 w-5" />;
    case 'routine': return <Repeat className="h-5 w-5" />;
    case 'trading': return <ChartCandlestick className="h-5 w-5" />;
    case 'car': return <Car className="h-5 w-5" />;
    case 'politics': return <Landmark className="h-5 w-5" />;
    case 'startup': return <Brain className="h-5 w-5" />;
    default: return <Folder className="h-5 w-5" />;
  }
}

export default function ProjectView({ projectId }: ProjectViewProps) {
  const fallbackProject = projects[projectId] || projects.business;
  const [registryProject, setRegistryProject] = useState<RegistryProject | null>(null);
  const project: {
    title: string;
    icon: React.ReactNode;
    summary: string;
    next: string;
    status: string;
    system?: boolean;
  } = registryProject
    ? {
        title: registryProject.title,
        icon: iconForProject(registryProject.icon || registryProject.id),
        summary: registryProject.summary || fallbackProject.summary,
        next: registryProject.next || fallbackProject.next,
        status: registryProject.status || fallbackProject.status,
        system: registryProject.system,
      }
    : { ...fallbackProject, system: false };
  const [aiPlan, setAiPlan] = useState<ProjectPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sources'>('overview');
  const [sources, setSources] = useState<ProjectSources | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [insights, setInsights] = useState<ProjectInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedVaultFile | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        const match = Array.isArray(data.projects)
          ? data.projects.find((item: RegistryProject) => item.id === projectId)
          : null;
        setRegistryProject(match || null);
      })
      .catch(() => setRegistryProject(null));
  }, [projectId]);

  useEffect(() => {
    if (projectId !== 'ai') return;
    fetch('/api/projects/ai-publishing')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setAiPlan(data);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    setActiveTab('overview');
    setSources(null);
    setSourcesError(null);
    setInsights(null);
    setSelectedFile(null);
    setFileContent(null);
  }, [projectId]);

  useEffect(() => {
    setSourcesLoading(true);
    setSourcesError(null);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/sources`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to load project sources');
        setSources(data);
      })
      .catch((error) => {
        setSources(null);
        setSourcesError(error instanceof Error ? error.message : 'Failed to load project sources');
      })
      .finally(() => setSourcesLoading(false));
  }, [projectId]);

  useEffect(() => {
    setInsightsLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/insights`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) {
          setInsights(null);
          return;
        }
        setInsights(data);
      })
      .catch(() => setInsights(null))
      .finally(() => setInsightsLoading(false));
  }, [projectId]);

  const activeDay = aiPlan?.today ?? aiPlan?.upcoming ?? null;
  const sourceCount = sources?.conversations.length ?? 0;
  const sourceTitle = sources?.title || project.title;

  const openVaultFile = async (relativePath: string) => {
    const name = relativePath.split('/').pop() || relativePath;
    setSelectedFile({
      name,
      path: relativePath,
      relativePath,
      size: 0,
      mtime: Date.now(),
    });
    setContentLoading(true);

    try {
      const response = await fetch(`/api/files/${encodeURIComponent(relativePath)}`);
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to open vault file');
      setFileContent(data);
      setSelectedFile({
        name,
        path: relativePath,
        relativePath,
        size: data.stats?.size ?? 0,
        mtime: data.stats?.mtime ?? Date.now(),
      });
    } catch (error) {
      setSourcesError(error instanceof Error ? error.message : 'Failed to open vault file');
      setFileContent(null);
    } finally {
      setContentLoading(false);
    }
  };

  const openInVault = (relativePath: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'vault');
    url.searchParams.set('file', relativePath);
    const directoryPath = relativePath.includes('/')
      ? relativePath.split('/').slice(0, -1).join('/')
      : '';
    if (directoryPath) url.searchParams.set('path', directoryPath);
    window.history.replaceState(null, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const closeModal = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  const archiveProject = async () => {
    if (!window.confirm(`Archive ${project.title}? Raw vault files and source indexes will stay intact.`)) return;
    setArchiveStatus('saving');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to archive project');
      window.dispatchEvent(new Event('projects-changed'));
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'today');
      url.searchParams.delete('project');
      window.history.replaceState(null, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      setArchiveStatus('error');
    }
  };

  return (
    <div className="flex w-full max-w-[1440px] flex-col gap-4 pb-8">
      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-primary">
          {project.icon}
          <span className="text-xs font-semibold uppercase tracking-wide">Project / Life Area</span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0" style={{ width: 'min(760px, 100%)' }}>
            <h2 className="text-2xl font-semibold text-on-surface">{project.title}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">{project.summary}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="w-fit rounded border border-border bg-surface-variant px-3 py-1.5 text-xs text-on-surface-variant">
              {project.status}
            </span>
            {!project.system && (
              <button
                onClick={archiveProject}
                disabled={archiveStatus === 'saving'}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface px-3 py-1.5 text-xs text-on-surface-variant hover:bg-hover disabled:opacity-50"
              >
                <Archive className="h-3.5 w-3.5" />
                {archiveStatus === 'saving' ? 'Archiving...' : 'Archive'}
              </button>
            )}
          </div>
        </div>
        {archiveStatus === 'error' && (
          <p className="mt-3 text-sm text-error">Could not archive this project.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-base font-semibold text-on-surface">Next useful step</h3>
        <p className="mt-2 text-sm text-on-surface-variant">{activeDay?.plan ?? project.next}</p>
      </section>

      <div className="flex flex-wrap items-center gap-2 border-b border-border">
        {[
          { id: 'overview' as const, label: 'Overview' },
          { id: 'sources' as const, label: `Sources${sourceCount ? ` ${sourceCount}` : ''}` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && projectId === 'ai' && aiPlan && (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0" style={{ width: 'min(760px, 100%)' }}>
              <h3 className="text-base font-semibold text-on-surface">{aiPlan.title}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{aiPlan.goal}</p>
            </div>
            {activeDay && (
              <span className="w-fit rounded border border-primary/30 bg-active px-3 py-1.5 text-xs font-medium text-primary">
                {aiPlan.today ? 'Today' : 'Next'}: Day {activeDay.day}
              </span>
            )}
          </div>
          <div className="rounded-lg border-l-4 border-orange-500 bg-orange-50 px-3 py-2">
            <p className="text-sm text-on-surface"><strong>Rule:</strong> {aiPlan.rule}</p>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-[84px_120px_120px_1fr] bg-surface-variant px-3 py-2 text-xs font-semibold text-on-surface">
              <div>Day</div>
              <div>Date</div>
              <div>Type</div>
              <div>Plan</div>
            </div>
            {aiPlan.days.map((day) => {
              const isActive = day.day === activeDay?.day;
              const isPast = day.date < aiPlan.todayDate;
              return (
                <div
                  key={day.day}
                  className={`grid grid-cols-[84px_120px_120px_1fr] border-t border-border px-3 py-3 text-sm ${
                    isActive ? 'bg-active' : isPast ? 'bg-surface text-on-surface-variant opacity-70' : 'bg-surface'
                  }`}
                >
                  <div className="font-semibold text-on-surface">Day {day.day}</div>
                  <div className="text-on-surface-variant">{day.label}</div>
                  <div>
                    <span className="rounded border border-border bg-surface-variant px-2 py-0.5 text-xs text-on-surface-variant">
                      {day.kind}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-on-surface">{day.title}</p>
                    <p className="mt-1 text-on-surface-variant">{day.plan}</p>
                    {day.output && <p className="mt-2 text-xs text-on-surface-variant"><strong>Output:</strong> {day.output}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'overview' && (
        <>
          {insights && (
            <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0" style={{ width: 'min(820px, 100%)' }}>
                  <h3 className="text-base font-semibold text-on-surface">Source-derived layer</h3>
                  <p className="mt-2 text-sm text-on-surface-variant">{insights.summary}</p>
                </div>
                <span className="w-fit rounded border border-primary/30 bg-active px-3 py-1.5 text-xs font-medium text-primary">
                  Extracted
                </span>
              </div>

              {insights.currentFocus && (
                <div className="rounded-lg border-l-4 border-primary bg-active px-3 py-2">
                  <p className="text-sm text-on-surface"><strong>Current focus:</strong> {insights.currentFocus}</p>
                </div>
              )}

              {Boolean(insights.workstreams?.length) && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {insights.workstreams?.map((item) => (
                    <div key={item.title} className="rounded-lg border border-border bg-surface p-3">
                      <h4 className="text-sm font-semibold text-on-surface">{item.title}</h4>
                      <p className="mt-1 text-sm text-on-surface-variant">{item.why}</p>
                      <p className="mt-2 text-sm text-on-surface"><strong>Next:</strong> {item.nextStep}</p>
                    </div>
                  ))}
                </div>
              )}

              {Boolean(insights.suggestedActions?.length) && (
                <div className="mt-4 overflow-hidden rounded-lg border border-border">
                  <div className="bg-surface-variant px-3 py-2 text-xs font-semibold uppercase text-on-surface-variant">
                    Suggested actions
                  </div>
                  {insights.suggestedActions?.map((action) => (
                    <div key={action.title} className="border-t border-border p-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-on-surface">{action.title}</h4>
                          <p className="mt-1 text-sm text-on-surface-variant">{action.description}</p>
                        </div>
                        <span className="w-fit rounded border border-border bg-surface px-2 py-1 text-xs text-on-surface-variant">
                          {action.horizon}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-base font-semibold text-on-surface">Vault connection</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              This project is connected to {sourceCount || 'no'} indexed source discussion{sourceCount === 1 ? '' : 's'}.
              {insightsLoading && ' Loading extracted project layer...'}
              {!insights && !insightsLoading && ' The next layer should summarize those sources into project overview, decisions, actions, and open questions.'}
            </p>
            {sources?.chatgptProjectTemplateId && (
              <p className="mt-3 text-xs text-on-surface-variant">
                ChatGPT project template: <span className="font-mono">{sources.chatgptProjectTemplateId}</span>
              </p>
            )}
          </section>
        </>
      )}

      {activeTab === 'sources' && (
        <section className="rounded-lg border border-border bg-surface shadow-sm">
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-on-surface">{sourceTitle} sources</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Linked raw discussions. These are evidence for summaries and actions, not the main project experience.
                </p>
              </div>
              <span className="w-fit rounded border border-border bg-surface-variant px-3 py-1.5 text-xs text-on-surface-variant">
                {sourceCount} linked
              </span>
            </div>
          </div>

          {sourcesLoading ? (
            <div className="p-6 text-sm text-on-surface-variant">Loading project sources...</div>
          ) : sourcesError ? (
            <div className="p-6 text-sm text-error">{sourcesError}</div>
          ) : !sources?.conversations.length ? (
            <div className="p-6 text-sm text-on-surface-variant">
              No project sources are indexed yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sources.conversations.map((conversation) => (
                <div key={conversation.conversationId} className="flex items-start gap-3 p-4 hover:bg-hover">
                  <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => openVaultFile(conversation.rawPath)}
                      className="block max-w-full truncate text-left text-sm font-semibold text-on-surface hover:text-primary"
                    >
                      {conversation.title}
                    </button>
                    {conversation.snippetFromProjectUi && (
                      <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                        {conversation.snippetFromProjectUi}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                      <span>{conversation.vaultDate || 'No date'}</span>
                      <span>{conversation.messageCount ?? 0} messages</span>
                      {Boolean(conversation.assetCount) && <span>{conversation.assetCount} assets</span>}
                      <span className="font-mono">{conversation.rawPath}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => openInVault(conversation.rawPath)}
                    className="rounded p-2 text-on-surface-variant transition-colors hover:bg-active hover:text-primary"
                    title="Open in Vault"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <MarkdownModal
        file={selectedFile}
        content={fileContent}
        loading={contentLoading}
        onClose={closeModal}
      />
    </div>
  );
}
