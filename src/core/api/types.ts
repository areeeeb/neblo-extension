/**
 * API request/response types.
 * Aligned with the real backend endpoints (see Relay-Extension.postman_collection.json).
 */

export interface ApiConfig {
  baseUrl: string
}

// ============================================
// Auth
// ============================================

export interface AuthContext {
  apiKey: string
  companyCode: string
  adapterCode: string
}

// ============================================
// Generic API Response
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** Shape returned by the real backend — unwrapped into ApiResponse by the client. */
export interface ApiEnvelope<T = unknown> {
  error: string | null
  status_code: number
  data: T | null
}

// ============================================
// Get Adapter (POST /get_adapter)
// ============================================

export interface GetAdapterResponse {
  id: number
  company_detail: {
    id: number
    company_name: string
    mc_number: string
    dot_number: string
    company_type: number
    company_type_name: string
    status: string
    created_at: string
  }
  adapter_detail: {
    id: string
    adapter_type_code: string
    adapter_name: string
    adapter_display_name: string
    adapter_code: string
    is_active: boolean
    created_at: string
    updated_at: string
    adapter_type: number
  }
  company_name: string
  adapter_name: string
  has_credentials: boolean
  credential_keys: Record<string, string>
  auth_credentials: {
    email: string
    password: string
  } | null
  is_logged_in: boolean
  mfa_required: boolean
  is_active: boolean
}

// ============================================
// Credentials (POST /credentials)
// ============================================

export interface CredentialsResponse {
  email: string
  password: string
}

// ============================================
// 2FA Code (POST /2fa-code)
// ============================================

export interface TwoFACodeResponse {
  code: string
}

// ============================================
// Saved Searches (POST /searches)
// ============================================

export type ScrapeStatus = "start" | "stop"

export interface SavedSearchesResponse {
  scrape_status: ScrapeStatus
  searches: import("~/core/types").SavedSearch[]
}

// ============================================
// Load Ingestion (POST /loads)
// ============================================

export interface LoadPayload {
  trip: {
    origin: {
      city_state: string
      postal_code: string
    }
    destination: {
      city_state: string
      postal_code: string
    }
    total_miles: number
    stops_count: number
  }
  equipment: {
    trailer_type: string
    driver_mode: string
  }
  payout: {
    tour_id: string
    estimated_total_payout_usd: number
    display_rate_usd_per_mile: number
    load_financials: {
      load_id: string
    }[]
  }
  stops: {
    appointment: {
      arrival: string
    }
  }[]
}

export interface SendLoadsResponse {
  received: number
  tour_ids: string[]
  failed: unknown[]
}

// ============================================
// Loads to Book (POST /loads-to-book)
// ============================================

export interface LoadsToBookResponse {
  loads: string[]
}

// ============================================
// Update Load Status (POST /update-status)
// ============================================

export type LoadStatus = "Booked" | "Expired"

export interface UpdateLoadStatusResponse {
  updated: boolean
}
