'use client';

import { useEffect, useMemo, useState } from 'react';
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
  backlog?: {
    title: string;
    goal: string;
    whyThisMatters: string;
    items: Array<{
      id: string;
      title: string;
      status: string;
      priority: number;
      horizon: string;
      targetDate?: string;
      why: string;
      notDoneBecause: string;
      desiredOutcome: string;
      sourcePaths?: string[];
    }>;
  };
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

interface ProjectTimelineItem {
  id: string;
  priority: number;
  dateLabel: string;
  status: string;
  title: string;
  plan: string;
  why?: string;
  notDoneBecause?: string;
  outcome?: string;
  sourcePaths?: string[];
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

function formatProjectDate(dateValue?: string) {
  if (!dateValue) return null;
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateValue}T00:00:00`));
}

function buildProjectTimelineItems(
  project: { next: string },
  insights: ProjectInsights | null,
  sources: ProjectSources | null
): ProjectTimelineItem[] {
  if (insights?.backlog?.items?.length) {
    return insights.backlog.items
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .map((item) => ({
        id: item.id,
        priority: item.priority,
        dateLabel: formatProjectDate(item.targetDate) || item.horizon,
        status: item.status,
        title: item.title,
        plan: item.desiredOutcome,
        why: item.why,
        notDoneBecause: item.notDoneBecause,
        outcome: item.desiredOutcome,
        sourcePaths: item.sourcePaths,
      }));
  }

  if (insights?.suggestedActions?.length) {
    return insights.suggestedActions.map((action, index) => ({
      id: `action-${index}-${action.title}`,
      priority: 100 - index * 10,
      dateLabel: action.horizon,
      status: 'suggested',
      title: action.title,
      plan: action.description,
      outcome: action.target,
      sourcePaths: [],
    }));
  }

  if (insights?.workstreams?.length) {
    return insights.workstreams.map((workstream, index) => ({
      id: `workstream-${index}-${workstream.title}`,
      priority: 90 - index * 10,
      dateLabel: 'this-week',
      status: 'review',
      title: workstream.title,
      plan: workstream.nextStep,
      why: workstream.why,
      sourcePaths: [],
    }));
  }

  if (sources?.conversations?.length) {
    return sources.conversations.slice(0, 8).map((conversation, index) => ({
      id: `source-${conversation.conversationId}`,
      priority: 90 - index * 5,
      dateLabel: conversation.vaultDate
        ? formatProjectDate(conversation.vaultDate) || conversation.vaultDate
        : 'source',
      status: 'review',
      title: `Review: ${conversation.title}`,
      plan: conversation.snippetFromProjectUi || 'Decide whether this discussion should stay as reference or become an active commitment.',
      why: 'This source is linked to the project, but no current priority item has been promoted from it yet.',
      notDoneBecause: 'Needs human review before it becomes current work.',
      outcome: 'Keep as reference, dismiss it, or promote one concrete next step.',
      sourcePaths: [conversation.rawPath],
    }));
  }

  return [{
    id: 'project-next-step',
    priority: 100,
    dateLabel: 'next',
    status: 'candidate',
    title: 'Next useful step',
    plan: project.next,
  }];
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
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
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
    setSources(null);
    setSourcesError(null);
    setInsights(null);
    setSelectedTimelineId(null);
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

  const sourceCount = sources?.conversations.length ?? 0;
  const sourceTitle = sources?.title || project.title;
  const projectTimelineItems = useMemo(
    () => buildProjectTimelineItems(project, insights, sources),
    [project.next, insights, sources]
  );
  const selectedTimelineItem =
    projectTimelineItems.find((item) => item.id === selectedTimelineId) ||
    projectTimelineItems[0] ||
    null;

  useEffect(() => {
    if (!projectTimelineItems.length) {
      setSelectedTimelineId(null);
      return;
    }
    if (!selectedTimelineId || !projectTimelineItems.some((item) => item.id === selectedTimelineId)) {
      setSelectedTimelineId(projectTimelineItems[0].id);
    }
  }, [projectTimelineItems, selectedTimelineId]);

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
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              {project.icon}
              <span className="text-xs font-semibold uppercase tracking-wide">{project.title}</span>
            </div>
            <h2 className="text-xl font-semibold text-on-surface">Plan timeline</h2>
            <p className="text-sm text-on-surface-variant">
              Current priorities, selected detail, and recorded source context in one place.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="rounded border border-border bg-surface-variant px-3 py-1.5 text-xs text-on-surface-variant">
              {project.status}
            </span>
            <span className="rounded border border-primary/30 bg-active px-3 py-1.5 text-xs font-medium text-primary">
              {projectTimelineItems.length} item{projectTimelineItems.length === 1 ? '' : 's'}
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
        {archiveStatus === 'error' && <p className="mb-3 text-sm text-error">Could not archive this project.</p>}

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[110px_130px_110px_1fr] bg-surface-variant px-3 py-2 text-xs font-semibold text-on-surface">
            <div>Plan</div>
            <div>Target</div>
            <div>Status</div>
            <div>Plan</div>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {projectTimelineItems.map((item, index) => {
              const isSelected = selectedTimelineItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedTimelineId(item.id)}
                  className={`grid w-full grid-cols-[110px_130px_110px_1fr] border-t border-border px-3 py-3 text-left text-sm ${
                    isSelected ? 'bg-active' : index === 0 ? 'bg-hover' : 'bg-surface hover:bg-hover'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-on-surface">P{item.priority}</p>
                    {index === 0 && <p className="mt-1 text-xs text-on-surface-variant">current</p>}
                  </div>
                  <div className="text-on-surface-variant">{item.dateLabel}</div>
                  <div>
                    <span className="inline-flex rounded border border-border bg-surface px-2 py-0.5 text-xs text-on-surface-variant">
                      {item.status}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-on-surface">{item.title}</h3>
                    <p className="mt-1 text-on-surface-variant">{item.plan}</p>
                    {item.notDoneBecause && (
                      <p className="mt-2 w-fit rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                        Not done: {item.notDoneBecause}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
            {!projectTimelineItems.length && (
              <div className="border-t border-border p-6 text-sm text-on-surface-variant">
                No active project timeline yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedTimelineItem && (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="rounded border border-primary/30 bg-active px-2 py-1 text-xs font-semibold uppercase text-primary">
                Selected plan detail
              </span>
              <h2 className="mt-3 text-2xl font-semibold text-on-surface">{selectedTimelineItem.title}</h2>
              <p className="mt-2 text-on-surface-variant">{selectedTimelineItem.plan}</p>
            </div>
            <span className="w-fit rounded border border-border bg-surface-variant px-3 py-1.5 text-xs text-on-surface-variant">
              {selectedTimelineItem.dateLabel}
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface-variant p-3">
              <h3 className="text-xs font-semibold uppercase text-on-surface-variant">Why</h3>
              <p className="mt-2 text-sm text-on-surface">
                {selectedTimelineItem.why || insights?.summary || project.summary}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-variant p-3">
              <h3 className="text-xs font-semibold uppercase text-on-surface-variant">Outcome</h3>
              <p className="mt-2 text-sm text-on-surface">
                {selectedTimelineItem.outcome || selectedTimelineItem.plan}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-xs font-semibold uppercase text-amber-900">Decision needed</h3>
              <p className="mt-2 text-sm text-amber-950">
                {selectedTimelineItem.notDoneBecause || 'No blocker recorded. Keep, defer, or promote from assistant actions if context changes.'}
              </p>
            </div>
          </div>

          {Boolean(selectedTimelineItem.sourcePaths?.length) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedTimelineItem.sourcePaths?.map((sourcePath) => (
                <button
                  key={sourcePath}
                  onClick={() => openVaultFile(sourcePath)}
                  className="inline-flex items-center gap-1 rounded border border-primary/30 bg-surface px-2.5 py-1.5 text-xs text-primary hover:bg-active"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {sourcePath.split('/').pop()}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Recorded context</h2>
            <p className="text-sm text-on-surface-variant">
              Linked vault discussions and extracted notes that support the current plan.
            </p>
          </div>
          <span className="w-fit rounded border border-border bg-surface-variant px-3 py-1.5 text-xs text-on-surface-variant">
            {sourcesLoading ? 'Loading...' : `${sourceCount} source${sourceCount === 1 ? '' : 's'}`}
          </span>
        </div>

        {sourcesError ? (
          <p className="text-sm text-error">{sourcesError}</p>
        ) : !sources?.conversations.length ? (
          <p className="text-sm text-on-surface-variant">
            No linked sources yet. Captures will stay readable in the vault until they are promoted into this project.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {sources.conversations.slice(0, 3).map((conversation) => (
              <article key={conversation.conversationId} className="rounded-lg border border-border bg-surface-variant p-3">
                <button
                  onClick={() => openVaultFile(conversation.rawPath)}
                  className="line-clamp-2 text-left text-sm font-semibold text-on-surface hover:text-primary"
                >
                  {conversation.title}
                </button>
                {conversation.snippetFromProjectUi && (
                  <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{conversation.snippetFromProjectUi}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  <span>{conversation.vaultDate || 'No date'}</span>
                  <span>{conversation.messageCount ?? 0} messages</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {insightsLoading && <p className="mt-3 text-xs text-on-surface-variant">Loading extracted project layer...</p>}
        {insights?.currentFocus && (
          <p className="mt-3 rounded border border-primary/20 bg-active px-3 py-2 text-sm text-on-surface">
            <strong>Current focus:</strong> {insights.currentFocus}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-on-surface">
            Reference sources{sourceCount ? ` (${sourceCount})` : ''}
          </summary>
          <div className="mt-4 divide-y divide-border rounded-lg border border-border">
            {sourcesLoading ? (
              <div className="p-4 text-sm text-on-surface-variant">Loading project sources...</div>
            ) : sourcesError ? (
              <div className="p-4 text-sm text-error">{sourcesError}</div>
            ) : !sources?.conversations.length ? (
              <div className="p-4 text-sm text-on-surface-variant">No project sources are indexed yet.</div>
            ) : (
              sources.conversations.map((conversation) => (
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
              ))
            )}
          </div>
        </details>
      </section>

      <MarkdownModal
        file={selectedFile}
        content={fileContent}
        loading={contentLoading}
        onClose={closeModal}
      />
    </div>
  );
}
