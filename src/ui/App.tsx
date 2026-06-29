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
    if (key.name === "?") store.setOverlayOpen(!store.overlayOpen)
  })

  if (!splashDone) return <Splash status="Preparing StackPilot…" />

  const rows = Math.max(3, height - 2)

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", backgroundColor: theme.bg }}>
      <box style={{ height: 2, flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
        <text content="StackPilot" fg={theme.text} />
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <Sites rows={rows} />
      </box>
    </box>
  )
}
