/**
 * Isolated React contexts for AppState.
 *
 * Kept in a dependency-free module so Vite/Rollup cannot duplicate these
 * contexts across chunks (which would make Provider write to one context
 * while hooks read from another — crashing at startup).
 */
import { createContext } from 'react'
import type { AppStateStore } from './AppStateStore.js'

export const AppStoreContext = createContext<AppStateStore | null>(null)

export const HasAppStateContext = createContext(false)
