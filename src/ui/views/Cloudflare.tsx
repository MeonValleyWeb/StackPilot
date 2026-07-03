// Cloudflare page: Pages projects with per-project deployment history on top,
// zones and Workers scripts along the bottom — the parts of the account that
// matter day to day.

import { useEffect, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { DeployRow, EmptyPanel, Field, Section, SiteRow, since } from "../parts.tsx"
import { statusColor, statusDot, theme } from "../../lib/theme.ts"
import { useData } from "../data.tsx"
import { useStore } from "../store.tsx"
import { loadConfig } from "../../config.ts"
import { CloudflareClient } from "../../providers/cloudflare.ts"
import { openUrl } from "../../lib/open.ts"
import type { Deploy } from "../../domain.ts"
import { openDeploy, openRepo, openSite } from "./Vercel.tsx"

type Panel = "projects" | "deploys" | "zones" | "workers"

export function Cloudflare({ rows }: { rows: number }) {
  const data = useData()
  const store = useStore()
  const state = data.cloudflare
  const [panel, setPanel] = useState<Panel>("projects")
  const [siteIndex, setSiteIndex] = useState(0)
  const [deployIndex, setDeployIndex] = useState(0)
  const [zoneIndex, setZoneIndex] = useState(0)
  const [workerIndex, setWorkerIndex] = useState(0)
  const [deploysByProject, setDeploysByProject] = useState<Record<string, Deploy[]>>({})

  const sites = state.sites
  const selected = sites[siteIndex] ?? null
  const deploys = selected ? deploysByProject[selected.id] ?? [] : []
  const selectedDeploy = deploys[deployIndex] ?? deploys[0] ?? null

  useEffect(() => {
    if (!store.focusSiteId) return
    const idx = sites.findIndex((s) => s.id === store.focusSiteId)
    if (idx >= 0) {
      setSiteIndex(idx)
      store.setFocusSiteId(null)
    }
  }, [sites, store.focusSiteId])

  // Lazily fetch deployment history for the selected Pages project.
  useEffect(() => {
    const site = sites[siteIndex]
    const cfg = loadConfig()
    if (!site || !cfg.cloudflareToken) return
    const client = new CloudflareClient(cfg.cloudflareToken, cfg.cloudflareAccountId)
    void client
      .listDeployments(site.id)
      .then((list) => setDeploysByProject((m) => ({ ...m, [site.id]: list })))
      .catch(() => {})
  }, [siteIndex, sites, data.lastUpdated])

  useEffect(() => {
    setDeployIndex((cur) => Math.min(cur, Math.max(0, deploys.length - 1)))
  }, [deploys.length])

  useKeyboard((key) => {
    if (key.name === "tab") {
      const order: Panel[] = ["projects", "deploys", "zones", "workers"]
      setPanel(order[(order.indexOf(panel) + 1) % order.length])
      return
    }
    const move = (delta: number) => {
      if (panel === "deploys") setDeployIndex((cur) => moveSelection(cur, delta, deploys.length))
      else if (panel === "zones") setZoneIndex((cur) => moveSelection(cur, delta, data.zones.length))
      else if (panel === "workers") setWorkerIndex((cur) => moveSelection(cur, delta, data.workers.length))
      else setSiteIndex((cur) => moveSelection(cur, delta, sites.length))
    }
    if (key.name === "down" || key.name === "j") return move(1)
    if (key.name === "up" || key.name === "k") return move(-1)
    if (key.name === "o") {
      if (panel === "zones") {
        const zone = data.zones[zoneIndex]
        if (zone) openUrl(`https://${zone.name}`)
        return
      }
      return openSite(selected)
    }
    if (key.name === "g") return openRepo(selected)
    if (key.name === "a") {
      if (selected?.adminUrl) openUrl(selected.adminUrl)
      return
    }
    if (key.name === "d") return openDeploy(selectedDeploy)
  })

  if (!state.configured) return <EmptyPanel text="Cloudflare is not configured. Set CLOUDFLARE_API_TOKEN (and optionally CLOUDFLARE_ACCOUNT_ID) in .env." />
  if (state.error) return <EmptyPanel text={`Cloudflare error: ${state.error}`} color={theme.bad} />

  const bottomHeight = Math.max(6, Math.min(10, Math.round(rows * 0.3)))
  const topRows = rows - bottomHeight
  const detailsHeight = 10
  const titleMeta = state.account ? ` · ${state.account}` : ""

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <box style={{ flexDirection: "row", height: topRows }}>
        <box style={{ width: "40%", flexDirection: "column" }}>
          <Section title={`Pages projects (${sites.length})${titleMeta}`} focused={panel === "projects"} grow={1}>
            <List
              items={sites}
              selectedIndex={siteIndex}
              viewportRows={Math.max(1, topRows - 3)}
              keyFor={(site) => site.id}
              focused={panel === "projects"}
              renderRow={(site, sel) => <SiteRow site={site} selected={sel} />}
              emptyText={state.loading ? "Loading projects…" : "No Pages projects found."}
            />
          </Section>
        </box>

        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <Section title={selected ? `Project · ${selected.name}` : "Project"} height={detailsHeight}>
            {selected ? (
              <>
                <Field label="Status" value={selected.status.toLowerCase()} color={statusColor(selected.status)} />
                <Field label="Repo" value={selected.repo ?? "— (direct upload)"} />
                <Field label="Branch" value={selected.branch ?? "—"} />
                <Field label="Domains" value={selected.domains?.length ? selected.domains.join(", ") : "—"} />
                <Field label="URL" value={selected.deploymentUrl ?? "—"} color={theme.accent} />
                <Field label="Deployed" value={selected.lastDeploy ? `${since(selected.lastDeploy)} ago` : "never"} />
              </>
            ) : (
              <text content="Select a project." fg={theme.textFaint} />
            )}
          </Section>

          <Section title={`Deployments (${deploys.length})`} focused={panel === "deploys"} grow={1}>
            <List
              items={deploys}
              selectedIndex={deployIndex}
              viewportRows={Math.max(1, topRows - detailsHeight - 3)}
              keyFor={(d) => d.id}
              focused={panel === "deploys"}
              renderRow={(deploy, sel) => <DeployRow deploy={deploy} selected={sel} />}
              emptyText={selected ? "Loading deployments…" : "Select a project."}
            />
          </Section>
        </box>
      </box>

      <box style={{ flexDirection: "row", height: bottomHeight }}>
        <Section title={`Zones (${data.zones.length})`} focused={panel === "zones"} grow={1}>
          <List
            items={data.zones}
            selectedIndex={zoneIndex}
            viewportRows={Math.max(1, bottomHeight - 3)}
            keyFor={(zone) => zone.id}
            focused={panel === "zones"}
            renderRow={(zone, sel) => (
              <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
                <text content={`${statusDot(zone.status)} `} fg={statusColor(zone.status)} />
                <text content={zone.name} fg={sel ? theme.text : theme.textDim} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                <text content={` ${zone.plan ?? zone.status}`} fg={theme.textFaint} wrapMode="none" />
              </box>
            )}
            emptyText="No zones visible to this token."
          />
        </Section>

        <Section title={`Workers (${data.workers.length})`} focused={panel === "workers"} grow={1}>
          <List
            items={data.workers}
            selectedIndex={workerIndex}
            viewportRows={Math.max(1, bottomHeight - 3)}
            keyFor={(worker) => worker.id}
            focused={panel === "workers"}
            renderRow={(worker, sel) => (
              <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
                <text content="λ " fg={theme.purple} />
                <text content={worker.id} fg={sel ? theme.text : theme.textDim} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                <text content={` ${since(worker.modifiedOn)}`} fg={theme.textFaint} />
              </box>
            )}
            emptyText="No Workers scripts."
          />
        </Section>
      </box>
    </box>
  )
}
