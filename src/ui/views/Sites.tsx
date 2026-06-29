import { useEffect, useMemo, useState } from "react"
import { List, moveSelection } from "../List.tsx"
import { StatusBar } from "../StatusBar.tsx"
import { statusColor, statusDot, theme } from "../../lib/theme.ts"
import type { Site } from "../../domain.ts"
import { loadConfig } from "../../config.ts"
import { VercelClient } from "../../providers/vercel.ts"

export function Sites({ rows }: { rows: number }) {
  const [sites, setSites] = useState<Site[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mode, setMode] = useState<"browse" | "actions">("browse")

  useEffect(() => {
    const cfg = loadConfig()
    if (!cfg.vercelToken) {
      setError("Set VERCEL_TOKEN in .env to load projects.")
      return
    }
    const client = new VercelClient(cfg.vercelToken, cfg.vercelTeamId)
    void client.listSites().then((items) => {
      setSites(items)
      setSelectedIndex((cur) => Math.min(cur, Math.max(0, items.length - 1)))
    }).catch((err) => setError((err as Error).message))
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (sites.length === 0) return
      if (mode === "browse") {
        if (event.key === "ArrowDown" || event.key === "j") setSelectedIndex((cur) => moveSelection(cur, 1, sites.length))
        if (event.key === "ArrowUp" || event.key === "k") setSelectedIndex((cur) => moveSelection(cur, -1, sites.length))
        if (event.key === "Tab" || event.key === "Enter" || event.key === ">") setMode("actions")
      } else {
        if (event.key === "Escape" || event.key === "<") setMode("browse")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [mode, sites.length])

  const selected = sites[selectedIndex]

  const details = useMemo(() => {
    if (!selected) return null
    return [
      ["Provider", selected.provider.name],
      ["Environment", selected.environment],
      ["Status", selected.status],
      ["Last deploy", selected.lastDeploy ?? "Never"],
      ["Can create", selected.canCreate ? "Yes" : "No"],
      ["Can deploy", selected.canDeploy ? "Yes" : "No"],
      ["Can update", selected.canUpdate ? "Yes" : "No"],
      ["Can delete", selected.canDelete ? "Yes" : "No"],
    ]
  }, [selected])

  return (
    <box style={{ flexGrow: 1, flexDirection: "row" }}>
      <box style={{ width: "42%", flexDirection: "column" }}>
        <List
          items={sites}
          selectedIndex={selectedIndex}
          viewportRows={Math.max(1, rows - 3)}
          keyFor={(item) => item.id}
          renderRow={(site, selectedRow) => (
            <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
              <text content={`${statusDot(site.status)} ${site.name}`} fg={statusColor(site.status)} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
              <text content={site.provider.name} fg={selectedRow ? theme.text : theme.textDim} />
            </box>
          )}
          emptyText={error ?? "No projects loaded yet."}
          focused={mode === "browse"}
        />
        <StatusBar
          hints={mode === "browse"
            ? [
                { key: "↑↓", label: "navigate" },
                { key: "⏎", label: "details" },
                { key: "Tab", label: "actions" },
              ]
            : [
                { key: "Esc", label: "back" },
                { key: "c", label: "create" },
                { key: "d", label: "deploy" },
                { key: "u", label: "update" },
                { key: "x", label: "delete" },
              ]}
          message={mode === "browse" ? "Dashboard" : "Actions"}
        />
      </box>
      <box style={{ width: "58%", flexDirection: "column", paddingLeft: 1 }}>
        <box style={{ height: 1, flexDirection: "row" }}>
          <text content={selected ? selected.name : "Site details"} fg={theme.text} />
        </box>
        <box style={{ flexGrow: 1, flexDirection: "column", backgroundColor: theme.bgAlt, paddingLeft: 1, paddingRight: 1 }}>
          {selected ? (
            <>
              {details?.map(([label, value]) => (
                <box key={label} style={{ flexDirection: "row", height: 1 }}>
                  <text content={`${label}: `} fg={theme.textDim} />
                  <text content={value} fg={theme.text} />
                </box>
              ))}
              <box style={{ height: 1 }} />
              <text content="Create, deploy, update, and delete actions will land here as provider adapters grow." fg={theme.textFaint} />
            </>
          ) : (
            <text content="Select a site to see details." fg={theme.textFaint} />
          )}
        </box>
      </box>
    </box>
  )
}
