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
// Auth Types (for Tasks #1-2)
// ============================================

export interface AuthState {
  isLoggedIn: boolean
  companyId?: string
  companyName?: string
  token?: string
}
