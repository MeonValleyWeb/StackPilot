// Cloudflare's operational view. Tab cycles between Pages projects,
// Pages deployments, Zones, and Workers while keeping the selected resource's
// useful API data visible inside StackPilot.

import { useEffect, useMemo, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { List, moveSelection } from "../List.tsx"
import { DeployRow, EmptyPanel, Field, Section, SiteRow, since } from "../parts.tsx"
import { statusColor, statusDot, theme } from "../../lib/theme.ts"
import { useData } from "../data.tsx"
import { useStore } from "../store.tsx"
import { loadConfig } from "../../config.ts"
import { CloudflareClient, type WorkerDeployment } from "../../providers/cloudflare.ts"
import { openUrl } from "../../lib/open.ts"
import type { Deploy } from "../../domain.ts"
import { openRepo, openSite } from "./Vercel.tsx"

type Panel = "projects" | "deploys" | "zones" | "workers"

const PANELS: Array<{ id: Panel; label: string }> = [
  { id: "projects", label: "Pages" },
  { id: "deploys", label: "Deployments" },
  { id: "zones", label: "Zones" },
  { id: "workers", label: "Workers" },
]

function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10)
}

function durationLabel(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function expiryLabel(iso: string | null | undefined): string {
  if (!iso) return "—"
  const expiry = new Date(iso)
  if (Number.isNaN(expiry.getTime())) return "—"
  const days = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000)
  return `${dateLabel(iso)} · ${days >= 0 ? `${days}d left` : `${Math.abs(days)}d expired`}`
}

function shortId(value: string | null | undefined): string {
  return value ? value.slice(0, 12) : "—"
}

