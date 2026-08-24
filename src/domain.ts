export type ProviderId = "vercel" | "netlify" | "cloudflare"

export interface Provider {
  id: ProviderId
  name: string
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  vercel: { id: "vercel", name: "Vercel" },
  netlify: { id: "netlify", name: "Netlify" },
  cloudflare: { id: "cloudflare", name: "Cloudflare" },
}

// A deployable site/project, normalized across providers. `status` carries the
// state of the latest (or published) deploy in the provider's own vocabulary;
// theme.statusColor/statusDot know how to interpret all of them.
export interface Site {
  id: string
  name: string
  provider: Provider
  status: string
  environment: string
  lastDeploy: string | null
  stack?: string | null
  repo?: string | null
  branch?: string | null
  domains?: string[]
  deploymentUrl?: string | null
  // Provider dashboard page for this site, when constructible.
  adminUrl?: string | null
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canDeploy: boolean
}

export interface Deploy {
  id: string
  provider: ProviderId
  siteId: string
  // Human-readable site/project name for display (siteId is an opaque uuid on
  // some providers).
  siteName: string
  status: string
  createdAt: string
  url?: string | null
  inspectorUrl?: string | null
  branch?: string | null
  target?: string | null
  creator?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  readyState?: string | null
  commitHash?: string | null
  trigger?: string | null
  durationMs?: number | null
}

const FAILED_STATES = ["error", "failed", "failure", "errored", "canceled", "cancelled", "crashed"]
const ACTIVE_STATES = ["pending", "building", "queued", "running", "deploying", "enqueued", "processing", "uploading", "new", "preparing", "initializing"]

export function isFailedStatus(status: string): boolean {
  return FAILED_STATES.includes(status.toLowerCase())
}

export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATES.includes(status.toLowerCase())
}
