import { List } from "../List.tsx"
import { StatusBar } from "../StatusBar.tsx"
import { statusDot, statusColor } from "../../lib/theme.ts"
import type { Site } from "../../domain.ts"

const SITES: Site[] = [
  {
    id: "site-1",
    name: "Marketing site",
    provider: { id: "vercel", name: "Vercel" },
    status: "deployed",
    environment: "production",
    lastDeploy: "2026-06-29T09:30:00Z",
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canDeploy: true,
  },
  {
    id: "site-2",
    name: "Docs site",
    provider: { id: "cloudflare", name: "Cloudflare" },
    status: "deploying",
    environment: "preview",
    lastDeploy: null,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canDeploy: true,
  },
]

export function Sites({ rows }: { rows: number }) {
  const selectedIndex = 0

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <List
        items={SITES}
        selectedIndex={selectedIndex}
        viewportRows={Math.max(1, rows - 2)}
        keyFor={(item) => item.id}
        renderRow={(site, selected) => (
          <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
            <text content={`${statusDot(site.status)} ${site.name}`} fg={selected ? statusColor(site.status) : statusColor(site.status)} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
            <text content={site.provider.name} fg={selected ? statusColor(site.status) : statusColor(site.status)} />
          </box>
        )}
      />
      <StatusBar
        hints={[
          { key: "c", label: "create" },
          { key: "d", label: "deploy" },
          { key: "u", label: "update" },
          { key: "x", label: "delete" },
        ]}
        message="Provider-agnostic site list scaffold"
      />
    </box>
  )
}
