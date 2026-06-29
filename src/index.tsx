#!/usr/bin/env bun
// Entry point. Boots the OpenTUI renderer and mounts the main app wrapped in
// the data store.

import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import pkg from "../package.json" with { type: "json" }
import { StoreProvider } from "./ui/store.tsx"
import { App } from "./ui/App.tsx"
console.log(`StackPilot v${pkg.version}`)

function Root() {
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  )
}

const renderer = await createCliRenderer()
createRoot(renderer).render(<Root />)
