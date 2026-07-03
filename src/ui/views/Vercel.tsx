// Vercel page: projects on the left; details and the account-wide deployment
// feed (filtered to the selected project) on the right.

import { useEffect, useMemo, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { DeployRow, EmptyPanel, Field, Section, SiteRow, since } from "../parts.tsx"
import { statusColor, theme } from "../../lib/theme.ts"
import { useData } from "../data.tsx"
import { useStore } from "../store.tsx"
import { openUrl } from "../../lib/open.ts"
import type { Deploy, Site } from "../../domain.ts"

type Panel = "projects" | "deploys"

export function openSite(site: Site | null) {
  const target = site?.deploymentUrl ?? site?.domains?.[0]
  if (target) openUrl(target.startsWith("http") ? target : `https://${target}`)
}

export function openRepo(site: Site | null) {
  if (!site?.repo) return
  // Handles "org/repo", "https://github.com/org/repo", and "git@host:org/repo".
  const repo = site.repo.replace(/^https?:\/\//, "").replace(/^git@/, "").replace(/\.git$/, "").replace(":", "/")
  openUrl(repo.includes(".") ? `https://${repo}` : `https://github.com/${repo}`)
}

export function openDeploy(deploy: Deploy | null) {
  const url = deploy?.inspectorUrl ?? deploy?.url
  if (url) openUrl(url.startsWith("http") ? url : `https://${url}`)
}

export function Vercel({ rows }: { rows: number }) {
  const data = useData()
  const store = useStore()
  const state = data.vercel
  const [panel, setPanel] = useState<Panel>("projects")
  const [siteIndex, setSiteIndex] = useState(0)
  const [deployIndex, setDeployIndex] = useState(0)

  const sites = state.sites
  const selected = sites[siteIndex] ?? null
  const deploys = useMemo(
    () => (selected ? state.deploys.filter((d) => d.siteId === selected.id) : []),
    [state.deploys, selected],
  )
  const selectedDeploy = deploys[deployIndex] ?? deploys[0] ?? null

  // Jump-in from the dashboard: pre-select the site the user was on.
  useEffect(() => {
    if (!store.focusSiteId) return
    const idx = sites.findIndex((s) => s.id === store.focusSiteId)
    if (idx >= 0) {
      setSiteIndex(idx)
      store.setFocusSiteId(null)
    }
  }, [sites, store.focusSiteId])

  useEffect(() => {
    setDeployIndex((cur) => Math.min(cur, Math.max(0, deploys.length - 1)))
  }, [deploys.length])

  useKeyboard((key) => {
    if (key.name === "tab") return setPanel(panel === "projects" ? "deploys" : "projects")
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
    if (key.name === "d") return openDeploy(selectedDeploy)
  })

  if (!state.configured) return <EmptyPanel text="Vercel is not configured. Set VERCEL_TOKEN in .env." />
  if (state.error) return <EmptyPanel text={`Vercel error: ${state.error}`} color={theme.bad} />

  const detailsHeight = 10
  const titleMeta = state.plan ? ` · ${state.plan} plan` : ""

  return (
    <box style={{ flexGrow: 1, flexDirection: "row" }}>
      <box style={{ width: "40%", flexDirection: "column" }}>
        <Section title={`Projects (${sites.length})${titleMeta}`} focused={panel === "projects"} grow={1}>
          <List
            items={sites}
            selectedIndex={siteIndex}
            viewportRows={Math.max(1, rows - 3)}
            keyFor={(site) => site.id}
            focused={panel === "projects"}
            renderRow={(site, sel) => <SiteRow site={site} selected={sel} />}
            emptyText={state.loading ? "Loading projects…" : "No projects found."}
          />
        </Section>
      </box>

      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <Section title={selected ? `Project · ${selected.name}` : "Project"} height={detailsHeight}>
          {selected ? (
            <>
              <Field label="Status" value={selected.status.toLowerCase()} color={statusColor(selected.status)} />
              <Field label="Repo" value={selected.repo ?? "—"} />
              <Field label="Branch" value={selected.branch ?? "—"} />
              <Field label="Stack" value={selected.stack ?? "—"} />
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
            viewportRows={Math.max(1, rows - detailsHeight - 3)}
            keyFor={(d) => d.id}
            focused={panel === "deploys"}
            renderRow={(deploy, sel) => <DeployRow deploy={deploy} selected={sel} />}
            emptyText="No recent deployments for this project."
          />
        </Section>
      </box>
    </box>
  )
}
