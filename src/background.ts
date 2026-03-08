/**
 * Neblo Extension — Background Service Worker
 *
 * Responsibilities:
 *  1. Poll GET /searches every 5 seconds and sync to local storage.
 *  2. Open one Relay tab per search when scrape_status === "start".
 *  3. Run a turn-based scheduler: tabs must be active (focused) for the
 *     Relay site to work, so only one tab does work at a time.
 *
 * Scheduler phases (per tab, in order):
 *   Setup   — activate tab → TAKE_TURN { isFirstTime: true }
 *             → wait for TURN_COMPLETE { kind: "setup_done" } → next tab
 *   Monitor — rotate through ready tabs, same TAKE_TURN pattern but
 *             isFirstTime: false → one scan+refresh pass → next tab
 *
 * If a search is updated (isUpdated && version changed), the tab is
 * re-queued for a setup turn at the front of the setup queue.
 */

import { RELAY_URL } from "~/loadboards/relay/selectors"
import { createApiClient } from "~/core/api/client"
import type { ApiClient } from "~/core/api/client"
import type { AuthState, SavedSearch } from "~/core/types"
import { saveSavedSearches } from "~/core/storage"

console.log("[Neblo Extension] Background script loaded")

// ============================================
// API Client
// ============================================

let apiClient: ApiClient = createApiClient()

async function initApiClient(): Promise<void> {
  try {
    const result = await chrome.storage.local.get("authState")
    const auth = result.authState as AuthState | undefined

    if (auth?.isLoggedIn && auth.token && auth.companyId) {
      apiClient.reconfigure(
        { useMock: false },
        { token: auth.token, companyCode: auth.companyId }
      )
      console.log("[Neblo Extension] API client configured (real mode)")
    } else {
      console.log("[Neblo Extension] API client using mock mode")
    }
  } catch (error) {
    console.warn("[Neblo Extension] Failed to init API client, using mock:", error)
  }
}

// ============================================
// Tab & Search State
// ============================================

/** uniqueName → tabId */
const searchTabMap = new Map<string, number>()
/** tabId → SavedSearch */
const tabSearchMap = new Map<number, SavedSearch>()

// ============================================
// Scheduler State
// ============================================

/** Tabs that need a setup turn, in FIFO order. */
const setupQueue: number[] = []

/**
 * Tabs that have completed setup and are in the monitoring rotation.
 * The scheduler cycles through these round-robin.
 */
const monitorOrder: number[] = []

/** Index into monitorOrder for the next monitoring turn. */
let monitorCursor = 0

/** The tabId that currently holds the active turn (null when idle). */
let currentTurnTabId: number | null = null

/** Safety timeout handle — forces the turn to end if a tab takes too long. */
let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null

/** Whether a next-turn has already been scheduled (prevents stacking). */
let nextTurnScheduled = false

// ============================================
// Scheduler
// ============================================

function scheduleNextTurn(delayMs = 1000): void {
  if (nextTurnScheduled) return
  nextTurnScheduled = true
  setTimeout(() => {
    nextTurnScheduled = false
    giveNextTurn()
  }, delayMs)
}

function giveNextTurn(): void {
  if (currentTurnTabId !== null) return // a turn is already active

  // Priority: setup queue before monitoring rotation
  let nextTabId: number | null = null

  if (setupQueue.length > 0) {
    nextTabId = setupQueue[0]!
  } else if (monitorOrder.length > 0) {
    monitorCursor = monitorCursor % monitorOrder.length
    nextTabId = monitorOrder[monitorCursor]!
    monitorCursor++
  }

  if (!nextTabId) {
    // Nothing to do — re-check after a short pause
    scheduleNextTurn(3000)
    return
  }

  currentTurnTabId = nextTabId
  const search = tabSearchMap.get(nextTabId)

  if (!search) {
    endTurn(nextTabId)
    return
  }

  const isFirstTime = setupQueue.includes(nextTabId)

  console.log(
    `[Neblo Extension] Giving turn to tab ${nextTabId} — "${search.uniqueName}" ` +
    `(${isFirstTime ? "setup" : "monitoring"})`
  )

  // Focus the browser window, then activate the tab
  chrome.tabs.get(nextTabId).then((tab) => {
    return chrome.windows.update(tab.windowId, { focused: true })
  }).then(() => {
    return chrome.tabs.update(nextTabId!, { active: true })
  }).then(() => {
    // Small pause for the tab to gain focus before receiving its turn
    setTimeout(() => {
      chrome.tabs.sendMessage(nextTabId!, {
        type: "TAKE_TURN",
        search,
        isFirstTime
      }).catch((err) => {
        console.warn(`[Neblo Extension] TAKE_TURN send failed for tab ${nextTabId}:`, err)
        endTurn(nextTabId!)
      })
    }, 600)
  }).catch(() => {
    endTurn(nextTabId!)
  })

  // Safety valve: force-advance after 10 minutes if the tab never responds
  if (safetyTimeoutId) clearTimeout(safetyTimeoutId)
  safetyTimeoutId = setTimeout(() => {
    safetyTimeoutId = null
    if (currentTurnTabId === nextTabId) {
      console.warn(`[Neblo Extension] Turn timeout for tab ${nextTabId} — advancing`)
      endTurn(nextTabId!)
    }
  }, 10 * 60 * 1000)
}

