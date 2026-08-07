/**
 * Singleton gate for global config reads.
 *
 * Kept in a tiny dependency-free module so Vite/Rollup cannot duplicate this
 * mutable flag across chunks. If `enableConfigs()` flips one copy while
 * `getConfig()` checks another, startup crashes with
 * "Config accessed before allowed."
 */

let configReadingAllowed = false

export function isConfigReadingAllowed(): boolean {
  return configReadingAllowed
}

export function allowConfigReading(): void {
  configReadingAllowed = true
}
