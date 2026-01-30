import type { ExtensionSettings, ExtensionMessage } from "./types"
import { DEFAULT_SETTINGS } from "./types"

console.log("[Neblo Extension] Background script loaded")

const RELAY_LOADBOARD_URL = "https://relay.amazon.com/loadboard/search"

// Store for managing tabs
const automationTabs = new Map<number, string>() // tabId -> city

// Start automation (called from popup)
async function startAutomation() {
  console.log("[Neblo Extension] Starting automation from popup")

  try {
    // Load settings
    const result = await chrome.storage.sync.get("settings")
    const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...result.settings }

    // Validate settings
    if (settings.originCities.length === 0) {
      console.warn("[Neblo Extension] No origin cities configured")
      return { success: false, error: "No origin cities configured" }
    }

    console.log("[Neblo Extension] Starting automation with settings:", settings)

    // Open a single tab for the relay loadboard
    const tab = await chrome.tabs.create({
      url: RELAY_LOADBOARD_URL,
      active: true
    })

    if (tab.id) {
      automationTabs.set(tab.id, "relay-main")
      // Store the automation tab ID so content script knows it's the active tab
      await chrome.storage.local.set({ automationTabId: tab.id })
      console.log(`[Neblo Extension] Created relay tab ${tab.id}`)

      // Wait for tab to load, then send automation message
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          // Send start automation message
          const message: ExtensionMessage = {
            type: "START_AUTOMATION",
            city: settings.originCities[0] || "",
            settings
          }

          chrome.tabs.sendMessage(tab.id!, message).catch((err) => {
            console.error(
              `[Neblo Extension] Failed to send message to tab ${tab.id}:`,
              err
            )
          })

          // Remove this listener
          chrome.tabs.onUpdated.removeListener(listener)
        }
      })
    }

    return { success: true }
  } catch (error) {
    console.error("[Neblo Extension] Error starting automation:", error)
    return { success: false, error: String(error) }
  }
}

// Stop all automation
async function stopAllAutomation() {
  console.log("[Neblo Extension] Stopping all automation")

  try {
    // Clear the automation tab ID
    await chrome.storage.local.remove("automationTabId")

    // Send stop message to all automation tabs before closing
    for (const tabId of automationTabs.keys()) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "STOP_AUTOMATION" })
      } catch (err) {
        // Tab might already be closed
      }
      try {
        await chrome.tabs.remove(tabId)
      } catch (err) {
        console.warn(`[Neblo Extension] Could not close tab ${tabId}:`, err)
      }
    }

    automationTabs.clear()
    return { success: true }
  } catch (error) {
    console.error("[Neblo Extension] Error stopping automation:", error)
    return { success: false, error: String(error) }
  }
}

// Listen for tab closures to clean up
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (automationTabs.has(tabId)) {
    const city = automationTabs.get(tabId)
    console.log(`[Neblo Extension] Tab ${tabId} closed (city: ${city})`)
    automationTabs.delete(tabId)

    // Clear automation state if the automation tab was closed
    await chrome.storage.local.remove("automationTabId")
    await chrome.storage.local.set({ isAutomationRunning: false })
  }
})

// Handle API calls from content script (to avoid CORS issues)
async function handleAPICall(params: {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}) {
  console.log(`[Neblo Extension] Background making API call:`, params)

  try {
    const response = await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body
    })

    const contentType = response.headers.get("content-type")
    let data: any

    // Parse response based on content type
    if (contentType?.includes("application/json")) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    console.log(`[Neblo Extension] API call response:`, {
      status: response.status,
      ok: response.ok,
      data
    })

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data
    }
  } catch (error) {
    console.error("[Neblo Extension] API call error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(
  (message: any, sender, sendResponse) => {
    console.log("[Neblo Extension] Message received:", message)

    if (message.type === "START_AUTOMATION_FROM_POPUP") {
      startAutomation().then(sendResponse)
      return true // Keep message channel open for async response
    } else if (message.type === "STOP_ALL_AUTOMATION") {
      stopAllAutomation().then(sendResponse)
      return true
    } else if (message.type === "GET_CURRENT_TAB_ID") {
      // Return the tab ID of the sender (content script)
      sendResponse({ tabId: sender.tab?.id || null })
      return false
    } else if (message.type === "API_CALL") {
      handleAPICall(message.params).then(sendResponse)
      return true // Keep message channel open for async response
    } else if (message.type === "LOAD_STARRED") {
      console.log("[Neblo Extension] Load starred:", message.load)
      // Could send notification or update badge here
    } else if (message.type === "ERROR") {
      console.error("[Neblo Extension] Error from content script:", message.error)
    }

    return true // Keep message channel open
  }
)