/**
 * Called when a tab's turn is over (either naturally or via timeout/error).
 * kind === "setup_done" moves the tab from setupQueue into monitorOrder.
 */
function endTurn(tabId: number, kind?: "setup_done" | "monitoring_done"): void {
  if (safetyTimeoutId) {
    clearTimeout(safetyTimeoutId)
    safetyTimeoutId = null
  }

  if (currentTurnTabId !== tabId) return
  currentTurnTabId = null

  if (kind === "setup_done") {
    const idx = setupQueue.indexOf(tabId)
    if (idx >= 0) setupQueue.splice(idx, 1)

    if (!monitorOrder.includes(tabId)) {
      monitorOrder.push(tabId)
      console.log(`[Neblo Extension] Tab ${tabId} moved to monitoring rotation`)
    }
  }

  // Small gap between turns — feels more natural, less hammering
  scheduleNextTurn(1200)
}

// ============================================
// Search Polling
// ============================================

let pollingIntervalId: ReturnType<typeof setInterval> | null = null

async function pollSearches(): Promise<void> {
  try {
    const response = await apiClient.getSearches()
    if (!response.success || !response.data) {
      console.warn("[Neblo Extension] getSearches failed:", response.error)
      return
    }

    const { scrape_status, searches } = response.data
    const relaySearches = searches.filter((s) => s.loadboardId === "relay")

    // Always persist latest searches for content scripts to read
    await saveSavedSearches(relaySearches)

    if (scrape_status === "stop") {
      await stopAllSearchTabs()
      return
    }

    // ── Close tabs whose searches were removed from the API response ──
    for (const [uniqueName, tabId] of searchTabMap.entries()) {
      if (!relaySearches.some((s) => s.uniqueName === uniqueName)) {
        await removeSearchTab(tabId, uniqueName)
      }
    }

    // ── Handle each active search ──
    for (const search of relaySearches) {
      const existingTabId = searchTabMap.get(search.uniqueName)

      if (existingTabId !== undefined) {
        // Tab already exists — check if the search was updated
        const current = tabSearchMap.get(existingTabId)

        if (search.isUpdated && current?.version !== search.version) {
          tabSearchMap.set(existingTabId, search)

          // Re-queue for setup unless already queued or currently running
          const alreadyQueued = setupQueue.includes(existingTabId)
          const isActive = currentTurnTabId === existingTabId

          if (!alreadyQueued && !isActive) {
            // Pull out of monitoring rotation and push to setup queue
            const idx = monitorOrder.indexOf(existingTabId)
            if (idx >= 0) monitorOrder.splice(idx, 1)

            setupQueue.push(existingTabId)
            console.log(
              `[Neblo Extension] Re-queued tab ${existingTabId} for ` +
              `updated search "${search.uniqueName}" (v${search.version})`
            )

            // Kick the scheduler in case it was idle
            if (!currentTurnTabId) scheduleNextTurn(500)
          }
        }
      } else {
        // No tab open — create one (starts inactive so the scheduler controls activation)
        const tab = await chrome.tabs.create({ url: RELAY_URL, active: false })

        if (tab.id) {
          searchTabMap.set(search.uniqueName, tab.id)
          tabSearchMap.set(tab.id, search)

          console.log(
            `[Neblo Extension] Opened tab ${tab.id} for search "${search.uniqueName}"`
          )

          // Wait for the tab to finish loading, then enqueue for setup
          chrome.tabs.onUpdated.addListener(function onTabReady(tabId, changeInfo) {
            if (tabId !== tab.id || changeInfo.status !== "complete") return
            chrome.tabs.onUpdated.removeListener(onTabReady)

            setupQueue.push(tab.id!)
            console.log(`[Neblo Extension] Tab ${tab.id} loaded — queued for setup`)

            if (!currentTurnTabId) scheduleNextTurn(500)
          })
        }
      }
    }
  } catch (error) {
    console.error("[Neblo Extension] Error in pollSearches:", error)
  }
}

