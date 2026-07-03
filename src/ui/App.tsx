import { useEffect, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { providerGlyph, theme } from "../lib/theme.ts"
import { useStore, type Route } from "./store.tsx"
import { useData, type ProviderState } from "./data.tsx"
import { Splash } from "./Splash.tsx"
import { StatusBar, type KeyHint } from "./StatusBar.tsx"
import { Dashboard } from "./views/Dashboard.tsx"
import { Vercel } from "./views/Vercel.tsx"
import { Netlify } from "./views/Netlify.tsx"
import { Cloudflare } from "./views/Cloudflare.tsx"
import { since } from "./parts.tsx"

const MIN_SPLASH_MS = 700

const TABS: Array<{ route: Route; key: string; label: string }> = [
  { route: "dashboard", key: "1", label: "Dashboard" },
  { route: "vercel", key: "2", label: "Vercel" },
  { route: "netlify", key: "3", label: "Netlify" },
  { route: "cloudflare", key: "4", label: "Cloudflare" },
]

const HINTS: Record<Route, KeyHint[]> = {
  dashboard: [
    { key: "↑↓", label: "move" },
    { key: "Tab", label: "panel" },
    { key: "⏎", label: "go to provider" },
    { key: "o", label: "open url" },
    { key: "d", label: "open deploy" },
  ],
  vercel: [
    { key: "↑↓", label: "move" },
    { key: "Tab", label: "panel" },
    { key: "o", label: "open url" },
    { key: "g", label: "repo" },
    { key: "d", label: "inspector" },
  ],
  netlify: [
    { key: "↑↓", label: "move" },
    { key: "Tab", label: "panel" },
    { key: "o", label: "open url" },
    { key: "g", label: "repo" },
    { key: "a", label: "admin" },
    { key: "d", label: "deploy" },
  ],
  cloudflare: [
    { key: "↑↓", label: "move" },
    { key: "Tab", label: "panel" },
    { key: "o", label: "open url" },
    { key: "g", label: "repo" },
    { key: "a", label: "dash" },
    { key: "d", label: "deployment" },
  ],
}

// One dot per provider in the header: green = loaded, amber = loading,
// red = error, faint = no token.
function healthColor(state: ProviderState): string {
  if (!state.configured) return theme.textFaint
  if (state.loading) return theme.warn
  if (state.error) return theme.bad
  return theme.good
}

function Help() {
  const lines: Array<[string, string]> = [
    ["1-4", "switch page (Dashboard / Vercel / Netlify / Cloudflare)"],
    ["Tab", "cycle panels within a page"],
    ["↑↓ / j k", "move selection"],
    ["⏎", "dashboard: jump to the selected site's provider page"],
    ["o", "open site url in browser"],
    ["g", "open git repo"],
    ["d", "open deploy inspector / logs page"],
    ["a", "open provider admin/dashboard (Netlify, Cloudflare)"],
    ["r", "refresh all providers"],
    ["?", "toggle this help"],
    ["q", "quit"],
  ]
  return (
    <box style={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}>
      <box title=" Keyboard " style={{ border: true, borderStyle: "rounded", borderColor: theme.brand, flexDirection: "column", paddingLeft: 2, paddingRight: 2, paddingTop: 1, paddingBottom: 1 }}>
        {lines.map(([key, label]) => (
          <box key={key} style={{ flexDirection: "row", height: 1 }}>
            <text content={key.padEnd(10)} fg={theme.brand} />
            <text content={label} fg={theme.textDim} />
          </box>
        ))}
      </box>
    </box>
  )
}

export function App() {
  const store = useStore()
  const data = useData()
  const renderer = useRenderer()
  const { height, width } = useTerminalDimensions()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setSplashDone(true), MIN_SPLASH_MS)
    return () => clearTimeout(id)
  }, [])

  useKeyboard((key) => {
    const quit = () => {
      try {
        renderer.destroy?.()
      } catch {}
      process.exit(0)
    }

    if (key.ctrl && key.name === "c") return quit()
    if (key.name === "q") return quit()
    const tab = TABS.find((t) => t.key === key.name)
    if (tab) {
      store.setOverlayOpen(false)
      return store.setRoute(tab.route)
    }
    if (key.name === "r") return data.refresh()
    if (key.name === "escape" && store.overlayOpen) return store.setOverlayOpen(false)
    if (key.name === "?") store.setOverlayOpen(!store.overlayOpen)
  })

  if (!splashDone) return <Splash status="Preparing StackPilot…" />

  // Header + footer are one row each; the rest belongs to the active page.
  const rows = Math.max(3, height - 2)

  const page = (() => {
    if (store.overlayOpen) return <Help />
    switch (store.route) {
      case "vercel":
        return <Vercel rows={rows} />
      case "netlify":
        return <Netlify rows={rows} />
      case "cloudflare":
        return <Cloudflare rows={rows} />
      case "dashboard":
      default:
        return <Dashboard rows={rows} />
    }
  })()

  const anyLoading = data.providers.some((p) => p.loading)
  const firstError = data.providers.find((p) => p.error)
  const footerMessage = firstError
    ? `${firstError.name}: ${firstError.error}`
    : anyLoading
      ? "refreshing…"
      : data.lastUpdated
        ? `updated ${since(data.lastUpdated)} ago`
        : undefined

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", backgroundColor: theme.bg }}>
      <box style={{ height: 1, flexDirection: "row", paddingLeft: 1, paddingRight: 1, backgroundColor: theme.bgAlt }}>
        <text content="⏣ StackPilot " fg={theme.brand} />
        {TABS.map((tab) => {
          const active = store.route === tab.route && !store.overlayOpen
          return (
            <box key={tab.route} style={{ flexDirection: "row" }}>
              <text
                content={` ${tab.key} ${tab.label} `}
                fg={active ? theme.bg : theme.textDim}
                bg={active ? theme.brand : undefined}
              />
              <text content=" " />
            </box>
          )
        })}
        <box style={{ flexGrow: 1 }} />
        {width > 70 &&
          data.providers.map((p) => (
            <text key={p.id} content={`${providerGlyph[p.id]} `} fg={healthColor(p)} />
          ))}
      </box>

      <box style={{ flexGrow: 1, flexDirection: "column" }}>{page}</box>

      <StatusBar
        hints={HINTS[store.route]}
        message={footerMessage}
        messageColor={firstError ? theme.bad : theme.textFaint}
        compact={width < 110}
      />
    </box>
  )
}
