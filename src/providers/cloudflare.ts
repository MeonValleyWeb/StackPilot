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
  latest_stage?: {
    name?: string | null
    status?: string | null
    started_on?: string | null
    ended_on?: string | null
  } | null
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
  type: string | null
  createdOn: string | null
  activatedOn: string | null
  modifiedOn: string | null
  developmentMode: number
  nameServers: string[]
  originalRegistrar: string | null
  originalDnsHost: string | null
}

export interface WorkerScript {
  id: string
  modifiedOn: string | null
  createdOn: string | null
  compatibilityDate: string | null
  handlers: string[]
  hasAssets: boolean
  hasModules: boolean
  lastDeployedFrom: string | null
  usageModel: string | null
  domains: string[]
}

export interface WorkerDeployment {
  id: string
  createdOn: string | null
  source: string | null
  strategy: string | null
  authorEmail: string | null
  message: string | null
  triggeredBy: string | null
  versions: Array<{ percentage: number; versionId: string }>
}

export interface CloudflareRegistration {
  name: string
  expiresAt: string | null
  autoRenew: boolean | null
  locked: boolean | null
  status: string | null
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

  private async getAllPages<T>(path: string, perPage: number): Promise<T[]> {
    const results: T[] = []

    for (let page = 1; ; page += 1) {
      const separator = path.includes("?") ? "&" : "?"
      const batch = await this.get<T[]>(`${path}${separator}page=${page}&per_page=${perPage}`)
      results.push(...batch)
      if (batch.length < perPage) return results
    }
  }

  private async account(): Promise<string> {
    if (this.accountId) return this.accountId
    const accounts = await this.get<Array<{ id: string }>>("/accounts")
    const first = accounts[0]
    if (!first) throw new Error("Cloudflare token has no visible accounts.")
    this.accountId = first.id
    return first.id
  }

  private dashUrl(accountId: string, project: string): string {
    return `https://dash.cloudflare.com/${accountId}/pages/view/${project}`
  }

  private mapDeployment(accountId: string, project: string, d: CfPagesDeployment): Deploy {
    const started = d.latest_stage?.started_on ? new Date(d.latest_stage.started_on).getTime() : null
    const ended = d.latest_stage?.ended_on ? new Date(d.latest_stage.ended_on).getTime() : null
    return {
      id: d.id,
      provider: "cloudflare",
      siteId: project,
      siteName: project,
      status: deploymentStatus(d),
      createdAt: d.created_on ?? new Date().toISOString(),
      url: d.url ?? null,
      // Cloudflare does not return a stable dashboard inspector URL. Falling
      // back to the API-provided deployment URL avoids brittle dashboard links.
      inspectorUrl: null,
      branch: d.deployment_trigger?.metadata?.branch ?? null,
      target: d.environment ?? null,
      creator: null,
      errorCode: null,
      errorMessage: d.deployment_trigger?.metadata?.commit_message ?? null,
      readyState: d.latest_stage?.status ?? null,
      commitHash: d.deployment_trigger?.metadata?.commit_hash ?? null,
      trigger: d.deployment_trigger?.type ?? null,
      durationMs: started !== null && ended !== null ? Math.max(0, ended - started) : null,
    }
  }

