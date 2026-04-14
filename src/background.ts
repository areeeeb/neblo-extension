/**
 * Neblo Extension — Background Service Worker
 *
 * Responsibilities:
 *  1. Poll POST /searches every 5 seconds and sync to local storage.
 *  2. Open one Relay tab per unique search when scrape_status === "start".
 *  3. Run a turn-based scheduler: tabs must be active (focused) for the
 *     Relay site to work, so only one tab does work at a time.
 *
 * Tab assignments (uniqueName ↔ tabId) are persisted to chrome.storage.local
 * so they survive service worker restarts. On startup, stale tabs are pruned.
 *
 * If a search is updated (isUpdated && version changed), the old tab is closed
 * and a fresh tab is opened + queued for setup.
 */

import { RELAY_URL, AMAZON_SIGNIN_URLS } from "~/loadboards/relay/selectors"
import { createApiClient } from "~/core/api/client"
import type { ApiClient } from "~/core/api/client"
import type { SavedSearch } from "~/core/types"
import { saveSavedSearches, saveAuthState, getScrapeOverride, getApiConfig } from "~/core/storage"

console.log("[Neblo Extension] Background script loaded")

/** Cached scrape override from options page — refreshed each poll cycle. */
let scrapeOverrideEnabled = false

// ============================================
// API Client
// ============================================

let apiClient: ApiClient = createApiClient()

async function initApiClient(): Promise<void> {
  try {
    const config = await getApiConfig()

    if (config.apiKey && config.companyCode && config.adapterCode) {
      apiClient.reconfigure(
        { baseUrl: config.baseUrl },
        { apiKey: config.apiKey, companyCode: config.companyCode, adapterCode: config.adapterCode }
      )
      console.log("[Neblo Extension] API client configured")
    } else {
      console.log("[Neblo Extension] API config incomplete — polling will return errors until configured")
    }
  } catch (error) {
    console.warn("[Neblo Extension] Failed to init API client:", error)
  }
}

// Re-init the API client whenever apiConfig changes in storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.apiConfig) {
    console.log("[Neblo Extension] API config changed — reconfiguring client")
    initApiClient()
  }
})

// ============================================
// Login State
// ============================================

/** The tab being used for the login flow (null when not logging in). */
let loginTabId: number | null = null

// ============================================
// Tab & Search State
// ============================================

/** uniqueName → tabId */
const searchTabMap = new Map<string, number>()
/** tabId → SavedSearch */
const tabSearchMap = new Map<number, SavedSearch>()

// ============================================
// Tab Assignment Persistence
// ============================================

interface TabAssignment {
  uniqueName: string
  tabId: number
  search: SavedSearch
}

/** Persist current tab ↔ search mappings to chrome.storage.local. */
async function persistTabAssignments(): Promise<void> {
  const assignments: TabAssignment[] = []
  for (const [uniqueName, tabId] of searchTabMap.entries()) {
    const search = tabSearchMap.get(tabId)
    if (search) {
      assignments.push({ uniqueName, tabId, search })
    }
  }
  await chrome.storage.local.set({ tabAssignments: assignments })
}

/**
 * Restore tab assignments from storage on startup.
 * Verifies each tab still exists; prunes stale entries.
 */
async function restoreTabAssignments(): Promise<void> {
  const result = await chrome.storage.local.get("tabAssignments")
  const assignments = (result.tabAssignments || []) as TabAssignment[]

  for (const { uniqueName, tabId, search } of assignments) {
    try {
      await chrome.tabs.get(tabId)
      searchTabMap.set(uniqueName, tabId)
      tabSearchMap.set(tabId, search)
      // Re-queue for setup — content script's tryLoadSavedSearch handles the fast path
      setupQueue.push(tabId)
      console.log(`[Neblo Extension] Restored tab ${tabId} for "${uniqueName}"`)
    } catch {
      console.log(`[Neblo Extension] Tab ${tabId} gone for "${uniqueName}" — will be recreated`)
    }
  }

  await persistTabAssignments()

  if (setupQueue.length > 0) {
    scheduleNextTurn(1000)
  }
}

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
let loadsToBookIntervalId: ReturnType<typeof setInterval> | null = null

