// Small building blocks shared by the dashboard and provider views: bordered
// panels, label/value stats, relative timestamps, and deploy list rows.

import type { ReactNode } from "react"
import { providerColor, providerGlyph, statusColor, statusDot, theme } from "../lib/theme.ts"
import type { Deploy, Site } from "../domain.ts"

export function Section({
  title,
  focused,
  children,
  grow,
  width,
  height,
}: {
  title: string
  focused?: boolean
  children: ReactNode
  grow?: number
  width?: number | `${number}%`
  height?: number | `${number}%`
}) {
  return (
    <box
      title={` ${title} `}
      style={{
        border: true,
        borderStyle: "rounded",
        borderColor: focused ? theme.brand : theme.border,
        flexDirection: "column",
        flexGrow: grow,
        flexShrink: 1,
        width,
        height,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {children}
    </box>
  )
}

// "key value" line, e.g. "Repo    owner/name". Keys align at `pad` chars.
export function Field({ label, value, color, pad = 10 }: { label: string; value: string; color?: string; pad?: number }) {
  return (
    <box style={{ flexDirection: "row", height: 1 }}>
      <text content={label.padEnd(pad)} fg={theme.textFaint} wrapMode="none" />
      <text content={value} fg={color ?? theme.text} wrapMode="none" style={{ flexShrink: 1 }} />
    </box>
  )
}

export function since(iso: string | null | undefined): string {
  if (!iso) return "never"
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.round(hrs / 24)}d`
}

// One row in a site list: status dot, name, right-aligned age.
export function SiteRow({ site, selected, showProvider }: { site: Site; selected: boolean; showProvider?: boolean }) {
  return (
    <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
      {showProvider && <text content={`${providerGlyph[site.provider.id]} `} fg={providerColor[site.provider.id]} />}
      <text content={`${statusDot(site.status)} `} fg={statusColor(site.status)} />
      <text content={site.name} fg={selected ? theme.text : theme.textDim} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
      {site.stack ? <text content={` ${site.stack}`} fg={theme.textFaint} wrapMode="none" /> : null}
      <text content={` ${since(site.lastDeploy)}`} fg={theme.textFaint} />
    </box>
  )
}

// One row in a deploy list: status, site (optional), branch/target, age.
export function DeployRow({ deploy, selected, showSite }: { deploy: Deploy; selected: boolean; showSite?: boolean }) {
  const label = showSite
    ? `${deploy.siteName}${deploy.branch ? ` · ${deploy.branch}` : ""}`
    : `${deploy.branch ?? deploy.target ?? deploy.status}${deploy.target && deploy.branch ? ` · ${deploy.target}` : ""}`
  return (
    <box style={{ flexDirection: "row", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
      {showSite && <text content={`${providerGlyph[deploy.provider]} `} fg={providerColor[deploy.provider]} />}
      <text content={`${statusDot(deploy.status)} `} fg={statusColor(deploy.status)} />
      <text content={label} fg={selected ? theme.text : theme.textDim} wrapMode="none" style={{ flexGrow: 1, flexShrink: 1 }} />
      <text content={` ${deploy.status.toLowerCase()}`} fg={statusColor(deploy.status)} wrapMode="none" />
      <text content={` ${since(deploy.createdAt)}`} fg={theme.textFaint} />
    </box>
  )
}

// Centered helper for panels with nothing to show (missing token, errors, …).
export function EmptyPanel({ text, color }: { text: string; color?: string }) {
  return (
    <box style={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}>
      <text content={text} fg={color ?? theme.textFaint} wrapMode="word" />
    </box>
  )
}
