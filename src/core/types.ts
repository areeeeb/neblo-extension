/**
 * Core types for the Neblo extension.
 * Loadboard-agnostic — shared across the entire extension.
 */

// ============================================
// Saved Search Types (for Tasks #2-3)
// ============================================

export interface SavedSearch {
  uniqueName: string
  version: number
  isUpdated: boolean
  loadboardId: string
  preferences: SearchPreferences
}

export interface EquipmentPreferences {
  powerOnly: boolean
  tractorTrailer: boolean
  powerTractorOptions: string[]
  boxTruck: boolean
  boxTruckOptions: string[]
}

export interface SearchPreferences {
  originCities: string[]
  destinationCities: string[]
  originRadius: number
  destinationRadius: number
  minDollarsPerMile: number
  minTotalPayout: number
  excludedCities: string[]
  startDateTime: string
  endDateTime: string
  equipment: EquipmentPreferences
  workTypes: string[]
  driverTypes: string[]
  loadTypes: string[]
}

// ============================================
// API Configuration (stored in chrome.storage.sync)
// ============================================

export interface ApiConfigSettings {
  baseUrl: string
  apiKey: string
  companyCode: string
  adapterCode: string
}

export const DEFAULT_API_CONFIG: ApiConfigSettings = {
  baseUrl: "https://dev-be.neblo.ai/api/extension",
  apiKey: "",
  companyCode: "",
  adapterCode: ""
}

// ============================================
// Auth Types (for Tasks #1-2)
// ============================================

export interface AuthState {
  isLoggedIn: boolean
  companyName?: string
}
