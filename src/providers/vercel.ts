import type { Deploy, Site } from "../domain.ts"

interface VercelProject {
  name: string
  framework?: string | null
  gitRepository?: {
    type?: string | null
    repo?: string | null
    org?: string | null
    repoId?: string | number | null
  } | null
  domains?: Array<string | { name?: string | null }> | null
  latestDeployment?: {
    state?: string
    created?: number
    url?: string | null
  } | null
}

interface VercelDeployment {
  uid: string
  name: string
  state: string
  target?: string | null
  created?: number | null
  url?: string | null
  meta?: {
    githubCommitRef?: string | null
    githubCommitAuthorName?: string | null
  } | null
}

export class VercelClient {
  constructor(private token: string, private teamId: string | null) {}

  private url(path: string): string {
    const url = new URL(`https://api.vercel.com${path}`)
    if (this.teamId) url.searchParams.set("teamId", this.teamId)
    return url.toString()
  }

  private async fail(res: Response): Promise<never> {
    const body = await res.text().catch(() => "")
    const detail = body ? `: ${body}` : ""
    throw new Error(`Vercel API error (${res.status} ${res.statusText})${detail}`)
  }

  async listSites(): Promise<Site[]> {
    const res = await fetch(this.url("/v9/projects"), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) await this.fail(res)
    const json = (await res.json()) as { projects?: VercelProject[] }
    return (json.projects ?? []).map((project) => ({
      id: project.name,
      name: project.name,
      provider: { id: "vercel", name: "Vercel" },
      status: project.latestDeployment?.state ?? "unknown",
      environment: "production",
      lastDeploy: project.latestDeployment?.created ? new Date(project.latestDeployment.created).toISOString() : null,
      stack: project.framework ?? null,
      repo: project.gitRepository?.repo ? [project.gitRepository.org, project.gitRepository.repo].filter(Boolean).join("/") : null,
      domains: (project.domains ?? []).map((domain) => typeof domain === "string" ? domain : domain.name).filter((domain): domain is string => Boolean(domain)),
      deploymentUrl: project.latestDeployment?.url ?? null,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canDeploy: true,
    }))
  }

  async getSite(name: string): Promise<Site> {
    const res = await fetch(this.url(`/v9/projects/${encodeURIComponent(name)}`), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) await this.fail(res)
    const project = (await res.json()) as VercelProject
    return {
      id: project.name,
      name: project.name,
      provider: { id: "vercel", name: "Vercel" },
      status: project.latestDeployment?.state ?? "unknown",
      environment: "production",
      lastDeploy: project.latestDeployment?.created ? new Date(project.latestDeployment.created).toISOString() : null,
      stack: project.framework ?? null,
      repo: project.gitRepository?.repo ? [project.gitRepository.org, project.gitRepository.repo].filter(Boolean).join("/") : null,
      domains: (project.domains ?? []).map((domain) => typeof domain === "string" ? domain : domain.name).filter((domain): domain is string => Boolean(domain)),
      deploymentUrl: project.latestDeployment?.url ?? null,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canDeploy: true,
    }
  }

  async listDeployments(): Promise<Deploy[]> {
    const res = await fetch(this.url("/v6/deployments"), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) await this.fail(res)
    const json = (await res.json()) as { deployments?: VercelDeployment[] }
    return (json.deployments ?? []).map((deployment) => ({
      id: deployment.uid,
      siteId: deployment.name,
      status: deployment.state,
      createdAt: deployment.created ? new Date(deployment.created).toISOString() : new Date().toISOString(),
      url: deployment.url ?? null,
      branch: deployment.meta?.githubCommitRef ?? null,
      target: deployment.target ?? null,
      creator: deployment.meta?.githubCommitAuthorName ?? null,
    }))
  }
}
