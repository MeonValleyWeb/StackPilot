export interface AppConfig {
  vercelToken: string | null
  vercelTeamId: string | null
  netlifyToken: string | null
  cloudflareToken: string | null
  cloudflareAccountId: string | null
}

function env(name: string): string | null {
  const value = Bun.env[name]
  return value && value.trim() ? value.trim() : null
}

export function loadConfig(): AppConfig {
  return {
    vercelToken: env("VERCEL_TOKEN"),
    vercelTeamId: env("VERCEL_TEAM_ID"),
    netlifyToken: env("NETLIFY_API_KEY") ?? env("NETLIFY_TOKEN"),
    cloudflareToken: env("CLOUDFLARE_API_TOKEN"),
    cloudflareAccountId: env("CLOUDFLARE_ACCOUNT_ID"),
  }
}
