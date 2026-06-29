import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { StatusBar } from "../StatusBar.tsx"
import { statusColor, statusDot, theme } from "../../lib/theme.ts"
import type { Deploy, Site } from "../../domain.ts"
import { loadConfig } from "../../config.ts"
import { VercelClient } from "../../providers/vercel.ts"

type Panel = "sites" | "details" | "failed" | "recent" | "menu"

function since(iso: string | null): string {
  if (!iso) return "Never"
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function statColor(status: string): string {
  const s = status.toLowerCase()
  if (["ready", "completed", "deployed", "succeeded", "success"].includes(s)) return theme.good
  if (["error", "failed", "canceled", "cancelled"].includes(s)) return theme.bad
  if (["pending", "building", "queued", "loading", "created", "running", "deploying"].includes(s)) return theme.warn
  return theme.textDim
}

function Section({
  title,
  focused,
  children,
}: {
  title: string
  focused?: boolean
  children: ReactNode
}) {
  return (
    <box style={{ flexDirection: "column", borderColor: focused ? theme.brand : theme.border, paddingLeft: 1, paddingRight: 1 }}>
      <box style={{ height: 1, flexDirection: "row" }}>
        <text content={title} fg={focused ? theme.brand : theme.textDim} />
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>{children}</box>
    </box>
  )
}

export function Sites({ rows }: { rows: number }) {
  const [sites, setSites] = useState<Site[]>([])
  const [deploys, setDeploys] = useState<Deploy[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [panel, setPanel] = useState<Panel>("sites")

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
    if (key.name === "q") return

    if (panel === "sites") {
      if (key.name === "down" || key.name === "j") setSelectedIndex((cur) => moveSelection(cur, 1, sites.length))
      if (key.name === "up" || key.name === "k") setSelectedIndex((cur) => moveSelection(cur, -1, sites.length))
      if (key.name === "tab" || key.name === "enter" || key.name === ">") setPanel("details")
      return
    }

    if (key.name === "escape" || key.name === "<") {
      setPanel("sites")
      return
    }
    if (key.name === "tab") {
      const order: Panel[] = ["sites", "details", "failed", "recent", "menu"]
      setPanel(order[(order.indexOf(panel) + 1) % order.length])
      return
    }
    if (key.name === "left") {
      const order: Panel[] = ["sites", "details", "failed", "recent", "menu"]
      setPanel(order[(order.indexOf(panel) + order.length - 1) % order.length])
      return
    }
    if (key.name === "right") {
      const order: Panel[] = ["sites", "details", "failed", "recent", "menu"]
      setPanel(order[(order.indexOf(panel) + 1) % order.length])
    }
  })

  const selected = sites[selectedIndex]
  const recent = deploys.slice(0, 8)
  const failed = deploys.filter((d) => ["error", "failed", "canceled", "cancelled"].includes(d.status.toLowerCase())).slice(0, 8)
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
        <text content="1 Dashboard" fg={theme.brand} />
        <text content={`  ${sites.length} sites · ${deploys.length} deploys · ${failedCount} failed · ${deploying} deploying`} fg={theme.textDim} />
        <box style={{ flexGrow: 1 }} />
        <text content={error ? error : "updated just now"} fg={error ? theme.bad : theme.textFaint} wrapMode="none" />
      </box>

      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <box style={{ flexGrow: 1, flexDirection: "row" }}>
          <box style={{ width: "42%", flexDirection: "column", paddingRight: 1 }}>
            <Section title="Sites" focused={panel === "sites"}>
              <List
                items={sites}
                selectedIndex={selectedIndex}
                viewportRows={Math.max(1, rows - 16)}
                keyFor={(item) => item.id}
                renderRow={(site, selectedRow) => (
                  <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
                    <text content={`${statusDot(site.status)} ${site.name}`} fg={statusColor(site.status)} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                    <text content={site.provider.name} fg={selectedRow ? theme.text : theme.textDim} />
                  </box>
                )}
                emptyText={error ?? "No projects loaded yet."}
                focused={panel === "sites"}
              />
            </Section>
          </box>

          <box style={{ width: "58%", flexDirection: "column" }}>
            <Section title="Details" focused={panel === "details"}>
              {selected ? details?.map(([label, value]) => (
                <box key={label} style={{ flexDirection: "row", height: 1 }}>
                  <text content={`${label}: `} fg={theme.textDim} />
                  <text content={value} fg={theme.text} />
                </box>
              )) : <text content="Select a site to see details." fg={theme.textFaint} />}
            </Section>
          </box>
        </box>

        <box style={{ flexGrow: 1, flexDirection: "row" }}>
          <box style={{ width: "50%", flexDirection: "column", paddingRight: 1 }}>
            <Section title="Failed deploys" focused={panel === "failed"}>
              {failed.length ? failed.map((d) => (
                <box key={d.id} style={{ flexDirection: "row", height: 1 }}>
                  <text content={`${statusDot(d.status)} ${d.siteId}`} fg={theme.bad} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                  <text content={since(d.createdAt)} fg={theme.textFaint} />
                </box>
              )) : <text content="No failed deploys found." fg={theme.good} />}
            </Section>
          </box>

          <box style={{ width: "50%", flexDirection: "column" }}>
            <Section title="Recent deploys" focused={panel === "recent"}>
              {recent.length ? recent.map((d) => (
                <box key={d.id} style={{ flexDirection: "row", height: 1 }}>
                  <text content={`${statusDot(d.status)} ${d.siteId}${d.branch ? ` · ${d.branch}` : ""}`} fg={statColor(d.status)} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                  <text content={since(d.createdAt)} fg={theme.textFaint} />
                </box>
              )) : <text content="No recent deploys yet." fg={theme.textFaint} />}
            </Section>
          </box>
        </box>
      </box>

      <box style={{ height: 3, flexDirection: "column", marginTop: 1 }}>
        <Section title="Menu" focused={panel === "menu"}>
          <StatusBar
            hints={[
              { key: "↑↓", label: "sites" },
              { key: "Tab", label: "switch panel" },
              { key: "⏎", label: "open" },
              { key: "q", label: "quit" },
            ]}
            message={panel === "menu" ? "Menu focused" : "Tab through panels for details"}
            showGlobal={false}
          />
        </Section>
      </box>
    </box>
  )
}
