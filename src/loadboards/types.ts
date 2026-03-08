/**
 * Interface contract that every loadboard implementation must follow.
 * Ensures consistent structure across Relay, and any future loadboards.
 */

import type { SearchPreferences } from "~/core/types"

export interface LoadboardAutomation {
  /** Unique identifier for this loadboard (e.g. "relay") */
  readonly id: string

  /** URL to open when starting automation for this loadboard */
  readonly url: string

  /**
   * Execute a search with the given preferences.
   * Returns true if the search was set up successfully.
   */
  runSearch(
    preferences: SearchPreferences,
    shouldContinue: () => boolean
  ): Promise<boolean>

  /**
   * Monitor the loadboard for new loads after a search is active.
   * Calls onLoadsProcessed whenever new loads are found.
   */
  monitorLoads(
    shouldContinue: () => boolean,
    onLoadsProcessed?: (count: number) => void
  ): Promise<void>
}
