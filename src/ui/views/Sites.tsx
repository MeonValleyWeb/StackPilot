import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { StatusBar } from "../StatusBar.tsx"
import { statusColor, statusDot, theme } from "../../lib/theme.ts"
import type { Deploy, Site } from "../../domain.ts"
import { loadConfig } from "../../config.ts"
import { VercelClient } from "../../providers/vercel.ts"
import { openUrl } from "../../lib/open.ts"

type Panel = "sites" | "details" | "failed" | "recent" | "deploy" | "footer"

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
  const [billingPlan, setBillingPlan] = useState<string | null>(null)
  const [billingStatus, setBillingStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedDeployIndex, setSelectedDeployIndex] = useState(0)
  const [panel, setPanel] = useState<Panel>("sites")

  useEffect(() => {
    const cfg = loadConfig()
    if (!cfg.vercelToken) {
      setError("Set VERCEL_TOKEN in .env to load projects.")
      return
    }
    const client = new VercelClient(cfg.vercelToken, cfg.vercelTeamId)
    void Promise.all([
      client.listSites(),
      client.listDeployments(),
      fetch("https://api.vercel.com/v2/user", { headers: { Authorization: `Bearer ${cfg.vercelToken}`, Accept: "application/json" } }),
    ])
      .then(async ([items, recentDeploys, userRes]) => {
        const userJson = (await userRes.json()) as { user?: { billing?: { plan?: string | null; status?: string | null } } }
        setSites(items)
        setDeploys(recentDeploys)
        setBillingPlan(userJson.user?.billing?.plan ?? null)
        setBillingStatus(userJson.user?.billing?.status ?? null)
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

  const selected = selectedSite ?? sites[selectedIndex]
  const siteDeployments = useMemo(() => (selected ? deploys.filter((d) => d.siteId === selected.id || d.siteId === selected.name) : []), [deploys, selected])
  const selectedDeploy = siteDeployments[selectedDeployIndex] ?? siteDeployments[0] ?? null

  useEffect(() => {
    setSelectedDeployIndex((cur) => Math.min(cur, Math.max(0, siteDeployments.length - 1)))
  }, [siteDeployments.length])

  useKeyboard((key) => {
    if (key.name === "q") return
    if (key.name === "tab") {
      const order: Panel[] = ["sites", "details", "failed", "recent", "deploy", "footer"]
      setPanel(order[(order.indexOf(panel) + 1) % order.length])
      return
    }
    if (key.name === "escape") {
      setPanel("sites")
      return
    }
    if (key.name === "down" || key.name === "j") {
      if (panel === "failed" || panel === "recent" || panel === "deploy") setSelectedDeployIndex((cur) => moveSelection(cur, 1, siteDeployments.length))
      else setSelectedIndex((cur) => moveSelection(cur, 1, sites.length))
      return
    }
    if (key.name === "up" || key.name === "k") {
      if (panel === "failed" || panel === "recent" || panel === "deploy") setSelectedDeployIndex((cur) => moveSelection(cur, -1, siteDeployments.length))
      else setSelectedIndex((cur) => moveSelection(cur, -1, sites.length))
      return
    }
    if (key.name === "enter") {
      if (panel === "failed" || panel === "recent") setPanel("deploy")
      return
    }
    if (key.name === "o") return openSiteUrl(selected)
    if (key.name === "g") return openRepo(selected)
    if (key.name === "d") return openDeploymentPage(selectedDeploy)
  })

  const recent = deploys.slice(0, 8)
  const failed = deploys.filter((d) => ["error", "failed", "canceled", "cancelled"].includes(d.status.toLowerCase())).slice(0, 8)
  const deploying = deploys.filter((d) => ["pending", "building", "queued", "running", "deploying"].includes(d.status.toLowerCase())).length
  const failedCount = failed.length

  const billingBar = billingPlan ? `${billingPlan} · ${billingStatus ?? "unknown"}` : "billing unavailable"

  const topStats = [
    ["Sites", `${sites.length}`],
    ["Deploys", `${deploys.length}`],
    ["Failed", `${failedCount}`],
    ["Deploying", `${deploying}`],
    ["Billing", billingBar],
  ]

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <box style={{ flexDirection: "row", height: 1, paddingLeft: 1, paddingRight: 1 }}>
        <text content="1 Dashboard" fg={theme.brand} />
        <text content={`  ${sites.length} sites · ${deploys.length} deploys · ${failedCount} failed · ${deploying} deploying`} fg={theme.textDim} />
        <box style={{ flexGrow: 1 }} />
        <text content={error ? error : "updated just now"} fg={error ? theme.bad : theme.textFaint} wrapMode="none" />
      </box>

      <box style={{ flexDirection: "row", height: 1, paddingLeft: 1, paddingRight: 1 }}>
        <text content={`Billing: ${billingBar}`} fg={theme.textDim} />
        <box style={{ flexGrow: 1 }} />
        <text content="Detailed spend metrics not exposed by the current token" fg={theme.textFaint} />
      </box>

      <box style={{ flexDirection: "row", height: 5 }}>
        {topStats.map(([label, value], idx) => (
          <box key={label} style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1, backgroundColor: idx % 2 ? theme.bgAlt : undefined }}>
            <text content={label} fg={theme.textDim} />
            <text content={value} fg={label === "Failed" ? theme.bad : label === "Billing" ? theme.accent : theme.text} />
          </box>
        ))}
      </box>

      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <box style={{ flexGrow: 1, flexDirection: "row" }}>
          <box style={{ width: "34%", flexDirection: "column" }}>
            <Section title="Sites" focused={panel === "sites"}>
              <List
                items={sites}
                selectedIndex={selectedIndex}
                viewportRows={Math.max(1, rows - 14)}
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

          <box style={{ width: "33%", flexDirection: "column" }}>
            <Section title={selected ? `Details · ${selected.name}` : "Details"} focused={panel === "details"}>
              {selected ? (
                <>
                  <box style={{ flexDirection: "row", height: 2 }}>
                    <MiniStat label="Repo" value={selected.repo ?? "Unknown"} />
                    <MiniStat label="Stack" value={selected.stack ?? "Unknown"} />
                    <MiniStat label="Deploy" value={selected.lastDeploy ? since(selected.lastDeploy) : "Never"} />
                  </box>
                  <text content={`URL: ${selected.deploymentUrl ?? selected.domains?.[0] ?? "Unknown"}`} fg={theme.textDim} wrapMode="none" />
                  <text content={`Domains: ${selected.domains?.length ? selected.domains.join(", ") : "Unknown"}`} fg={theme.textDim} wrapMode="none" />
                  <text content={`Press o to open`} fg={theme.textFaint} />
                  <text content={`Press g to open repo`} fg={theme.textFaint} />
                </>
              ) : (
                <text content="Select a site to see details." fg={theme.textFaint} />
              )}
            </Section>
          </box>

          <box style={{ width: "33%", flexDirection: "column" }}>
            <Section title={`Deployment${selectedDeploy ? ` · ${selectedDeploy.siteId}` : ""}`} focused={panel === "deploy"}>
              {selectedDeploy ? (
                <>
                  <text content={`State: ${selectedDeploy.status}`} fg={theme.text} />
                  <text content={`Ready: ${selectedDeploy.readyState ?? "unknown"}`} fg={theme.textDim} />
                  <text content={`Age: ${since(selectedDeploy.createdAt)}`} fg={theme.textDim} />
                  <text content={`Inspector: ${selectedDeploy.inspectorUrl ?? "Unknown"}`} fg={theme.textDim} wrapMode="none" />
                  <text content={selectedDeploy.errorCode ? `Error: ${selectedDeploy.errorCode}` : "No error code"} fg={selectedDeploy.errorCode ? theme.bad : theme.good} />
                  <text content={selectedDeploy.errorMessage ?? "No error message"} fg={theme.textFaint} />
                  <text content={selectedDeploy.inspectorUrl ? "Press d to open inspector" : "No inspector page available"} fg={theme.textFaint} />
                </>
              ) : (
                <text content="Choose a deployment from the recent list or failed list." fg={theme.textFaint} />
              )}
            </Section>
          </box>
        </box>

        <box style={{ flexGrow: 1, flexDirection: "row" }}>
          <box style={{ width: "50%", flexDirection: "column" }}>
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

        <box style={{ height: 3, flexDirection: "column" }}>
          <Section title="Menu" focused={panel === "footer"}>
            <StatusBar
              hints={[
                { key: "↑↓", label: "move" },
                { key: "Tab", label: "next panel" },
                { key: "⏎", label: "open" },
                { key: "o", label: "open url" },
                { key: "g", label: "open repo" },
                { key: "d", label: "deploy page" },
                { key: "c", label: "create site" },
              ]}
              message={panel === "footer" ? "Footer focused" : "Tab through panels in reading order"}
              showGlobal={false}
            />
          </Section>
        </box>
      </box>
    </box>
  )
}
