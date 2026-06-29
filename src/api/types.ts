export interface ApiList<T> {
  data: T[]
}

export interface ApiSingle<T> {
  data: T
}

export interface ProviderSite {
  id: string
  name: string
  provider: string
  status: string
}

export interface Deploy {
  id: string
  siteId: string
  status: string
  createdAt: string
}
