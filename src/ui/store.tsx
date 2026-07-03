import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export type Route = "dashboard" | "vercel" | "netlify" | "cloudflare"

interface StoreValue {
  route: Route
  setRoute: (r: Route) => void
  inputMode: boolean
  setInputMode: (v: boolean) => void
  overlayOpen: boolean
  setOverlayOpen: (v: boolean) => void
  // Set when jumping from the dashboard to a provider page so the target view
  // can pre-select that site, then clear it.
  focusSiteId: string | null
  setFocusSiteId: (id: string | null) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>("dashboard")
  const [inputMode, setInputMode] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [focusSiteId, setFocusSiteId] = useState<string | null>(null)

  const value = useMemo(
    () => ({ route, setRoute, inputMode, setInputMode, overlayOpen, setOverlayOpen, focusSiteId, setFocusSiteId }),
    [route, inputMode, overlayOpen, focusSiteId],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error("StoreProvider missing")
  return store
}
