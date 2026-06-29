import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export type Route = "home"

interface StoreValue {
  route: Route
  setRoute: (r: Route) => void
  inputMode: boolean
  setInputMode: (v: boolean) => void
  overlayOpen: boolean
  setOverlayOpen: (v: boolean) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>("home")
  const [inputMode, setInputMode] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)

  const value = useMemo(
    () => ({ route, setRoute, inputMode, setInputMode, overlayOpen, setOverlayOpen }),
    [route, inputMode, overlayOpen],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error("StoreProvider missing")
  return store
}
