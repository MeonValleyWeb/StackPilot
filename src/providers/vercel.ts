import { PROVIDERS, type Deploy, type Site } from "../domain.ts"

interface VercelProject {
  name: string
  framework?: string | null
  gitRepository?: {
    type?: string | null
    repo?: string | null
    org?: string | null
    repoId?: string | number | null
  } | null
  latestDeployment?: {
    state?: string
    created?: number
    url?: string | null
  } | null
  latestDeployments?: Array<{
    state?: string
    createdAt?: number
    readyAt?: number
    url?: string | null
    deploymentHostname?: string | null
    target?: string | null
    creator?: { name?: string | null } | null
    meta?: {
      githubCommitRef?: string | null
      githubCommitAuthorName?: string | null
      githubCommitMessage?: string | null
      githubCommitSha?: string | null
    } | null
  }> | null
  link?: {
    repo?: string | null
    org?: string | null
    productionBranch?: string | null
    deployHooks?: unknown
  } | null
  targets?: {
    production?: { alias?: string[] | null } | null
    preview?: { alias?: string[] | null } | null
  } | null
}

interface VercelDeployment {
  uid: string
  name: string
  state: string
  target?: string | null
  created?: number | null
  url?: string | null
  inspectorUrl?: string | null
  meta?: {
    githubCommitRef?: string | null
    githubCommitAuthorName?: string | null
  } | null
}

export interface VercelAccount {
  name: string | null
  plan: string | null
  planStatus: string | null
}

function mapProject(project: VercelProject): Site {
  const latest = project.latestDeployments?.[0]
  return {
    id: project.name,
    name: project.name,
    provider: PROVIDERS.vercel,
    status: latest?.state ?? project.latestDeployment?.state ?? "unknown",
    environment: "production",
    lastDeploy: latest?.createdAt
      ? new Date(latest.createdAt).toISOString()
      : project.latestDeployment?.created
        ? new Date(project.latestDeployment.created).toISOString()
        : null,
    stack: project.framework ?? null,
    repo: project.link?.repo
      ? [project.link.org, project.link.repo].filter(Boolean).join("/")
      : project.gitRepository?.repo
        ? [project.gitRepository.org, project.gitRepository.repo].filter(Boolean).join("/")
        : null,
    branch: project.link?.productionBranch ?? null,
    domains: (project.targets?.production?.alias ?? [])
      .concat(project.targets?.preview?.alias ?? [])
      .map((domain) => domain.replace(/^https?:\/\//, ""))
      .filter((domain, index, arr) => Boolean(domain) && arr.indexOf(domain) === index),
    deploymentUrl: latest?.url ?? project.latestDeployment?.url ?? null,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canDeploy: true,
  }
}

export class VercelClient {
  constructor(private token: string, private teamId: string | null) {}

  private url(path: string): string {
    const url = new URL(`https://api.vercel.com${path}`)
    if (this.teamId) url.searchParams.set("teamId", this.teamId)
    return url.toString()
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(this.url(path), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const detail = body ? `: ${body.slice(0, 200)}` : ""
      throw new Error(`Vercel API error (${res.status} ${res.statusText})${detail}`)
    }
    return (await res.json()) as T
  }

  async listSites(): Promise<Site[]> {
    const json = await this.get<{ projects?: VercelProject[] }>("/v9/projects?limit=100")
    return (json.projects ?? []).map(mapProject)
  }

  async getSite(name: string): Promise<Site> {
    const project = await this.get<VercelProject>(`/v9/projects/${encodeURIComponent(name)}`)
    return mapProject(project)
  }

  async listDeployments(): Promise<Deploy[]> {
    const json = await this.get<{ deployments?: VercelDeployment[] }>("/v6/deployments?limit=50")
    return (json.deployments ?? []).map((deployment) => ({
      id: deployment.uid,
      provider: "vercel" as const,
      siteId: deployment.name,
      siteName: deployment.name,
      status: deployment.state,
      createdAt: deployment.created ? new Date(deployment.created).toISOString() : new Date().toISOString(),
      url: deployment.url ?? null,
      inspectorUrl: deployment.inspectorUrl ?? null,
      branch: deployment.meta?.githubCommitRef ?? null,
      target: deployment.target ?? null,
      creator: deployment.meta?.githubCommitAuthorName ?? null,
      errorCode: null,
      errorMessage: null,
      readyState: deployment.state,
    }))
  }

  async getAccount(): Promise<VercelAccount> {
    const json = await this.get<{ user?: { username?: string | null; name?: string | null; billing?: { plan?: string | null; status?: string | null } | null } }>("/v2/user")
    return {
      name: json.user?.name ?? json.user?.username ?? null,
      plan: json.user?.billing?.plan ?? null,
      planStatus: json.user?.billing?.status ?? null,
    }
  }
}
