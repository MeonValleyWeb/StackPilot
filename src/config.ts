export interface AppConfig {
  vercelToken: string | null
  vercelTeamId: string | null
}

function env(name: string): string | null {
  const value = Bun.env[name]
  return value && value.trim() ? value.trim() : null
}

export function loadConfig(): AppConfig {
  return {
    vercelToken: env("VERCEL_TOKEN"),
    vercelTeamId: env("VERCEL_TEAM_ID"),
  }
}
