/**
 * Plasmo content script entry point for Amazon Relay loadboard.
 *
 * This script is a passive worker — it does nothing until the background
 * scheduler gives it a turn via TAKE_TURN. On each turn it either:
 *   - Runs full search setup (isFirstTime: true) and replies setup_done
 *   - Runs one monitoring pass (isFirstTime: false) and replies monitoring_done
 *
 * When the turn is complete it sends TURN_COMPLETE back to the background,
 * which then activates the next tab.
 */

import type { PlasmoCSConfig } from "plasmo"
import type { SavedSearch } from "~/core/types"
import { randomDelay } from "~/core/automation/dom-utils"
import { runRelaySearch } from "~/loadboards/relay/search-automation"
import { doMonitoringPass } from "~/loadboards/relay/load-monitor"

export const config: PlasmoCSConfig = {
  matches: ["https://relay.amazon.com/loadboard/*"],
  run_at: "document_idle"
}

console.log("[Neblo] Relay loadboard content script loaded — waiting for scheduler turn")

// ============================================
// State
// ============================================

/** Set to false by STOP_AUTOMATION to abort any in-progress work. */
let isActive = false

/** Tracks whether a turn is currently executing (guards against duplicate TAKE_TURN). */
let isBusy = false

function shouldContinue(): boolean {
  return isActive
}

// ============================================
// Turn Execution
// ============================================

async function handleTurn(search: SavedSearch, isFirstTime: boolean): Promise<void> {
  if (isBusy) {
    // Shouldn't happen with a well-behaved scheduler, but guard anyway
    console.warn("[Neblo] Received TAKE_TURN while still busy — notifying done immediately")
    notifyTurnComplete(isFirstTime ? "setup_done" : "monitoring_done")
    return
  }

  isBusy = true
  isActive = true

  try {
    if (isFirstTime) {
      console.log(`[Neblo] Setup turn: "${search.uniqueName}"`)

      // Short random pause — mimics a human noticing the page loaded
      await randomDelay(1500, 3500)
      if (!shouldContinue()) return

      const success = await runRelaySearch(search, shouldContinue)
      console.log(`[Neblo] Setup ${success ? "succeeded" : "aborted"} for: "${search.uniqueName}"`)
    } else {
      console.log(`[Neblo] Monitoring turn: "${search.uniqueName}"`)
      await doMonitoringPass(shouldContinue, search.uniqueName)
    }
  } catch (error) {
    console.error("[Neblo] Unhandled error during turn:", error)
  } finally {
    isBusy = false
    isActive = false
    notifyTurnComplete(isFirstTime ? "setup_done" : "monitoring_done")
  }
}

function notifyTurnComplete(kind: "setup_done" | "monitoring_done"): void {
  chrome.runtime.sendMessage({ type: "TURN_COMPLETE", kind }).catch((err) => {
    console.warn("[Neblo] Failed to send TURN_COMPLETE:", err)
  })
}

// ============================================
// Message Handling
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TAKE_TURN") {
    // Acknowledge immediately so background isn't blocked waiting for a response.
    // The actual completion signal comes later via the TURN_COMPLETE message.
    sendResponse({ received: true })
    handleTurn(message.search as SavedSearch, message.isFirstTime as boolean)
    return false
  }

  if (message.type === "LOADS_TO_BOOK") {
    const loads = message.loads as unknown[]
    console.log(`[Neblo] Received ${loads.length} load(s) to book:`, loads)
    // TODO: implement book button click here. right now that line is removed as to not accidentally book the loads
    sendResponse({ received: true })
    return false
  }

  if (message.type === "STOP_AUTOMATION") {
    isActive = false
    isBusy = false
    sendResponse({ success: true })
    return false
  }

  return true
})