// ============================================
// Tab Management Helpers
// ============================================

async function removeSearchTab(tabId: number, uniqueName: string): Promise<void> {
  try { await chrome.tabs.sendMessage(tabId, { type: "STOP_AUTOMATION" }) } catch { /* gone */ }
  try { await chrome.tabs.remove(tabId) } catch { /* gone */ }

  searchTabMap.delete(uniqueName)
  tabSearchMap.delete(tabId)

  const setupIdx = setupQueue.indexOf(tabId)
  if (setupIdx >= 0) setupQueue.splice(setupIdx, 1)

  const monitorIdx = monitorOrder.indexOf(tabId)
  if (monitorIdx >= 0) monitorOrder.splice(monitorIdx, 1)

  if (currentTurnTabId === tabId) {
    currentTurnTabId = null
    scheduleNextTurn(500)
  }

  console.log(`[Neblo Extension] Removed tab ${tabId} for search "${uniqueName}"`)
}

async function stopAllSearchTabs(): Promise<void> {
  if (safetyTimeoutId) { clearTimeout(safetyTimeoutId); safetyTimeoutId = null }
  currentTurnTabId = null
  nextTurnScheduled = false

  for (const [uniqueName, tabId] of searchTabMap.entries()) {
    try { await chrome.tabs.sendMessage(tabId, { type: "STOP_AUTOMATION" }) } catch { /* gone */ }
    try { await chrome.tabs.remove(tabId) } catch { /* gone */ }
    console.log(`[Neblo Extension] Stopped tab for search "${uniqueName}"`)
  }

  searchTabMap.clear()
  tabSearchMap.clear()
  setupQueue.length = 0
  monitorOrder.length = 0
  monitorCursor = 0
}

// ============================================
// Tab Removal Cleanup
// ============================================

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [uniqueName, tid] of searchTabMap.entries()) {
    if (tid !== tabId) continue

    searchTabMap.delete(uniqueName)
    tabSearchMap.delete(tabId)

    const setupIdx = setupQueue.indexOf(tabId)
    if (setupIdx >= 0) setupQueue.splice(setupIdx, 1)

    const monitorIdx = monitorOrder.indexOf(tabId)
    if (monitorIdx >= 0) monitorOrder.splice(monitorIdx, 1)

    if (currentTurnTabId === tabId) {
      currentTurnTabId = null
      scheduleNextTurn(1000)
    }

    console.log(`[Neblo Extension] Tab ${tabId} closed (search: "${uniqueName}")`)
    break
  }
})

// ============================================
// Message Handling
// ============================================

chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  // ── Scheduler response from content script ──
  if (message.type === "TURN_COMPLETE") {
    const tabId = sender.tab?.id
    if (tabId !== undefined) {
      endTurn(tabId, message.kind as "setup_done" | "monitoring_done")
    }
    sendResponse({ ok: true })
    return false
  }

  // ── Proxied API calls (avoids CORS in content scripts) ──
  if (message.type === "API_CALL") {
    handleFetch(message.params).then(sendResponse)
    return true
  }

  if (message.type === "API_GET_CREDENTIALS") {
    apiClient.getCredentials(message.companyName).then(sendResponse)
    return true
  }

  if (message.type === "API_GET_2FA_CODE") {
    apiClient.get2FACode(message.companyName).then(sendResponse)
    return true
  }

  if (message.type === "API_GET_SEARCHES") {
    apiClient.getSearches().then(sendResponse)
    return true
  }

  if (message.type === "API_SEND_LOADS") {
    apiClient
      .sendLoads(message.companyName, message.searchUniqueName, message.loads)
      .then(sendResponse)
    return true
  }

  if (message.type === "ERROR") {
    console.error("[Neblo Extension] Error from content script:", message.error)
    return false
  }

  return true
})

// ============================================
// Fetch Proxy
// ============================================

async function handleFetch(params: {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}) {
  try {
    const response = await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body
    })
    const contentType = response.headers.get("content-type")
    const data = contentType?.includes("application/json")
      ? await response.json()
      : await response.text()
    return { success: response.ok, status: response.status, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================
// Startup
// ============================================

async function startup(): Promise<void> {
  await initApiClient()

  // Poll immediately, then every 5 seconds
  await pollSearches()
  pollingIntervalId = setInterval(pollSearches, 5000)
}

startup()
