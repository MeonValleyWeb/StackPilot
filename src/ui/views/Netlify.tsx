// Netlify page: sites on the left; details and per-site deploy history on the
// right. Deploy history is fetched lazily per site (Netlify has no
// account-wide deploys endpoint) and cached for instant back-navigation.

import { useEffect, useMemo, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { DeployRow, EmptyPanel, Field, Section, SiteRow, since } from "../parts.tsx"
import { statusColor, theme } from "../../lib/theme.ts"
import { useData } from "../data.tsx"
import { useStore } from "../store.tsx"
import { loadConfig } from "../../config.ts"
import { NetlifyClient } from "../../providers/netlify.ts"
import { openUrl } from "../../lib/open.ts"
import type { Deploy } from "../../domain.ts"
import { openDeploy, openRepo, openSite } from "./Vercel.tsx"

type Panel = "sites" | "deploys"

export function Netlify({ rows }: { rows: number }) {
  const data = useData()
  const store = useStore()
  const state = data.netlify
  const [panel, setPanel] = useState<Panel>("sites")
  const [siteIndex, setSiteIndex] = useState(0)
  const [deployIndex, setDeployIndex] = useState(0)
  const [deploysBySite, setDeploysBySite] = useState<Record<string, Deploy[]>>({})

  const sites = state.sites
  const selected = sites[siteIndex] ?? null
  const deploys = selected ? deploysBySite[selected.id] ?? [] : []
  const selectedDeploy = deploys[deployIndex] ?? deploys[0] ?? null

  useEffect(() => {
    if (!store.focusSiteId) return
    const idx = sites.findIndex((s) => s.id === store.focusSiteId)
    if (idx >= 0) {
      setSiteIndex(idx)
      store.setFocusSiteId(null)
    }
  }, [sites, store.focusSiteId])

  // Fetch the selected site's deploy history (refreshes whenever the global
  // data refreshes too, keyed on lastUpdated).
  useEffect(() => {
    const site = sites[siteIndex]
    const cfg = loadConfig()
    if (!site || !cfg.netlifyToken) return
    const client = new NetlifyClient(cfg.netlifyToken)
    void client
      .listDeploys(site.id, site.name)
      .then((list) => setDeploysBySite((m) => ({ ...m, [site.id]: list })))
      .catch(() => {})
  }, [siteIndex, sites, data.lastUpdated])

  useEffect(() => {
    setDeployIndex((cur) => Math.min(cur, Math.max(0, deploys.length - 1)))
  }, [deploys.length])

  useKeyboard((key) => {
    if (key.name === "tab") return setPanel(panel === "sites" ? "deploys" : "sites")
    if (key.name === "down" || key.name === "j") {
      if (panel === "deploys") setDeployIndex((cur) => moveSelection(cur, 1, deploys.length))
      else setSiteIndex((cur) => moveSelection(cur, 1, sites.length))
      return
    }
    if (key.name === "up" || key.name === "k") {
      if (panel === "deploys") setDeployIndex((cur) => moveSelection(cur, -1, deploys.length))
      else setSiteIndex((cur) => moveSelection(cur, -1, sites.length))
      return
    }
    if (key.name === "o") return openSite(selected)
    if (key.name === "g") return openRepo(selected)
    if (key.name === "a") {
      if (selected?.adminUrl) openUrl(selected.adminUrl)
      return
    }
    if (key.name === "d") return openDeploy(selectedDeploy)
  })

  const failedDeploy = useMemo(() => deploys.find((d) => d.errorMessage), [deploys])

  if (!state.configured) return <EmptyPanel text="Netlify is not configured. Set NETLIFY_API_KEY in .env." />
  if (state.error) return <EmptyPanel text={`Netlify error: ${state.error}`} color={theme.bad} />

  const detailsHeight = 11
  const titleMeta = state.plan ? ` · ${state.plan}` : ""

  return (
    <box style={{ flexGrow: 1, flexDirection: "row" }}>
      <box style={{ width: "40%", flexDirection: "column" }}>
        <Section title={`Sites (${sites.length})${titleMeta}`} focused={panel === "sites"} grow={1}>
          <List
            items={sites}
            selectedIndex={siteIndex}
            viewportRows={Math.max(1, rows - 3)}
            keyFor={(site) => site.id}
            focused={panel === "sites"}
            renderRow={(site, sel) => <SiteRow site={site} selected={sel} />}
            emptyText={state.loading ? "Loading sites…" : "No sites found."}
          />
        </Section>
      </box>

      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <Section title={selected ? `Site · ${selected.name}` : "Site"} height={detailsHeight}>
          {selected ? (
            <>
              <Field label="Status" value={selected.status.toLowerCase()} color={statusColor(selected.status)} />
              <Field label="Domain" value={selected.domains?.length ? selected.domains.join(", ") : "—"} />
              <Field label="URL" value={selected.deploymentUrl ?? "—"} color={theme.accent} />
              <Field label="Repo" value={selected.repo ?? "—"} />
              <Field label="Branch" value={selected.branch ?? "—"} />
              <Field label="Stack" value={selected.stack ?? "—"} />
              <Field label="Published" value={selected.lastDeploy ? `${since(selected.lastDeploy)} ago` : "never"} />
              <Field label="Admin" value={selected.adminUrl ?? "—"} color={theme.textDim} />
            </>
          ) : (
            <text content="Select a site." fg={theme.textFaint} />
          )}
        </Section>

        <Section title={`Deploys (${deploys.length})`} focused={panel === "deploys"} grow={1}>
          {failedDeploy?.errorMessage && (
            <box style={{ height: 1, flexDirection: "row" }}>
              <text content={`✕ ${failedDeploy.errorMessage}`} fg={theme.bad} wrapMode="none" />
            </box>
          )}
          <List
            items={deploys}
            selectedIndex={deployIndex}
            viewportRows={Math.max(1, rows - detailsHeight - (failedDeploy ? 4 : 3))}
            keyFor={(d) => d.id}
            focused={panel === "deploys"}
            renderRow={(deploy, sel) => <DeployRow deploy={deploy} selected={sel} />}
            emptyText={selected ? "Loading deploy history…" : "Select a site."}
          />
        </Section>
      </box>
    </box>
  )
}
