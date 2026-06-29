import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { StatusBar } from "../StatusBar.tsx"
import { statusColor, statusDot, theme } from "../../lib/theme.ts"
import type { Deploy, Site } from "../../domain.ts"
import { loadConfig } from "../../config.ts"
import { VercelClient } from "../../providers/vercel.ts"
import { openUrl } from "../../lib/open.ts"

type Panel = "sites" | "details" | "failed" | "recent" | "menu" | "site"

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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <box style={{ flexDirection: "column", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
      <text content={label} fg={theme.textDim} />
      <text content={value} fg={theme.text} />
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
      if (key.name === "tab" || key.name === ">") setPanel("details")
      if (key.name === "enter") setPanel("site")
      return
    }

    if (key.name === "escape" || key.name === "<") {
      if (panel === "site") {
        setPanel("sites")
        return
      }
      setPanel("sites")
      return
    }
    if (key.name === "tab") {
      const order: Panel[] = ["sites", "details", "failed", "recent", "menu", "site"]
      setPanel(order[(order.indexOf(panel) + 1) % order.length])
      return
    }
    if (key.name === "left") {
      const order: Panel[] = ["sites", "details", "failed", "recent", "menu", "site"]
      setPanel(order[(order.indexOf(panel) + order.length - 1) % order.length])
      return
    }
    if (key.name === "right") {
      const order: Panel[] = ["sites", "details", "failed", "recent", "menu", "site"]
      setPanel(order[(order.indexOf(panel) + 1) % order.length])
      return
    }
    if (key.name === "o") {
      const target = selected?.deploymentUrl ?? selected?.domains?.[0]
      if (target) openUrl(target.startsWith("http") ? target : `https://${target}`)
    }
  })

  const selected = sites[selectedIndex]
  const recent = deploys.slice(0, 8)
  const failed = deploys.filter((d) => ["error", "failed", "canceled", "cancelled"].includes(d.status.toLowerCase())).slice(0, 8)
  const deploying = deploys.filter((d) => ["pending", "building", "queued", "running", "deploying"].includes(d.status.toLowerCase())).length
  const failedCount = failed.length
  const topBar = [
    `${sites.length} sites`,
    `${deploys.length} deploys`,
    `${failedCount} failed`,
    `${deploying} deploying`,
  ].join(" · ")
  const usageSummary = "Usage summary unavailable from current token; probing dedicated endpoint later."

  const details = useMemo(() => {
    if (!selected) return null
    return [
      ["Provider", selected.provider.name],
      ["Repo", selected.repo ?? "Unknown"],
      ["Stack", selected.stack ?? "Unknown"],
      ["Environment", selected.environment],
      ["Status", selected.status],
      ["Last deploy", since(selected.lastDeploy)],
      ["Deployment URL", selected.deploymentUrl ?? selected.domains?.[0] ?? "Unknown"],
      ["Domains", selected.domains?.length ? selected.domains.join(", ") : "Unknown"],
      ["Can create", selected.canCreate ? "Yes" : "No"],
      ["Can deploy", selected.canDeploy ? "Yes" : "No"],
      ["Can update", selected.canUpdate ? "Yes" : "No"],
      ["Can delete", selected.canDelete ? "Yes" : "No"],
    ]
  }, [selected])

  const siteDeployments = useMemo(() => {
    if (!selected) return []
    return deploys.filter((d) => d.siteId === selected.id || d.siteId === selected.name)
  }, [deploys, selected])

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <box style={{ flexDirection: "row", height: 1, paddingLeft: 1, paddingRight: 1 }}>
        <text content="1 Dashboard" fg={theme.brand} />
        <text content={`  ${topBar}`} fg={theme.textDim} />
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
              {selected ? (
                <>
                  <box style={{ flexDirection: "row", height: 3 }}>
                    <MiniStat label="Repo" value={selected.repo ?? "Unknown"} />
                    <MiniStat label="Stack" value={selected.stack ?? "Unknown"} />
                    <MiniStat label="Deploy" value={since(selected.lastDeploy)} />
                  </box>
                  {details?.map(([label, value]) => (
                    <box key={label} style={{ flexDirection: "row", height: 1 }}>
                      <text content={`${label}: `} fg={theme.textDim} />
                      <text content={value} fg={theme.text} />
                    </box>
                  ))}
                </>
              ) : <text content="Select a site to see details." fg={theme.textFaint} />}
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

        {panel === "site" && selected && (
          <box style={{ flexGrow: 1, flexDirection: "column", marginTop: 1 }}>
            <Section title="Site API View" focused>
              <box style={{ flexDirection: "row", height: 4 }}>
                <MiniStat label="URL" value={selected.deploymentUrl ?? selected.domains?.[0] ?? "Unknown"} />
                <MiniStat label="Deploys" value={`${siteDeployments.length}`} />
                <MiniStat label="Domains" value={`${selected.domains?.length ?? 0}`} />
              </box>
              <box style={{ flexDirection: "row", height: 1 }}>
                <text content="Domains: " fg={theme.textDim} />
                <text content={selected.domains?.join(", ") ?? "Unknown"} fg={theme.text} wrapMode="none" />
              </box>
              <box style={{ flexDirection: "row", height: 1 }}>
                <text content="Repo: " fg={theme.textDim} />
                <text content={selected.repo ?? "Unknown"} fg={theme.text} />
              </box>
              <box style={{ flexDirection: "row", height: 1 }}>
                <text content="Stack: " fg={theme.textDim} />
                <text content={selected.stack ?? "Unknown"} fg={theme.text} />
              </box>
              <box style={{ flexDirection: "row", height: 1 }}>
                <text content="Open: " fg={theme.textDim} />
                <text content={selected.deploymentUrl || selected.domains?.[0] ? "Press o to open in browser" : "No URL available"} fg={theme.textFaint} />
              </box>
              <text content={usageSummary} fg={theme.textFaint} />
              <text content="This page is the place to probe richer provider-specific API fields." fg={theme.textFaint} />
            </Section>
          </box>
        )}
      </box>

      <box style={{ height: 3, flexDirection: "column", marginTop: 1 }}>
        <Section title="Menu" focused={panel === "menu"}>
          <StatusBar
            hints={[
              { key: "↑↓", label: "sites" },
              { key: "Tab", label: "switch panel" },
              { key: "⏎", label: "open" },
              { key: "o", label: "open url" },
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
