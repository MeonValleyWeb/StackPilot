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
}
