import type { Deploy, Site } from "../domain.ts"

interface VercelProject {
  name: string
  latestDeployment?: {
    state?: string
    created?: number
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

  async listSites(): Promise<Site[]> {
    const res = await fetch(this.url("/v9/projects"), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) throw new Error(`Vercel API error (${res.status})`)
    const json = (await res.json()) as { projects?: VercelProject[] }
    return (json.projects ?? []).map((project) => ({
      id: project.name,
      name: project.name,
      provider: { id: "vercel", name: "Vercel" },
      status: project.latestDeployment?.state ?? "unknown",
      environment: "production",
      lastDeploy: project.latestDeployment?.created ? new Date(project.latestDeployment.created).toISOString() : null,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canDeploy: true,
    }))
  }

  async listDeployments(): Promise<Deploy[]> {
    const res = await fetch(this.url("/v13/deployments"), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) throw new Error(`Vercel API error (${res.status})`)
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
