// Shared provider data. Loads Vercel, Netlify, and Cloudflare in parallel at
// startup so the dashboard can correlate across providers and each provider
// page renders instantly. `refresh()` re-runs everything (bound to `r`).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { PROVIDERS, type Deploy, type ProviderId, type Site } from "../domain.ts"
import { loadConfig } from "../config.ts"
import { VercelClient } from "../providers/vercel.ts"
import { NetlifyClient } from "../providers/netlify.ts"
import { CloudflareClient, type CloudflareZone, type WorkerScript } from "../providers/cloudflare.ts"

export interface ProviderState {
  id: ProviderId
  name: string
  // False when the relevant token is missing from .env.
  configured: boolean
  loading: boolean
  error: string | null
  sites: Site[]
  // Recent deploys: account-wide for Vercel; latest-per-site for Netlify and
  // Cloudflare (their APIs have no account-wide deploys listing).
  deploys: Deploy[]
  plan: string | null
  account: string | null
}

interface DataValue {
  vercel: ProviderState
  netlify: ProviderState
  cloudflare: ProviderState
  zones: CloudflareZone[]
  workers: WorkerScript[]
  lastUpdated: string | null
  refresh: () => void
  providers: ProviderState[]
  allSites: Site[]
  allDeploys: Deploy[]
}

function emptyState(id: ProviderId): ProviderState {
  return {
    id,
    name: PROVIDERS[id].name,
    configured: false,
    loading: false,
    error: null,
    sites: [],
    deploys: [],
    plan: null,
    account: null,
  }
}

const DataContext = createContext<DataValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [vercel, setVercel] = useState(() => emptyState("vercel"))
  const [netlify, setNetlify] = useState(() => emptyState("netlify"))
  const [cloudflare, setCloudflare] = useState(() => emptyState("cloudflare"))
  const [zones, setZones] = useState<CloudflareZone[]>([])
  const [workers, setWorkers] = useState<WorkerScript[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const refresh = useCallback(() => {
    const cfg = loadConfig()

    if (!cfg.vercelToken) {
      setVercel((s) => ({ ...s, configured: false, loading: false }))
    } else {
      setVercel((s) => ({ ...s, configured: true, loading: true, error: null }))
      const client = new VercelClient(cfg.vercelToken, cfg.vercelTeamId)
      void Promise.all([client.listSites(), client.listDeployments(), client.getAccount().catch(() => null)])
        .then(([sites, deploys, account]) => {
          setVercel((s) => ({ ...s, loading: false, sites, deploys, plan: account?.plan ?? null, account: account?.name ?? null }))
          setLastUpdated(new Date().toISOString())
        })
        .catch((err) => setVercel((s) => ({ ...s, loading: false, error: (err as Error).message })))
    }

    if (!cfg.netlifyToken) {
      setNetlify((s) => ({ ...s, configured: false, loading: false }))
    } else {
      setNetlify((s) => ({ ...s, configured: true, loading: true, error: null }))
      const client = new NetlifyClient(cfg.netlifyToken)
      void Promise.all([client.fetchSites(), client.getAccount().catch(() => null)])
        .then(([{ sites, deploys }, account]) => {
          setNetlify((s) => ({ ...s, loading: false, sites, deploys, plan: account?.plan ?? null, account: account?.name ?? null }))
          setLastUpdated(new Date().toISOString())
        })
        .catch((err) => setNetlify((s) => ({ ...s, loading: false, error: (err as Error).message })))
    }

    if (!cfg.cloudflareToken) {
      setCloudflare((s) => ({ ...s, configured: false, loading: false }))
    } else {
      setCloudflare((s) => ({ ...s, configured: true, loading: true, error: null }))
      const client = new CloudflareClient(cfg.cloudflareToken, cfg.cloudflareAccountId)
      void Promise.all([
        client.fetchPages(),
        client.listZones().catch(() => [] as CloudflareZone[]),
        client.listWorkers().catch(() => [] as WorkerScript[]),
        client.getAccountName().catch(() => null),
      ])
        .then(([{ sites, deploys }, zoneList, workerList, account]) => {
          setCloudflare((s) => ({ ...s, loading: false, sites, deploys, account }))
          setZones(zoneList)
          setWorkers(workerList)
          setLastUpdated(new Date().toISOString())
        })
        .catch((err) => setCloudflare((s) => ({ ...s, loading: false, error: (err as Error).message })))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo<DataValue>(() => {
    const providers = [vercel, netlify, cloudflare]
    const allSites = providers.flatMap((p) => p.sites)
    const allDeploys = providers
      .flatMap((p) => p.deploys)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return { vercel, netlify, cloudflare, zones, workers, lastUpdated, refresh, providers, allSites, allDeploys }
  }, [vercel, netlify, cloudflare, zones, workers, lastUpdated, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataValue {
  const data = useContext(DataContext)
  if (!data) throw new Error("DataProvider missing")
  return data
}
