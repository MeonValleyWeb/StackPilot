import { List } from "../List.tsx"
import { StatusBar } from "../StatusBar.tsx"
import { statusDot, statusColor } from "../../lib/theme.ts"
import type { Site } from "../../domain.ts"
import { loadConfig } from "../../config.ts"
import { VercelClient } from "../../providers/vercel.ts"
import { useEffect, useState } from "react"

export function Sites({ rows }: { rows: number }) {
  const [sites, setSites] = useState<Site[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cfg = loadConfig()
    if (!cfg.vercelToken) {
      setError("Set VERCEL_TOKEN in .env to load projects.")
      return
    }
    const client = new VercelClient(cfg.vercelToken, cfg.vercelTeamId)
    void client.listSites().then(setSites).catch((err) => setError((err as Error).message))
  }, [])

  const selectedIndex = 0

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <List
        items={sites}
        selectedIndex={selectedIndex}
        viewportRows={Math.max(1, rows - 2)}
        keyFor={(item) => item.id}
        renderRow={(site, selected) => (
          <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
            <text content={`${statusDot(site.status)} ${site.name}`} fg={selected ? statusColor(site.status) : statusColor(site.status)} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
            <text content={site.provider.name} fg={selected ? statusColor(site.status) : statusColor(site.status)} />
          </box>
        )}
        emptyText={error ?? "No projects loaded yet."}
      />
      <StatusBar
        hints={[
          { key: "c", label: "create" },
          { key: "d", label: "deploy" },
          { key: "u", label: "update" },
          { key: "x", label: "delete" },
        ]}
        message="Vercel-backed site list scaffold"
      />
    </box>
  )
}
