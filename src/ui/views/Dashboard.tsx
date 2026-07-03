// Cross-provider dashboard: one summary card per provider, every site from
// every provider in one list, merged recent activity, and anything failing.
// Enter on a site jumps to its provider page with that site pre-selected.

import { useMemo, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { DeployRow, EmptyPanel, Section, SiteRow, since } from "../parts.tsx"
import { providerGlyph, theme } from "../../lib/theme.ts"
import { isActiveStatus, isFailedStatus } from "../../domain.ts"
import { useData, type ProviderState } from "../data.tsx"
import { useStore } from "../store.tsx"
import { openUrl } from "../../lib/open.ts"

type Panel = "sites" | "activity" | "attention"

function connectionLine(state: ProviderState): { text: string; color: string } {
  if (!state.configured) return { text: "○ not configured", color: theme.textFaint }
  if (state.loading) return { text: "◐ loading…", color: theme.warn }
  if (state.error) return { text: `✕ ${state.error}`, color: theme.bad }
  return { text: `● connected${state.account ? ` · ${state.account}` : ""}`, color: theme.good }
}

function ProviderCard({ state, thirdLine }: { state: ProviderState; thirdLine: string }) {
  const conn = connectionLine(state)
  const failed = state.deploys.filter((d) => isFailedStatus(d.status)).length
  const building = state.deploys.filter((d) => isActiveStatus(d.status)).length
  const latest = state.deploys[0]?.createdAt ?? state.sites[0]?.lastDeploy ?? null
  return (
    <box
      title={` ${providerGlyph[state.id]} ${state.name} `}
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: theme.border,
        flexDirection: "column",
        flexGrow: 1,
        flexBasis: 0,
        height: 6,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text content={conn.text} fg={conn.color} wrapMode="none" />
      <box style={{ flexDirection: "row", height: 1 }}>
        <text content={`${state.sites.length} sites`} fg={theme.text} />
        <text content={failed ? `  ${failed} failed` : "  0 failed"} fg={failed ? theme.bad : theme.textFaint} />
        {building ? <text content={`  ${building} building`} fg={theme.warn} /> : null}
      </box>
      <text content={thirdLine} fg={theme.textDim} wrapMode="none" />
      <text content={`last deploy ${since(latest)}${latest ? " ago" : ""}`} fg={theme.textFaint} wrapMode="none" />
    </box>
  )
}

export function Dashboard({ rows }: { rows: number }) {
  const data = useData()
  const store = useStore()
  const [panel, setPanel] = useState<Panel>("sites")
  const [siteIndex, setSiteIndex] = useState(0)
  const [activityIndex, setActivityIndex] = useState(0)
  const [attentionIndex, setAttentionIndex] = useState(0)

  const sites = useMemo(
    () => [...data.allSites].sort((a, b) => new Date(b.lastDeploy ?? 0).getTime() - new Date(a.lastDeploy ?? 0).getTime()),
    [data.allSites],
  )
  const activity = data.allDeploys.slice(0, 50)
  const attention = useMemo(() => data.allDeploys.filter((d) => isFailedStatus(d.status)).slice(0, 20), [data.allDeploys])

  const selectedSite = sites[siteIndex] ?? null
  const selectedDeploy = panel === "attention" ? attention[attentionIndex] ?? null : activity[activityIndex] ?? null

  useKeyboard((key) => {
    if (key.name === "tab") {
      const order: Panel[] = ["sites", "activity", "attention"]
      setPanel(order[(order.indexOf(panel) + 1) % order.length])
      return
    }
    if (key.name === "down" || key.name === "j") {
      if (panel === "sites") setSiteIndex((cur) => moveSelection(cur, 1, sites.length))
      else if (panel === "activity") setActivityIndex((cur) => moveSelection(cur, 1, activity.length))
      else setAttentionIndex((cur) => moveSelection(cur, 1, attention.length))
      return
    }
    if (key.name === "up" || key.name === "k") {
      if (panel === "sites") setSiteIndex((cur) => moveSelection(cur, -1, sites.length))
      else if (panel === "activity") setActivityIndex((cur) => moveSelection(cur, -1, activity.length))
      else setAttentionIndex((cur) => moveSelection(cur, -1, attention.length))
      return
    }
    if (key.name === "return" || key.name === "enter") {
      if (panel === "sites" && selectedSite) {
        store.setFocusSiteId(selectedSite.id)
        store.setRoute(selectedSite.provider.id)
      }
      return
    }
    if (key.name === "o") {
      const target = panel === "sites" ? selectedSite?.deploymentUrl ?? selectedSite?.domains?.[0] : selectedDeploy?.url
      if (target) openUrl(target.startsWith("http") ? target : `https://${target}`)
      return
    }
    if (key.name === "d") {
      const url = selectedDeploy?.inspectorUrl ?? selectedDeploy?.url
      if (url) openUrl(url.startsWith("http") ? url : `https://${url}`)
    }
  })

  const bodyRows = Math.max(6, rows - 6)
  const activityHeight = Math.max(6, Math.round(bodyRows * 0.55))

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <box style={{ flexDirection: "row", height: 6 }}>
        <ProviderCard state={data.vercel} thirdLine={data.vercel.plan ? `plan ${data.vercel.plan}` : "plan unknown"} />
        <ProviderCard state={data.netlify} thirdLine={data.netlify.plan ? `plan ${data.netlify.plan}` : "plan unknown"} />
        <ProviderCard state={data.cloudflare} thirdLine={`${data.zones.length} zones · ${data.workers.length} workers`} />
      </box>

      <box style={{ flexGrow: 1, flexDirection: "row" }}>
        <box style={{ width: "50%", flexDirection: "column" }}>
          <Section title={`All sites (${sites.length})`} focused={panel === "sites"} grow={1}>
            <List
              items={sites}
              selectedIndex={siteIndex}
              viewportRows={Math.max(1, bodyRows - 3)}
              keyFor={(site) => `${site.provider.id}:${site.id}`}
              focused={panel === "sites"}
              renderRow={(site, selected) => <SiteRow site={site} selected={selected} showProvider />}
              emptyText={data.providers.some((p) => p.loading) ? "Loading sites…" : "No sites found. Check tokens in .env."}
            />
          </Section>
        </box>

        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <Section title="Recent activity" focused={panel === "activity"} height={activityHeight}>
            <List
              items={activity}
              selectedIndex={activityIndex}
              viewportRows={Math.max(1, activityHeight - 3)}
              keyFor={(d) => `${d.provider}:${d.id}`}
              focused={panel === "activity"}
              renderRow={(deploy, selected) => <DeployRow deploy={deploy} selected={selected} showSite />}
              emptyText="No deploys yet."
            />
          </Section>
          <Section title={`Needs attention (${attention.length})`} focused={panel === "attention"} grow={1}>
            {attention.length ? (
              <List
                items={attention}
                selectedIndex={attentionIndex}
                viewportRows={Math.max(1, bodyRows - activityHeight - 3)}
                keyFor={(d) => `${d.provider}:${d.id}`}
                focused={panel === "attention"}
                renderRow={(deploy, selected) => <DeployRow deploy={deploy} selected={selected} showSite />}
              />
            ) : (
              <EmptyPanel text="● No failed deploys across providers." color={theme.good} />
            )}
          </Section>
        </box>
      </box>
    </box>
  )
}
