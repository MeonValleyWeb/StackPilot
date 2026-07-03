// Cloudflare v4 API client (https://developers.cloudflare.com/api/).
// Auth is an API token passed as a Bearer header (CLOUDFLARE_API_TOKEN).
// Pages projects map onto the shared Site model; zones and Workers scripts are
// Cloudflare-specific and get their own types. If CLOUDFLARE_ACCOUNT_ID is not
// set, the first account visible to the token is used.

import { PROVIDERS, type Deploy, type Site } from "../domain.ts"

interface CfEnvelope<T> {
  success: boolean
  errors?: Array<{ message?: string }>
  result: T
}

interface CfPagesDeployment {
  id: string
  url?: string | null
  environment?: string | null
  created_on?: string | null
  modified_on?: string | null
  latest_stage?: { name?: string | null; status?: string | null } | null
  deployment_trigger?: {
    type?: string | null
    metadata?: { branch?: string | null; commit_hash?: string | null; commit_message?: string | null } | null
  } | null
}

interface CfPagesProject {
  name: string
  subdomain?: string | null
  domains?: string[] | null
  production_branch?: string | null
  created_on?: string | null
  source?: {
    type?: string | null
    config?: { owner?: string | null; repo_name?: string | null; production_branch?: string | null } | null
  } | null
  latest_deployment?: CfPagesDeployment | null
}

export interface CloudflareZone {
  id: string
  name: string
  status: string
  paused: boolean
  plan: string | null
}

export interface WorkerScript {
  id: string
  modifiedOn: string | null
}

// Collapse a Pages deployment's stage pipeline into one status word that the
// shared status helpers understand.
function deploymentStatus(deployment: CfPagesDeployment | null | undefined): string {
  const stage = deployment?.latest_stage
  if (!stage) return "unknown"
  if (stage.status === "success") return stage.name === "deploy" ? "ready" : "building"
  if (stage.status === "failure") return "error"
  if (stage.status === "canceled") return "canceled"
  return "building"
}

export class CloudflareClient {
  private accountId: string | null

  constructor(private token: string, accountId: string | null) {
    this.accountId = accountId
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    })
    const json = (await res.json().catch(() => null)) as CfEnvelope<T> | null
    if (!res.ok || !json?.success) {
      const message = json?.errors?.map((e) => e.message).filter(Boolean).join("; ")
      throw new Error(`Cloudflare API error (${res.status})${message ? `: ${message}` : ""}`)
    }
    return json.result
  }

  private async account(): Promise<string> {
    if (this.accountId) return this.accountId
    const accounts = await this.get<Array<{ id: string }>>("/accounts")
    const first = accounts[0]
    if (!first) throw new Error("Cloudflare token has no visible accounts.")
    this.accountId = first.id
    return first.id
  }

  private dashUrl(accountId: string, project: string, deploymentId?: string): string {
    const base = `https://dash.cloudflare.com/${accountId}/pages/view/${project}`
    return deploymentId ? `${base}/${deploymentId}` : base
  }

  private mapDeployment(accountId: string, project: string, d: CfPagesDeployment): Deploy {
    return {
      id: d.id,
      provider: "cloudflare",
      siteId: project,
      siteName: project,
      status: deploymentStatus(d),
      createdAt: d.created_on ?? new Date().toISOString(),
      url: d.url ?? null,
      inspectorUrl: this.dashUrl(accountId, project, d.id),
      branch: d.deployment_trigger?.metadata?.branch ?? null,
      target: d.environment ?? null,
      creator: null,
      errorCode: null,
      errorMessage: d.deployment_trigger?.metadata?.commit_message ?? null,
      readyState: d.latest_stage?.status ?? null,
    }
  }

  // Pages projects + their latest deployments in one request, normalized.
  async fetchPages(): Promise<{ sites: Site[]; deploys: Deploy[] }> {
    const accountId = await this.account()
    const projects = await this.get<CfPagesProject[]>(`/accounts/${accountId}/pages/projects?per_page=100`)
    const sites = projects.map((project): Site => {
      const latest = project.latest_deployment
      const source = project.source?.config
      return {
        id: project.name,
        name: project.name,
        provider: PROVIDERS.cloudflare,
        status: deploymentStatus(latest),
        environment: "production",
        lastDeploy: latest?.modified_on ?? latest?.created_on ?? null,
        stack: project.source?.type ?? null,
        repo: source?.owner && source?.repo_name ? `${source.owner}/${source.repo_name}` : null,
        branch: project.production_branch ?? source?.production_branch ?? null,
        domains: project.domains?.length ? project.domains : project.subdomain ? [`${project.subdomain}.pages.dev`] : [],
        deploymentUrl: latest?.url ?? (project.subdomain ? `${project.subdomain}.pages.dev` : null),
        adminUrl: this.dashUrl(accountId, project.name),
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canDeploy: true,
      }
    })
    const deploys = projects
      .filter((project) => project.latest_deployment)
      .map((project) => this.mapDeployment(accountId, project.name, project.latest_deployment!))
    return { sites, deploys }
  }

  async listDeployments(project: string): Promise<Deploy[]> {
    const accountId = await this.account()
    const deployments = await this.get<CfPagesDeployment[]>(
      `/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}/deployments?per_page=20`,
    )
    return deployments.map((d) => this.mapDeployment(accountId, project, d))
  }

  async listZones(): Promise<CloudflareZone[]> {
    const zones = await this.get<Array<{ id: string; name: string; status?: string | null; paused?: boolean | null; plan?: { name?: string | null } | null }>>(
      "/zones?per_page=50",
    )
    return zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      status: zone.paused ? "paused" : zone.status ?? "unknown",
      paused: Boolean(zone.paused),
      plan: zone.plan?.name ?? null,
    }))
  }

  async listWorkers(): Promise<WorkerScript[]> {
    const accountId = await this.account()
    const scripts = await this.get<Array<{ id: string; modified_on?: string | null }>>(`/accounts/${accountId}/workers/scripts`)
    return scripts.map((script) => ({ id: script.id, modifiedOn: script.modified_on ?? null }))
  }

  async getAccountName(): Promise<string | null> {
    const accounts = await this.get<Array<{ id: string; name?: string | null }>>("/accounts")
    const wanted = this.accountId ? accounts.find((a) => a.id === this.accountId) : accounts[0]
    return wanted?.name ?? null
  }
}
