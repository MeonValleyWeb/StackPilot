import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { StatusBar } from "../StatusBar.tsx"
import { statusColor, statusDot, theme } from "../../lib/theme.ts"
import type { Deploy, Site } from "../../domain.ts"
import { loadConfig } from "../../config.ts"
import { VercelClient } from "../../providers/vercel.ts"
import { openUrl } from "../../lib/open.ts"

type Panel = "sites" | "details" | "failed" | "recent" | "menu" | "site" | "deploy"
type Page = "dashboard" | "create"

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

function Section({ title, focused, children }: { title: string; focused?: boolean; children: ReactNode }) {
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

function openSiteUrl(site: Site | null) {
  const target = site?.deploymentUrl ?? site?.domains?.[0]
  if (target) openUrl(target.startsWith("http") ? target : `https://${target}`)
}

function openRepo(site: Site | null) {
  if (!site?.repo) return
  const repo = site.repo.replace(/^https?:\/\//, "").replace(/^git@/, "").replace(/\.git$/, "")
  openUrl(repo.startsWith("github.com/") ? `https://${repo}` : `https://github.com/${repo}`)
}

function openDeploymentPage(deploy: Deploy | null) {
  const url = deploy?.inspectorUrl ?? deploy?.url
  if (!url) return
  openUrl(url.startsWith("http") ? url : `https://${url}`)
}

export function Sites({ rows }: { rows: number }) {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [deploys, setDeploys] = useState<Deploy[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [panel, setPanel] = useState<Panel>("sites")
  const [page, setPage] = useState<Page>("dashboard")
  const [selectedDeployIndex, setSelectedDeployIndex] = useState(0)

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

  useEffect(() => {
    const cfg = loadConfig()
    const current = sites[selectedIndex]
    if (!cfg.vercelToken || !current) return
    const client = new VercelClient(cfg.vercelToken, cfg.vercelTeamId)
    void client.getSite(current.name).then(setSelectedSite).catch(() => setSelectedSite(current))
  }, [selectedIndex, sites])

  useKeyboard((key) => {
    if (key.name === "q") return
    if (page === "create") {
      if (key.name === "escape" || key.name === "<") setPage("dashboard")
      return
    }

    if (sites.length > 0 && (key.name === "down" || key.name === "j")) {
      setSelectedIndex((cur) => moveSelection(cur, 1, sites.length))
      return
    }
    if (sites.length > 0 && (key.name === "up" || key.name === "k")) {
      setSelectedIndex((cur) => moveSelection(cur, -1, sites.length))
      return
    }

    if (panel === "recent" || panel === "failed" || panel === "deploy") {
      if (key.name === "down" || key.name === "j") {
        setSelectedDeployIndex((cur) => moveSelection(cur, 1, siteDeployments.length))
        return
      }
      if (key.name === "up" || key.name === "k") {
        setSelectedDeployIndex((cur) => moveSelection(cur, -1, siteDeployments.length))
        return
      }
    }

    if (key.name === "tab") {
      const order: Panel[] = ["sites", "details", "failed", "recent", "deploy", "menu", "site"]
      setPanel(order[(order.indexOf(panel) + 1) % order.length])
      return
    }
    if (key.name === "escape" || key.name === "<") {
      setPanel("sites")
      return
    }
    if (key.name === "enter") {
      if (panel === "recent" || panel === "failed") {
        setPanel("deploy")
      } else {
        setPanel("site")
      }
      return
    }
    if (key.name === "o") return openSiteUrl(selected)
    if (key.name === "g") return openRepo(selected)
    if (key.name === "d") return openDeploymentPage(selectedDeploy)
    if (key.name === "c") return setPage("create")
  })

  const selected = selectedSite ?? sites[selectedIndex]
  const recent = deploys.slice(0, 8)
  const failed = deploys.filter((d) => ["error", "failed", "canceled", "cancelled"].includes(d.status.toLowerCase())).slice(0, 8)
  const deploying = deploys.filter((d) => ["pending", "building", "queued", "running", "deploying"].includes(d.status.toLowerCase())).length
  const failedCount = failed.length
  const topBar = [`${sites.length} sites`, `${deploys.length} deploys`, `${failedCount} failed`, `${deploying} deploying`].join(" · ")

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
    ]
  }, [selected])

  const siteDeployments = useMemo(() => (selected ? deploys.filter((d) => d.siteId === selected.id || d.siteId === selected.name) : []), [deploys, selected])
  const selectedDeploy = siteDeployments[selectedDeployIndex] ?? siteDeployments[0] ?? null

  useEffect(() => {
    setSelectedDeployIndex((cur) => Math.min(cur, Math.max(0, siteDeployments.length - 1)))
  }, [siteDeployments.length])

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <box style={{ flexDirection: "row", height: 1, paddingLeft: 1, paddingRight: 1 }}>
        <text content={page === "create" ? "2 Create site" : "1 Dashboard"} fg={theme.brand} />
        <text content={`  ${topBar}`} fg={theme.textDim} />
        <box style={{ flexGrow: 1 }} />
        <text content={error ? error : "updated just now"} fg={error ? theme.bad : theme.textFaint} wrapMode="none" />
      </box>

      {page === "create" ? (
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <Section title="Create site" focused>
            <text content="Create a new Vercel project by defining repo, name, and environment settings." fg={theme.text} />
            <text content="Press Esc to return." fg={theme.textFaint} />
            <text content="Next: fields for repo URL, project name, framework, production branch, and domains." fg={theme.textDim} />
          </Section>
        </box>
      ) : (
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
              <Section title={selected ? `Details · ${selected.name}` : "Details"} focused={panel === "details"}>
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
                ) : (
                  <text content="Select a site to see details." fg={theme.textFaint} />
                )}
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
                  <box key={d.id} style={{ flexDirection: "row", height: 1, backgroundColor: d.id === selectedDeploy?.id ? theme.bgAlt : undefined }}>
                    <text content={`${statusDot(d.status)} ${d.siteId}${d.branch ? ` · ${d.branch}` : ""}`} fg={statColor(d.status)} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                    <text content={since(d.createdAt)} fg={theme.textFaint} />
                  </box>
                )) : <text content="No recent deploys yet." fg={theme.textFaint} />}
              </Section>
            </box>
          </box>

          <box style={{ flexGrow: 1, flexDirection: "column" }}>
            <Section title={`Deployment${selectedDeploy ? ` · ${selectedDeploy.siteId}` : ""}`} focused={panel === "deploy"}>
              {selectedDeploy ? (
                <>
                  <box style={{ flexDirection: "row", height: 3 }}>
                    <MiniStat label="State" value={selectedDeploy.status} />
                    <MiniStat label="Ready" value={selectedDeploy.readyState ?? "unknown"} />
                    <MiniStat label="Age" value={since(selectedDeploy.createdAt)} />
                  </box>
                  <text content={`URL: ${selectedDeploy.url ?? "Unknown"}`} fg={theme.textDim} wrapMode="none" />
                  <text content={`Inspector: ${selectedDeploy.inspectorUrl ?? "Unknown"}`} fg={theme.textDim} wrapMode="none" />
                  <text content={selectedDeploy.errorCode ? `Error: ${selectedDeploy.errorCode}` : "No error code"} fg={selectedDeploy.errorCode ? theme.bad : theme.good} />
                  <text content={selectedDeploy.errorMessage ? selectedDeploy.errorMessage : "No error message"} fg={theme.textFaint} />
                  <text content={selectedDeploy.inspectorUrl ? "Press d to open inspector/build page" : "No inspector page available"} fg={theme.textFaint} />
                </>
              ) : (
                <text content="Choose a deployment from the recent list or failed list." fg={theme.textFaint} />
              )}
            </Section>
          </box>

          {panel === "site" && selected && (
            <box style={{ flexGrow: 1, flexDirection: "column" }}>
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
                <box style={{ flexDirection: "row", height: 1 }}>
                  <text content="Repo: " fg={theme.textDim} />
                  <text content={selected.repo ? "Press g to open repo" : "No repo available"} fg={theme.textFaint} />
                </box>
                <box style={{ flexDirection: "row", height: 1 }}>
                  <text content="Deploy: " fg={theme.textDim} />
                  <text content={selectedDeploy?.inspectorUrl ? "Press d to open deployment" : "No deployment page available"} fg={theme.textFaint} />
                </box>
                <text content="This page is the place to probe richer provider-specific API fields." fg={theme.textFaint} />
              </Section>
            </box>
          )}
        </box>
      )}

      <box style={{ height: 3, flexDirection: "column", marginTop: 1 }}>
        <Section title="Menu" focused={panel === "menu"}>
          <StatusBar
            hints={[
              { key: "↑↓", label: "sites" },
              { key: "Tab", label: "switch panel" },
              { key: "⏎", label: "open" },
              { key: "o", label: "open url" },
              { key: "g", label: "open repo" },
              { key: "d", label: "deploy page" },
              { key: "c", label: "create site" },
              { key: "q", label: "quit" },
            ]}
            message={page === "create" ? "Create site" : panel === "menu" ? "Menu focused" : "Tab through panels for details"}
            showGlobal={false}
          />
        </Section>
      </box>
    </box>
  )
}