  // Pages projects + their latest deployments in one request, normalized.
  async fetchPages(): Promise<{ sites: Site[]; deploys: Deploy[] }> {
    const accountId = await this.account()
    // Cloudflare Pages currently caps project listings at 10 items per page.
    const projects = await this.getAllPages<CfPagesProject>(`/accounts/${accountId}/pages/projects`, 10)
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
    const zones = await this.get<Array<{
      id: string
      name: string
      status?: string | null
      paused?: boolean | null
      plan?: { name?: string | null } | null
      type?: string | null
      created_on?: string | null
      activated_on?: string | null
      modified_on?: string | null
      development_mode?: number | null
      name_servers?: string[] | null
      original_registrar?: string | null
      original_dnshost?: string | null
    }>>(
      "/zones?per_page=50",
    )
    return zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      status: zone.paused ? "paused" : zone.status ?? "unknown",
      paused: Boolean(zone.paused),
      plan: zone.plan?.name ?? null,
      type: zone.type ?? null,
      createdOn: zone.created_on ?? null,
      activatedOn: zone.activated_on ?? null,
      modifiedOn: zone.modified_on ?? null,
      developmentMode: zone.development_mode ?? 0,
      nameServers: zone.name_servers ?? [],
      originalRegistrar: zone.original_registrar ?? null,
      originalDnsHost: zone.original_dnshost ?? null,
    }))
  }

  async listWorkers(): Promise<WorkerScript[]> {
    const accountId = await this.account()
    const [scripts, domains] = await Promise.all([
      this.get<Array<{
        id: string
        modified_on?: string | null
        created_on?: string | null
        compatibility_date?: string | null
        handlers?: string[] | null
        has_assets?: boolean | null
        has_modules?: boolean | null
        last_deployed_from?: string | null
        usage_model?: string | null
      }>>(`/accounts/${accountId}/workers/scripts`),
      this.get<Array<{ hostname?: string | null; service?: string | null }>>(`/accounts/${accountId}/workers/domains`).catch(() => []),
    ])
    return scripts.map((script) => ({
      id: script.id,
      modifiedOn: script.modified_on ?? null,
      createdOn: script.created_on ?? null,
      compatibilityDate: script.compatibility_date ?? null,
      handlers: script.handlers ?? [],
      hasAssets: Boolean(script.has_assets),
      hasModules: Boolean(script.has_modules),
      lastDeployedFrom: script.last_deployed_from ?? null,
      usageModel: script.usage_model ?? null,
      domains: domains
        .filter((domain) => domain.service === script.id && domain.hostname)
        .map((domain) => domain.hostname!),
    }))
  }

  async listWorkerDeployments(script: string): Promise<WorkerDeployment[]> {
    const accountId = await this.account()
    const result = await this.get<{
      deployments?: Array<{
        id: string
        created_on?: string | null
        source?: string | null
        strategy?: string | null
        author_email?: string | null
        annotations?: { "workers/message"?: string | null; "workers/triggered_by"?: string | null } | null
        versions?: Array<{ percentage?: number | null; version_id?: string | null }> | null
      }>
    }>(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(script)}/deployments`)
    return (result.deployments ?? []).map((deployment) => ({
      id: deployment.id,
      createdOn: deployment.created_on ?? null,
      source: deployment.source ?? null,
      strategy: deployment.strategy ?? null,
      authorEmail: deployment.author_email ?? null,
      message: deployment.annotations?.["workers/message"] ?? null,
      triggeredBy: deployment.annotations?.["workers/triggered_by"] ?? null,
      versions: (deployment.versions ?? [])
        .filter((version) => version.version_id)
        .map((version) => ({ percentage: version.percentage ?? 0, versionId: version.version_id! })),
    }))
  }

  async listRegistrarDomains(): Promise<CloudflareRegistration[]> {
    const accountId = await this.account()
    const domains = await this.get<Array<{
      name?: string | null
      expires_at?: string | null
      auto_renew?: boolean | null
      locked?: boolean | null
      status?: string | null
    }>>(`/accounts/${accountId}/registrar/domains`)
    return domains
      .filter((domain) => domain.name)
      .map((domain) => ({
        name: domain.name!,
        expiresAt: domain.expires_at ?? null,
        autoRenew: domain.auto_renew ?? null,
        locked: domain.locked ?? null,
        status: domain.status ?? null,
      }))
  }

  async getAccountName(): Promise<string | null> {
    const accounts = await this.get<Array<{ id: string; name?: string | null }>>("/accounts")
    const wanted = this.accountId ? accounts.find((a) => a.id === this.accountId) : accounts[0]
    return wanted?.name ?? null
  }
}
