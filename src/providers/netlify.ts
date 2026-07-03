// Netlify REST API client (https://docs.netlify.com/api/get-started/).
// Auth is a personal access token passed as a Bearer header; the .env key is
// NETLIFY_API_KEY. Netlify has no account-wide deploys endpoint, so the
// snapshot derives one "latest deploy" per site from published_deploy and the
// Netlify view fetches full per-site deploy history on demand.

import { PROVIDERS, type Deploy, type Site } from "../domain.ts"

interface NetlifySite {
  id: string
  name: string
  url?: string | null
  ssl_url?: string | null
  admin_url?: string | null
  custom_domain?: string | null
  domain_aliases?: string[] | null
  created_at?: string | null
  updated_at?: string | null
  build_settings?: {
    repo_url?: string | null
    repo_branch?: string | null
    provider?: string | null
  } | null
  published_deploy?: {
    id?: string | null
    state?: string | null
    branch?: string | null
    framework?: string | null
    created_at?: string | null
    published_at?: string | null
    error_message?: string | null
  } | null
}

interface NetlifyDeploy {
  id: string
  site_id: string
  state: string
  name?: string | null
  branch?: string | null
  context?: string | null
  title?: string | null
  committer?: string | null
  created_at?: string | null
  published_at?: string | null
  deploy_time?: number | null
  error_message?: string | null
  deploy_ssl_url?: string | null
  ssl_url?: string | null
  admin_url?: string | null
}

export interface NetlifyAccount {
  name: string | null
  plan: string | null
}

function siteUrl(site: NetlifySite): string | null {
  return site.ssl_url ?? site.url ?? null
}

function mapSite(site: NetlifySite): Site {
  const published = site.published_deploy
  return {
    id: site.id,
    name: site.name,
    provider: PROVIDERS.netlify,
    status: published?.state ?? "unpublished",
    environment: "production",
    lastDeploy: published?.published_at ?? published?.created_at ?? null,
    stack: published?.framework ?? null,
    repo: site.build_settings?.repo_url ?? null,
    branch: site.build_settings?.repo_branch ?? null,
    domains: [site.custom_domain, ...(site.domain_aliases ?? [])].filter((d): d is string => Boolean(d)),
    deploymentUrl: siteUrl(site),
    adminUrl: site.admin_url ?? null,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canDeploy: true,
  }
}

export class NetlifyClient {
  constructor(private token: string) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const detail = body ? `: ${body.slice(0, 200)}` : ""
      throw new Error(`Netlify API error (${res.status} ${res.statusText})${detail}`)
    }
    return (await res.json()) as T
  }

  // One request returns both the normalized sites and a synthetic "latest
  // deploy per site" list the dashboard can merge with other providers.
  async fetchSites(): Promise<{ sites: Site[]; deploys: Deploy[] }> {
    const raw = await this.get<NetlifySite[]>("/sites?per_page=100")
    const sites = raw.map(mapSite)
    const deploys = raw
      .filter((site) => site.published_deploy)
      .map((site) => {
        const d = site.published_deploy!
        return {
          id: d.id ?? `${site.id}-published`,
          provider: "netlify" as const,
          siteId: site.id,
          siteName: site.name,
          status: d.state ?? "unknown",
          createdAt: d.published_at ?? d.created_at ?? new Date().toISOString(),
          url: siteUrl(site),
          inspectorUrl: site.admin_url && d.id ? `${site.admin_url}/deploys/${d.id}` : site.admin_url ?? null,
          branch: d.branch ?? null,
          target: "production",
          creator: null,
          errorCode: null,
          errorMessage: d.error_message ?? null,
          readyState: d.state ?? null,
        }
      })
    return { sites, deploys }
  }

  async listDeploys(siteId: string, siteName: string): Promise<Deploy[]> {
    const raw = await this.get<NetlifyDeploy[]>(`/sites/${encodeURIComponent(siteId)}/deploys?per_page=20`)
    return raw.map((d) => ({
      id: d.id,
      provider: "netlify" as const,
      siteId: d.site_id,
      siteName,
      status: d.state,
      createdAt: d.created_at ?? new Date().toISOString(),
      url: d.deploy_ssl_url ?? d.ssl_url ?? null,
      inspectorUrl: d.admin_url ? `${d.admin_url}/deploys/${d.id}` : null,
      branch: d.branch ?? null,
      target: d.context ?? null,
      creator: d.committer ?? null,
      errorCode: null,
      errorMessage: d.error_message ?? null,
      readyState: d.state,
    }))
  }

  async getAccount(): Promise<NetlifyAccount> {
    const accounts = await this.get<Array<{ name?: string | null; type_name?: string | null }>>("/accounts")
    const first = accounts[0]
    return { name: first?.name ?? null, plan: first?.type_name ?? null }
  }
}
