export interface Provider {
  id: string
  name: string
}

export interface Site {
  id: string
  name: string
  provider: Provider
  status: string
  environment: string
  lastDeploy: string | null
  stack?: string | null
  repo?: string | null
  domains?: string[]
  deploymentUrl?: string | null
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canDeploy: boolean
}

export interface Deploy {
  id: string
  siteId: string
  status: string
  createdAt: string
  url?: string | null
  branch?: string | null
  target?: string | null
  creator?: string | null
}
