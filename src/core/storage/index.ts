/**
 * Typed chrome.storage helpers.
 * Centralizes all storage access so nothing touches chrome.storage directly.
 */

import type { ExtensionSettings, EquipmentSettings } from "~/types"
import type { SavedSearch, AuthState, ApiConfigSettings } from "~/core/types"
import { DEFAULT_API_CONFIG } from "~/core/types"
import { DEFAULT_SETTINGS, DEFAULT_EQUIPMENT } from "~/types"

// ============================================
// Settings
// ============================================

/** Merge stored equipment config with defaults so new keys get their defaults. */
function mergeEquipment(stored: Partial<EquipmentSettings> | undefined): EquipmentSettings {
  if (!stored) return DEFAULT_EQUIPMENT
  return { ...DEFAULT_EQUIPMENT, ...stored }
}

/** Shallow-merge stored settings with defaults, deep-merging nested objects. */
export function mergeSettings(stored: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  if (!stored) return DEFAULT_SETTINGS
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    equipment: mergeEquipment(stored.equipment),
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get("settings")
  return mergeSettings(result.settings)
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ settings })
}

// ============================================
// Automation State
// ============================================

export async function getAutomationState(): Promise<{
  isRunning: boolean
  tabId: number | null
}> {
  const result = await chrome.storage.local.get(["isAutomationRunning", "automationTabId"])
  return {
    isRunning: result.isAutomationRunning || false,
    tabId: result.automationTabId || null
  }
}

export async function setAutomationRunning(isRunning: boolean): Promise<void> {
  await chrome.storage.local.set({ isAutomationRunning: isRunning })
}

export async function setAutomationTabId(tabId: number | null): Promise<void> {
  if (tabId === null) {
    await chrome.storage.local.remove("automationTabId")
  } else {
    await chrome.storage.local.set({ automationTabId: tabId })
  }
}

// ============================================
// Saved Searches (for Task #3)
// ============================================

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const result = await chrome.storage.local.get("savedSearches")
  return result.savedSearches || []
}

export async function saveSavedSearches(searches: SavedSearch[]): Promise<void> {
  await chrome.storage.local.set({ savedSearches: searches })
}

// ============================================
// Auth State (for Task #2)
// ============================================

export async function getAuthState(): Promise<AuthState> {
  const result = await chrome.storage.local.get("authState")
  return result.authState || { isLoggedIn: false }
}

export async function saveAuthState(auth: AuthState): Promise<void> {
  await chrome.storage.local.set({ authState: auth })
}

// ============================================
// Scrape Override (from Options page)
// ============================================

export async function getScrapeOverride(): Promise<boolean> {
  const result = await chrome.storage.local.get("scrapeOverride")
  return result.scrapeOverride ?? false
}

export async function saveScrapeOverride(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ scrapeOverride: enabled })
}

// ============================================
// API Config (from Options page)
// ============================================

export async function getApiConfig(): Promise<ApiConfigSettings> {
  const result = await chrome.storage.sync.get("apiConfig")
  return result.apiConfig ? { ...DEFAULT_API_CONFIG, ...result.apiConfig } : DEFAULT_API_CONFIG
}

export async function saveApiConfig(config: ApiConfigSettings): Promise<void> {
  await chrome.storage.sync.set({ apiConfig: config })
}
