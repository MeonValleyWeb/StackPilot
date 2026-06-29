import { useEffect, useMemo, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { StatusBar } from "../StatusBar.tsx"
import { statusColor, statusDot, theme } from "../../lib/theme.ts"
import type { Deploy, Site } from "../../domain.ts"
import { loadConfig } from "../../config.ts"
import { VercelClient } from "../../providers/vercel.ts"

function since(iso: string | null): string {
  if (!iso) return "Never"
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function statColor(status: string): string {
  if (["ready", "completed", "ready", "deployed", "succeeded", "success"].includes(status.toLowerCase())) return theme.good
  if (["error", "failed", "canceled", "cancelled"].includes(status.toLowerCase())) return theme.bad
  if (["pending", "building", "queued", "loading", "created", "running", "deploying"].includes(status.toLowerCase())) return theme.warn
  return theme.textDim
}

export function Sites({ rows }: { rows: number }) {
  const [sites, setSites] = useState<Site[]>([])
  const [deploys, setDeploys] = useState<Deploy[]>([])
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
    void Promise.all([client.listSites(), client.listDeployments()])
      .then(([items, recentDeploys]) => {
        setSites(items)
        setDeploys(recentDeploys)
        setSelectedIndex((cur) => Math.min(cur, Math.max(0, items.length - 1)))
      })
      .catch((err) => setError((err as Error).message))
  }, [])

  useKeyboard((key) => {
    if (sites.length === 0) return
    if (mode === "browse") {
      if (key.name === "down" || key.name === "j") setSelectedIndex((cur) => moveSelection(cur, 1, sites.length))
      if (key.name === "up" || key.name === "k") setSelectedIndex((cur) => moveSelection(cur, -1, sites.length))
      if (key.name === "tab" || key.name === "enter" || key.name === ">") setMode("actions")
    } else {
      if (key.name === "escape" || key.name === "<") setMode("browse")
    }
  })

  const selected = sites[selectedIndex]
  const recent = deploys.slice(0, 12)
  const failed = deploys.filter((d) => ["error", "failed", "canceled", "cancelled"].includes(d.status.toLowerCase())).slice(0, 12)
  const deploying = deploys.filter((d) => ["pending", "building", "queued", "running", "deploying"].includes(d.status.toLowerCase())).length
  const failedCount = failed.length

  const details = useMemo(() => {
    if (!selected) return null
    return [
      ["Provider", selected.provider.name],
      ["Environment", selected.environment],
      ["Status", selected.status],
      ["Last deploy", since(selected.lastDeploy)],
      ["Can create", selected.canCreate ? "Yes" : "No"],
      ["Can deploy", selected.canDeploy ? "Yes" : "No"],
      ["Can update", selected.canUpdate ? "Yes" : "No"],
      ["Can delete", selected.canDelete ? "Yes" : "No"],
    ]
  }, [selected])

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <box style={{ flexDirection: "row", height: 1, paddingLeft: 1, paddingRight: 1 }}>
        <text content={sites.length ? `1 Dashboard` : `Dashboard`} fg={theme.brand} />
        <text content={`  ${sites.length} sites · ${deploys.length} deploys · ${failedCount} failed · ${deploying} deploying`} fg={theme.textDim} />
        <box style={{ flexGrow: 1 }} />
        <text content={error ? error : "updated just now"} fg={error ? theme.bad : theme.textFaint} wrapMode="none" />
      </box>

      <box style={{ flexDirection: "row", height: 5 }}>
        <box style={{ flexGrow: 1, marginRight: 1, paddingLeft: 1 }}>
          <text content="Sites" fg={theme.textDim} />
          <text content={`${sites.length}`} fg={theme.brand} />
          <text content={`${sites.filter((s) => s.status !== "ready").length} need attention`} fg={theme.textDim} />
        </box>
        <box style={{ flexGrow: 1, marginRight: 1, paddingLeft: 1 }}>
          <text content="Recent deploys" fg={theme.textDim} />
          <text content={`${recent.length}`} fg={theme.accent} />
          <text content={`${deploying} active`} fg={theme.textDim} />
        </box>
        <box style={{ flexGrow: 1, paddingLeft: 1 }}>
          <text content="Failed deploys" fg={theme.textDim} />
          <text content={`${failedCount}`} fg={theme.bad} />
          <text content={`${deploys.length ? Math.round((failedCount / deploys.length) * 100) : 0}% of recent`} fg={theme.textDim} />
        </box>
      </box>

      <box style={{ flexGrow: 1, flexDirection: "row" }}>
        <box style={{ width: "42%", flexDirection: "column", paddingRight: 1 }}>
          <box style={{ height: 1, flexDirection: "row" }}>
            <text content="Sites" fg={theme.text} />
          </box>
          <List
            items={sites}
            selectedIndex={selectedIndex}
            viewportRows={Math.max(1, rows - 12)}
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
                  { key: "⏎", label: "actions" },
                  { key: "Tab", label: "switch" },
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

        <box style={{ width: "58%", flexDirection: "column" }}>
          <box style={{ height: 1, flexDirection: "row" }}>
            <text content={selected ? selected.name : "Overview"} fg={theme.text} />
          </box>
          <box style={{ flexGrow: 1, flexDirection: "column" }}>
            <box style={{ height: 7, flexDirection: "row" }}>
              <box style={{ flexGrow: 1, marginRight: 1, paddingLeft: 1 }}>
                <text content="Selected site" fg={theme.textDim} />
                {selected ? (
                  <>
                    <text content={selected.name} fg={theme.text} />
                    <text content={`${selected.provider.name} · ${selected.environment}`} fg={theme.textDim} />
                    <text content={`${statusDot(selected.status)} ${selected.status}`} fg={statusColor(selected.status)} />
                  </>
                ) : (
                  <text content="No site selected" fg={theme.textFaint} />
                )}
              </box>
              <box style={{ flexGrow: 1, paddingLeft: 1 }}>
                <text content="Recent deploys" fg={theme.textDim} />
                {recent.slice(0, 3).map((d) => (
                  <text key={d.id} content={`${statusDot(d.status)} ${d.siteId}${d.branch ? ` · ${d.branch}` : ""}`} fg={statColor(d.status)} wrapMode="none" />
                ))}
              </box>
            </box>

            <box style={{ flexGrow: 1, flexDirection: "row" }}>
              <box style={{ flexGrow: 1, marginRight: 1, paddingLeft: 1 }}>
                <text content="Details" fg={theme.textDim} />
                {selected ? details?.map(([label, value]) => (
                  <box key={label} style={{ flexDirection: "row", height: 1 }}>
                    <text content={`${label}: `} fg={theme.textDim} />
                    <text content={value} fg={theme.text} />
                  </box>
                )) : <text content="Select a site to see details." fg={theme.textFaint} />}
              </box>
              <box style={{ flexGrow: 1, paddingLeft: 1 }}>
                <text content="Failed deploys" fg={theme.textDim} />
                {failed.length ? failed.slice(0, 8).map((d) => (
                  <box key={d.id} style={{ flexDirection: "row", height: 1 }}>
                    <text content={`${statusDot(d.status)} ${d.siteId}`} fg={theme.bad} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                    <text content={since(d.createdAt)} fg={theme.textFaint} />
                  </box>
                )) : <text content="No failed deploys found." fg={theme.good} />}
              </box>
            </box>
          </box>
        </box>
      </box>
    </box>
  )
}
