// Centralized color palette + status helpers. Tweaking these restyles the whole app.
// The palette can evolve as StackPilot's identity settles.

import type { ProviderId } from "../domain.ts"

export const theme = {
  brand: "#00d18f",
  brandDim: "#0a8f64",
  accent: "#5ec8ff", // sky blue for highlights/links
  text: "#e6edf3",
  textDim: "#8b949e",
  textFaint: "#586069",
  bg: "#0d1117",
  bgAlt: "#161b22",
  bgPanel: "#11161d",
  border: "#30363d",
  borderActive: "#00d18f",
  selectedBg: "#1f6f53",
  good: "#3fb950",
  warn: "#d29922",
  bad: "#f85149",
  info: "#5ec8ff",
  purple: "#bc8cff",
} as const

// Brand colors + list glyphs for each provider, used wherever sites from
// multiple providers appear side by side.
export const providerColor: Record<ProviderId, string> = {
  vercel: "#e6edf3",
  netlify: "#00c7b7",
  cloudflare: "#f38020",
}

export const providerGlyph: Record<ProviderId, string> = {
  vercel: "▲",
  netlify: "◆",
  cloudflare: "◉",
}

// Status vocabularies across Vercel (READY/BUILDING/ERROR), Netlify
// (ready/building/error/new/enqueued), and Cloudflare (success/failure/active,
// zone active/paused), lowercased.
const GOOD = ["connected", "deployed", "provisioned", "completed", "active", "success", "succeeded", "ready", "current", "published"]
const WARN = ["connecting", "provisioning", "deploying", "queued", "running", "pending", "in_progress", "building", "enqueued", "processing", "uploading", "uploaded", "preparing", "new", "initializing", "retrying", "paused"]
const BAD = ["disconnected", "failed", "failure", "errored", "error", "offline", "canceled", "cancelled", "crashed", "deleted"]

// Map an arbitrary status/connection string to a semantic color.
export function statusColor(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase()
  if (GOOD.includes(s)) return theme.good
  if (WARN.includes(s)) return theme.warn
  if (BAD.includes(s)) return theme.bad
  return theme.textDim
}

// A small colored dot used throughout the UI to denote status at a glance.
export function statusDot(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase()
  if (GOOD.includes(s)) return "●"
  if (WARN.includes(s)) return "◐"
  if (BAD.includes(s)) return "✕"
  return "○"
}

// Color a disk-usage percentage: green < 70, amber < 90, red otherwise.
export function diskColor(pct: number): string {
  if (pct < 70) return theme.good
  if (pct < 90) return theme.warn
  return theme.bad
}