export function Cloudflare({ rows }: { rows: number }) {
  const data = useData()
  const store = useStore()
  const state = data.cloudflare
  const [panel, setPanel] = useState<Panel>("projects")
  const [siteIndex, setSiteIndex] = useState(0)
  const [deployIndex, setDeployIndex] = useState(0)
  const [zoneIndex, setZoneIndex] = useState(0)
  const [workerIndex, setWorkerIndex] = useState(0)
  const [workerDeployIndex, setWorkerDeployIndex] = useState(0)
  const [deploysByProject, setDeploysByProject] = useState<Record<string, Deploy[]>>({})
  const [deploysLoaded, setDeploysLoaded] = useState<Record<string, boolean>>({})
  const [deployErrors, setDeployErrors] = useState<Record<string, string | null>>({})
  const [workerDeploys, setWorkerDeploys] = useState<Record<string, WorkerDeployment[]>>({})
  const [workerDeploysLoaded, setWorkerDeploysLoaded] = useState<Record<string, boolean>>({})
  const [workerDeployErrors, setWorkerDeployErrors] = useState<Record<string, string | null>>({})

  const sites = state.sites
  const selected = sites[siteIndex] ?? null
  const deploys = selected ? deploysByProject[selected.id] ?? [] : []
  const selectedDeploy = deploys[deployIndex] ?? deploys[0] ?? null
  const selectedZone = data.zones[zoneIndex] ?? null
  const selectedWorker = data.workers[workerIndex] ?? null
  const selectedWorkerDeploys = selectedWorker ? workerDeploys[selectedWorker.id] ?? [] : []
  const selectedWorkerDeploy = selectedWorkerDeploys[workerDeployIndex] ?? selectedWorkerDeploys[0] ?? null
  const selectedRegistration = useMemo(
    () => (selectedZone ? data.registrations.find((registration) => registration.name === selectedZone.name) ?? null : null),
    [data.registrations, selectedZone],
  )

  useEffect(() => {
    if (!store.focusSiteId) return
    const idx = sites.findIndex((site) => site.id === store.focusSiteId)
    if (idx >= 0) {
      setSiteIndex(idx)
      setPanel("projects")
      store.setFocusSiteId(null)
    }
  }, [sites, store.focusSiteId])

  // Pages deployment history is loaded only for the selected project.
  useEffect(() => {
    const site = sites[siteIndex]
    const cfg = loadConfig()
    if (!site || !cfg.cloudflareToken) return
    const client = new CloudflareClient(cfg.cloudflareToken, cfg.cloudflareAccountId)
    setDeploysLoaded((loaded) => ({ ...loaded, [site.id]: false }))
    setDeployErrors((errors) => ({ ...errors, [site.id]: null }))
    void client
      .listDeployments(site.id)
      .then((list) => {
        setDeploysByProject((items) => ({ ...items, [site.id]: list }))
        setDeploysLoaded((loaded) => ({ ...loaded, [site.id]: true }))
      })
      .catch((error) => {
        setDeployErrors((errors) => ({ ...errors, [site.id]: (error as Error).message }))
        setDeploysLoaded((loaded) => ({ ...loaded, [site.id]: true }))
      })
  }, [siteIndex, sites, data.lastUpdated])

  // Worker deployment history is likewise selected-script data, not an
  // account-wide payload.
  useEffect(() => {
    const worker = data.workers[workerIndex]
    const cfg = loadConfig()
    if (!worker || !cfg.cloudflareToken) return
    const client = new CloudflareClient(cfg.cloudflareToken, cfg.cloudflareAccountId)
    setWorkerDeploysLoaded((loaded) => ({ ...loaded, [worker.id]: false }))
    setWorkerDeployErrors((errors) => ({ ...errors, [worker.id]: null }))
    void client
      .listWorkerDeployments(worker.id)
      .then((list) => {
        setWorkerDeploys((items) => ({ ...items, [worker.id]: list }))
        setWorkerDeploysLoaded((loaded) => ({ ...loaded, [worker.id]: true }))
      })
      .catch((error) => {
        setWorkerDeployErrors((errors) => ({ ...errors, [worker.id]: (error as Error).message }))
        setWorkerDeploysLoaded((loaded) => ({ ...loaded, [worker.id]: true }))
      })
  }, [workerIndex, data.workers, data.lastUpdated])

  useEffect(() => {
    setDeployIndex(0)
  }, [selected?.id])

  useEffect(() => {
    setWorkerDeployIndex(0)
  }, [selectedWorker?.id])

  useKeyboard((key) => {
    if (key.name === "tab") {
      const current = PANELS.findIndex((item) => item.id === panel)
      setPanel(PANELS[(current + 1) % PANELS.length]!.id)
      return
    }

    const move = (delta: number) => {
      if (panel === "deploys") setDeployIndex((current) => moveSelection(current, delta, deploys.length))
      else if (panel === "zones") setZoneIndex((current) => moveSelection(current, delta, data.zones.length))
      else if (panel === "workers") {
        if (key.shift) setWorkerDeployIndex((current) => moveSelection(current, delta, selectedWorkerDeploys.length))
        else setWorkerIndex((current) => moveSelection(current, delta, data.workers.length))
      } else setSiteIndex((current) => moveSelection(current, delta, sites.length))
    }

    if (key.name === "down" || key.name === "j") return move(1)
    if (key.name === "up" || key.name === "k") return move(-1)

    if (key.name === "o") {
      if (panel === "zones") {
        if (selectedZone) openUrl(`https://${selectedZone.name}`)
        return
      }
      if (panel === "workers") {
        const domain = selectedWorker?.domains[0]
        if (domain) openUrl(`https://${domain}`)
        return
      }
      if (panel === "deploys" && selectedDeploy?.url) {
        openUrl(selectedDeploy.url)
        return
      }
      return openSite(selected)
    }

    if (key.name === "g" && (panel === "projects" || panel === "deploys")) return openRepo(selected)

    if (key.name === "a") {
      if ((panel === "projects" || panel === "deploys") && selected?.adminUrl) {
        openUrl(selected.adminUrl)
        return
      }
      const accountId = loadConfig().cloudflareAccountId
      if (accountId && panel === "zones" && selectedZone) {
        openUrl(`https://dash.cloudflare.com/${accountId}/${selectedZone.name}`)
        return
      }
      if (accountId && panel === "workers") openUrl(`https://dash.cloudflare.com/${accountId}/workers-and-pages`)
      return
    }

    // Cloudflare does not provide an inspector URL. Open the selected Pages
    // deployment URL returned by the API instead of guessing a dashboard path.
    if (key.name === "d" && selectedDeploy?.url && (panel === "projects" || panel === "deploys")) openUrl(selectedDeploy.url)
  })

  if (!state.configured) return <EmptyPanel text="Cloudflare is not configured. Set CLOUDFLARE_API_TOKEN (and optionally CLOUDFLARE_ACCOUNT_ID) in .env." />
  if (state.error) return <EmptyPanel text={`Cloudflare error: ${state.error}`} color={theme.bad} />

  const mainRows = Math.max(3, rows - 1)
  const showDeepDetails = mainRows >= 20
  const titleMeta = state.account ? ` · ${state.account}` : ""

  const pageView = (
    <box style={{ flexGrow: 1, flexDirection: "row" }}>
      <box style={{ width: "38%", flexDirection: "column" }}>
        <Section title={`Pages projects (${sites.length})${titleMeta}`} focused={panel === "projects"} grow={1}>
          <List
            items={sites}
            selectedIndex={siteIndex}
            viewportRows={Math.max(1, mainRows - 3)}
            keyFor={(site) => site.id}
            focused={panel === "projects"}
            renderRow={(site, selectedRow) => <SiteRow site={site} selected={selectedRow} />}
            emptyText={state.loading ? "Loading projects…" : "No Pages projects found."}
          />
        </Section>
      </box>

      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <Section title={selected ? `Project · ${selected.name}` : "Project"} height={8}>
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
            viewportRows={Math.max(1, mainRows - (showDeepDetails ? 18 : 11))}
            keyFor={(deployment) => deployment.id}
            focused={panel === "deploys"}
            renderRow={(deployment, selectedRow) => <DeployRow deploy={deployment} selected={selectedRow} />}
            emptyText={
              selected
                ? deployErrors[selected.id] ?? (deploysLoaded[selected.id] ? "No deployments found." : "Loading deployments…")
                : "Select a project."
            }
          />
        </Section>

        {showDeepDetails && (
          <Section title={selectedDeploy ? `Deployment · ${shortId(selectedDeploy.id)}` : "Deployment"} height={9}>
            {selectedDeploy ? (
              <>
                <Field label="Status" value={selectedDeploy.status.toLowerCase()} color={statusColor(selectedDeploy.status)} />
                <Field label="Environment" value={selectedDeploy.target ?? "—"} />
                <Field label="Branch" value={selectedDeploy.branch ?? "—"} />
                <Field label="Commit" value={shortId(selectedDeploy.commitHash)} />
                <Field label="Message" value={selectedDeploy.errorMessage ?? "—"} />
                <Field label="Created" value={`${dateLabel(selectedDeploy.createdAt)} · ${since(selectedDeploy.createdAt)} ago · ${durationLabel(selectedDeploy.durationMs)}`} />
                <Field label="URL" value={selectedDeploy.url ?? "—"} color={theme.accent} />
              </>
            ) : (
              <text content="Select a deployment." fg={theme.textFaint} />
            )}
          </Section>
        )}
      </box>
    </box>
  )

  const zoneView = (
    <box style={{ flexGrow: 1, flexDirection: "row" }}>
      <box style={{ width: "40%", flexDirection: "column" }}>
        <Section title={`Zones (${data.zones.length})${titleMeta}`} focused grow={1}>
          <List
            items={data.zones}
            selectedIndex={zoneIndex}
            viewportRows={Math.max(1, mainRows - 3)}
            keyFor={(zone) => zone.id}
            focused
            renderRow={(zone, selectedRow) => (
              <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
                <text content={`${statusDot(zone.status)} `} fg={statusColor(zone.status)} />
                <text content={zone.name} fg={selectedRow ? theme.text : theme.textDim} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                <text content={` ${zone.plan ?? zone.status}`} fg={theme.textFaint} wrapMode="none" />
              </box>
            )}
            emptyText="No zones visible to this token."
          />
        </Section>
      </box>

      <Section title={selectedZone ? `Zone · ${selectedZone.name}` : "Zone"} grow={1}>
        {selectedZone ? (
          <>
            <Field label="Status" value={selectedZone.status} color={statusColor(selectedZone.status)} />
            <Field label="Plan" value={selectedZone.plan ?? "—"} />
            <Field label="Type" value={selectedZone.type ?? "—"} />
            <Field label="Paused" value={selectedZone.paused ? "yes" : "no"} color={selectedZone.paused ? theme.warn : theme.good} />
            <Field label="Dev mode" value={selectedZone.developmentMode > 0 ? `${Math.ceil(selectedZone.developmentMode / 60)}m remaining` : "off"} />
            <Field label="Created" value={dateLabel(selectedZone.createdOn)} />
            <Field label="Activated" value={dateLabel(selectedZone.activatedOn)} />
            <Field label="Modified" value={selectedZone.modifiedOn ? `${dateLabel(selectedZone.modifiedOn)} · ${since(selectedZone.modifiedOn)} ago` : "—"} />
            <Field label="Registrar" value={selectedZone.originalRegistrar ?? selectedZone.originalDnsHost ?? "—"} />
            <Field
              label="Expiry"
              value={
                selectedRegistration
                  ? expiryLabel(selectedRegistration.expiresAt)
                  : data.registrarAvailable === false
                    ? "— Registrar read permission unavailable"
                    : "— not registered with Cloudflare"
              }
              color={selectedRegistration?.expiresAt && new Date(selectedRegistration.expiresAt).getTime() - Date.now() < 30 * 86_400_000 ? theme.warn : undefined}
            />
            <Field label="Auto renew" value={selectedRegistration?.autoRenew === null || selectedRegistration?.autoRenew === undefined ? "—" : selectedRegistration.autoRenew ? "on" : "off"} />
            <Field label="Reg status" value={selectedRegistration?.status ?? "—"} />
            <Field label="Name servers" value={selectedZone.nameServers.length ? selectedZone.nameServers.join(", ") : "—"} />
          </>
        ) : (
          <text content="Select a zone." fg={theme.textFaint} />
        )}
      </Section>
    </box>
  )

  const workerView = (
    <box style={{ flexGrow: 1, flexDirection: "row" }}>
      <box style={{ width: "36%", flexDirection: "column" }}>
        <Section title={`Workers (${data.workers.length})${titleMeta}`} focused grow={1}>
          <List
            items={data.workers}
            selectedIndex={workerIndex}
            viewportRows={Math.max(1, mainRows - 3)}
            keyFor={(worker) => worker.id}
            focused
            renderRow={(worker, selectedRow) => (
              <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
                <text content="λ " fg={theme.purple} />
                <text content={worker.id} fg={selectedRow ? theme.text : theme.textDim} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                <text content={` ${since(worker.modifiedOn)}`} fg={theme.textFaint} />
              </box>
            )}
            emptyText="No Workers scripts."
          />
        </Section>
      </box>

      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <Section title={selectedWorker ? `Worker · ${selectedWorker.id}` : "Worker"} height={8}>
          {selectedWorker ? (
            <>
              <Field label="Modified" value={selectedWorker.modifiedOn ? `${dateLabel(selectedWorker.modifiedOn)} · ${since(selectedWorker.modifiedOn)} ago` : "—"} />
              <Field label="Created" value={dateLabel(selectedWorker.createdOn)} />
              <Field label="Runtime" value={`${selectedWorker.hasModules ? "modules" : "service worker"} · ${selectedWorker.handlers.join(", ") || "no handlers"}`} />
              <Field label="Build" value={`${selectedWorker.hasAssets ? "assets" : "code only"} · compat ${selectedWorker.compatibilityDate ?? "—"}`} />
              <Field label="Deployed via" value={selectedWorker.lastDeployedFrom ?? "—"} />
              <Field label="Domains" value={selectedWorker.domains.length ? selectedWorker.domains.join(", ") : "—"} />
            </>
          ) : (
            <text content="Select a Worker." fg={theme.textFaint} />
          )}
        </Section>

        <Section title={`Worker deployments (${selectedWorkerDeploys.length})`} grow={1}>
          <List
            items={selectedWorkerDeploys}
            selectedIndex={workerDeployIndex}
            viewportRows={Math.max(1, mainRows - (showDeepDetails ? 17 : 11))}
            keyFor={(deployment) => deployment.id}
            focused={panel === "workers"}
            renderRow={(deployment, selectedRow) => (
              <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
                <text content="↳ " fg={theme.purple} />
                <text content={deployment.message ?? `${deployment.source ?? "deployment"} · ${shortId(deployment.id)}`} fg={selectedRow ? theme.text : theme.textDim} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
                <text content={` ${since(deployment.createdOn)}`} fg={theme.textFaint} />
              </box>
            )}
            emptyText={
              selectedWorker
                ? workerDeployErrors[selectedWorker.id] ?? (workerDeploysLoaded[selectedWorker.id] ? "No deployments found." : "Loading deployments…")
                : "Select a Worker."
            }
          />
        </Section>

        {showDeepDetails && (
          <Section title={selectedWorkerDeploy ? `Worker deployment · ${shortId(selectedWorkerDeploy.id)}` : "Worker deployment"} height={8}>
            {selectedWorkerDeploy ? (
              <>
                <Field label="Created" value={`${dateLabel(selectedWorkerDeploy.createdOn)} · ${since(selectedWorkerDeploy.createdOn)} ago`} />
                <Field label="Source" value={`${selectedWorkerDeploy.source ?? "—"} · ${selectedWorkerDeploy.triggeredBy ?? "unknown trigger"}`} />
                <Field label="Author" value={selectedWorkerDeploy.authorEmail ?? "—"} />
                <Field label="Message" value={selectedWorkerDeploy.message ?? "—"} />
                <Field label="Versions" value={selectedWorkerDeploy.versions.map((version) => `${version.percentage}% ${shortId(version.versionId)}`).join(", ") || "—"} />
                <Field label="ID" value={selectedWorkerDeploy.id} />
              </>
            ) : (
              <text content="Select a Worker deployment." fg={theme.textFaint} />
            )}
          </Section>
        )}
      </box>
    </box>
  )

  return (
    <box style={{ flexGrow: 1, flexDirection: "column" }}>
      <box style={{ height: 1, flexDirection: "row", backgroundColor: theme.bgAlt, paddingLeft: 1 }}>
        {PANELS.map((item) => {
          const active = item.id === panel
          return (
            <text
              key={item.id}
              content={` ${item.label} `}
              fg={active ? theme.bg : theme.textDim}
              bg={active ? theme.brand : undefined}
            />
          )
        })}
        <box style={{ flexGrow: 1 }} />
        {panel === "workers" && <text content="Shift+↑↓ selects deployment " fg={theme.textFaint} />}
      </box>
      {panel === "zones" ? zoneView : panel === "workers" ? workerView : pageView}
    </box>
  )
}