async function pollSearches(): Promise<void> {
  try {
    const response = await apiClient.getSearches()
    if (!response.success || !response.data) {
      // Silently skip if API not configured (avoids log spam on startup)
      if (response.error?.includes("not configured")) return
      console.warn("[Neblo Extension] getSearches failed:", response.error)
      return
    }

    const { scrape_status, searches } = response.data
    const relaySearches = searches.filter((s) => s.loadboardId === "relay")

    // Always persist latest searches for content scripts to read
    await saveSavedSearches(relaySearches)

    // Scrape if API says "start" OR if the options page override is on
    scrapeOverrideEnabled = await getScrapeOverride()
    if (scrape_status === "stop" && !scrapeOverrideEnabled) {
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
        const current = tabSearchMap.get(existingTabId)

        if (search.isUpdated && current?.version !== search.version) {
          // Search updated — close old tab and open a fresh one
          console.log(
            `[Neblo Extension] Search "${search.uniqueName}" updated ` +
            `(v${current?.version} → v${search.version}) — replacing tab`
          )
          await removeSearchTab(existingTabId, search.uniqueName)
          await openSearchTab(search)
        } else {
          // Keep existing tab, just refresh the search data
          tabSearchMap.set(existingTabId, search)
        }
      } else {
        // No tab open for this uniqueName — create one
        await openSearchTab(search)
      }
    }
  } catch (error) {
    console.error("[Neblo Extension] Error in pollSearches:", error)
  }
}

// ============================================
// Loads-to-Book Polling
// ============================================

async function pollLoadsToBook(): Promise<void> {
  try {
    const response = await apiClient.getLoadsToBook()
    if (!response.success || !response.data) {
      if (response.error?.includes("not configured")) return
      console.warn("[Neblo Extension] getLoadsToBook failed:", response.error)
      return
    }

    const { loads } = response.data
    if (loads.length > 0) {
      console.log(
        `[Neblo Extension] ${loads.length} load(s) to book:`,
        JSON.stringify(loads)
      )

      // Broadcast to all active scraping tabs
      for (const tabId of [...searchTabMap.values()]) {
        chrome.tabs.sendMessage(tabId, { type: "LOADS_TO_BOOK", loads }).catch(() => {
          /* tab may not be ready yet */
        })
      }
    }
  } catch (error) {
    console.error("[Neblo Extension] Error in pollLoadsToBook:", error)
  }
}

// ============================================
// Tab Management Helpers
// ============================================

/**
 * Open a new Relay tab for a search, track it, and queue for setup once loaded.
 */
