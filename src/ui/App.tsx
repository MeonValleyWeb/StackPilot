import { useEffect, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { theme } from "../lib/theme.ts"
import { useStore } from "./store.tsx"
import { Splash } from "./Splash.tsx"
import { Sites } from "./views/Sites.tsx"

const MIN_SPLASH_MS = 700

export function App() {
  const store = useStore()
  const renderer = useRenderer()
  const { height } = useTerminalDimensions()
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

    if (key.ctrl && key.name === "c") {
      return quit()
    }
    if (key.name === "q") return quit()
    if (key.name === "1") return store.setRoute("dashboard")
    if (key.name === "2") return store.setRoute("vercel")
    if (key.name === "3") return store.setRoute("netlify")
    if (key.name === "4") return store.setRoute("cloudflare")
    if (key.name === "?") store.setOverlayOpen(!store.overlayOpen)
  })

  if (!splashDone) return <Splash status="Preparing StackPilot…" />

  const rows = Math.max(3, height - 2)

  function ProviderPage({ title, subtitle }: { title: string; subtitle: string }) {
    return (
      <box style={{ flexGrow: 1, flexDirection: "column", paddingLeft: 1, paddingRight: 1 }}>
        <box style={{ height: 1, flexDirection: "row" }}>
          <text content={title} fg={theme.brand} />
        </box>
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <text content={subtitle} fg={theme.textDim} />
          <text content="This page will hold provider-specific summaries, recent activity, and actions." fg={theme.textFaint} />
          <text content="Press 1 for Dashboard." fg={theme.textFaint} />
        </box>
      </box>
    )
  }

  const page = (() => {
    switch (store.route) {
      case "vercel":
        return <ProviderPage title="Vercel" subtitle="Projects, deployments, usage, and errors." />
      case "netlify":
        return <ProviderPage title="Netlify" subtitle="Sites, deploys, functions, and logs." />
      case "cloudflare":
        return <ProviderPage title="Cloudflare" subtitle="Zones, DNS, analytics, and account data." />
      case "dashboard":
      default:
        return <Sites rows={rows} />
    }
  })()

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", backgroundColor: theme.bg }}>
      <box style={{ height: 2, flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
        <text content="StackPilot" fg={theme.text} />
        <text content={`  1 Dashboard  2 Vercel  3 Netlify  4 Cloudflare`} fg={theme.textDim} />
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        {page}
      </box>
    </box>
  )
}