async function openSearchTab(search: SavedSearch): Promise<void> {
  const tab = await chrome.tabs.create({ url: RELAY_URL, active: false })

  if (tab.id) {
    searchTabMap.set(search.uniqueName, tab.id)
    tabSearchMap.set(tab.id, search)
    await persistTabAssignments()

    console.log(
      `[Neblo Extension] Opened tab ${tab.id} for search "${search.uniqueName}"`
    )

    chrome.tabs.onUpdated.addListener(function onTabReady(tabId, changeInfo) {
      if (tabId !== tab.id || changeInfo.status !== "complete") return
      chrome.tabs.onUpdated.removeListener(onTabReady)

      setupQueue.push(tab.id!)
      console.log(`[Neblo Extension] Tab ${tab.id} loaded — queued for setup`)

      if (!currentTurnTabId) scheduleNextTurn(500)
    })
  }
}

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

  await persistTabAssignments()
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

  await persistTabAssignments()
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

    persistTabAssignments() // fire-and-forget in event listener
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

  if (message.type === "API_GET_ADAPTER") {
    apiClient.getAdapter(message.adapterType).then(sendResponse)
    return true
  }

  if (message.type === "API_GET_CREDENTIALS") {
    apiClient.getCredentials().then(sendResponse)
    return true
  }

  if (message.type === "API_GET_2FA_CODE") {
    apiClient.get2FACode().then(sendResponse)
    return true
  }

  if (message.type === "API_GET_SEARCHES") {
    apiClient.getSearches().then(sendResponse)
    return true
  }

  if (message.type === "API_SEND_LOADS") {
    console.log(
      `[Neblo Extension] API_SEND_LOADS — search: "${message.searchUniqueName}", ` +
      `loads: ${message.loads?.length}`,
      JSON.stringify(message.loads, null, 2)
    )
    apiClient
      .sendLoads(message.searchUniqueName, message.loads)
      .then((res) => {
        console.log("[Neblo Extension] API_SEND_LOADS response:", JSON.stringify(res))
        sendResponse(res)
      })
    return true
  }

  if (message.type === "API_GET_LOADS_TO_BOOK") {
    apiClient.getLoadsToBook().then(sendResponse)
    return true
  }

  if (message.type === "API_UPDATE_LOAD_STATUS") {
    apiClient.updateLoadStatus(message.loadId, message.status).then(sendResponse)
    return true
  }

  if (message.type === "LOGIN_CHECK") {
    sendResponse({ shouldLogin: sender.tab?.id === loginTabId })
    return false
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
// Login Flow
// ============================================

/**
 * Opens a Relay tab and checks whether the user is already logged in.
 * If redirected to Amazon sign-in, waits for the content script to
 * complete the login flow. Returns true if logged in, false on timeout.
 */
async function ensureLoggedIn(): Promise<boolean> {
  console.log("[Neblo Extension] Checking login state...")

  const tab = await chrome.tabs.create({ url: RELAY_URL, active: true })
  if (!tab.id) {
    console.error("[Neblo Extension] Failed to create login check tab")
    return false
  }

  // Focus the window so the tab is visible
  try {
    await chrome.windows.update(tab.windowId, { focused: true })
  } catch { /* ignore if window focus fails */ }

  loginTabId = tab.id

  return new Promise<boolean>((resolve) => {
    const LOGIN_TIMEOUT_MS = 90_000
    let resolved = false

    const cleanup = () => {
      if (resolved) return
      resolved = true
      loginTabId = null
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.tabs.onRemoved.removeListener(onRemoved)
      clearTimeout(timeoutId)
    }

    const onLoggedIn = async () => {
      console.log("[Neblo Extension] Login confirmed — user is authenticated")
      await saveAuthState({ isLoggedIn: true })
      const tabId = tab.id!
      cleanup()
      // Brief pause before closing — avoids instant open/close looking bot-like
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500))
      try { await chrome.tabs.remove(tabId) } catch { /* already closed */ }
      resolve(true)
    }

    const onUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (tabId !== tab.id || !changeInfo.url || resolved) return

      const url = changeInfo.url

      // URL settled on Relay loadboard → already logged in (or login just completed)
      if (url.includes(AMAZON_SIGNIN_URLS.relayLoadboard)) {
        onLoggedIn()
        return
      }

      // URL is the Amazon sign-in page → content script will handle it
      if (url.includes(AMAZON_SIGNIN_URLS.signinPrefix)) {
        console.log("[Neblo Extension] Redirected to Amazon sign-in — waiting for login automation...")
      }
    }

    const onRemoved = (tabId: number) => {
      if (tabId !== tab.id || resolved) return
      console.warn("[Neblo Extension] Login tab was closed before login completed")
      cleanup()
      resolve(false)
    }

    const timeoutId = setTimeout(() => {
      if (resolved) return
      console.error("[Neblo Extension] Login timed out after 90s")
      cleanup()
      try { chrome.tabs.remove(tab.id!) } catch { /* already closed */ }
      resolve(false)
    }, LOGIN_TIMEOUT_MS)

    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.tabs.onRemoved.addListener(onRemoved)

    // Handle the case where the tab already loaded (status: "complete") before
    // the listener was attached — check the current URL immediately
    chrome.tabs.get(tab.id!).then((currentTab) => {
      if (resolved || !currentTab.url) return
      if (currentTab.url.includes(AMAZON_SIGNIN_URLS.relayLoadboard)) {
        onLoggedIn()
      }
    }).catch(() => { /* tab gone */ })
  })
}

// ============================================
// Startup
// ============================================

async function startup(): Promise<void> {
  await initApiClient()

  const loggedIn = await ensureLoggedIn()
  if (!loggedIn) {
    console.error("[Neblo Extension] Login failed — will not start polling")
    return
  }

  await restoreTabAssignments()

  // Poll searches immediately, then every 5 seconds
  await pollSearches()
  pollingIntervalId = setInterval(pollSearches, 5000)

  // Poll loads-to-book every 3 seconds
  await pollLoadsToBook()
  loadsToBookIntervalId = setInterval(pollLoadsToBook, 3000)
}

startup()
