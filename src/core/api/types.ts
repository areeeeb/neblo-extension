/**
 * API request/response types.
 */

export interface ApiConfig {
  baseUrl: string
  useMock: boolean
  mockLatency?: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface CredentialsResponse {
  email: string
  password: string
}

export interface TwoFACodeResponse {
  code: string
}

// ============================================
// Scraped Load (from loadboard detail pages)
// ============================================

export interface ScrapedLoadStop {
  stop_number: number
  site_code: string
  address_line_1: string
  address_line_2: string | null
  city_state: string
  equipment: {
    trailer_type: string
    status: string
    temperature_readings: { value_f: number; detail: string }[]
  }
  appointment: {
    arrival: string
    departure: string
  }
  instructions_sections_present: string[]
}

export interface ScrapedLoad {
  trip: {
    type: string
    deadhead_miles: number
    stops_count: number
    total_miles: number
    estimated_trip_duration: string
    origin: {
      stop_number: number
      site_code: string
      city_state: string
      postal_code: string
      scheduled_time: string
    }
    destination: {
      stop_number: number
      site_code: string
      city_state: string
      postal_code: string
      scheduled_time: string
    }
    requirements: {
      trailer: {
        type: string
        provided_or_required: string
        bring_your_own_trailer: boolean
      }
      team_load: boolean
      requirements_title: string
      reefer_settings?: {
        pre_cool_to_f: number
        mode: string
        start_stop_acceptable_for_frozen_below_f: number
      }
      other_requirements: string[]
    }
  }
  equipment: {
    trailer_type: string
    provided: boolean
    required: boolean
    driver_mode: string
  }
  payout: {
    estimated_total_payout_usd: number
    display_rate_usd_per_mile: number
    base_rate_usd_per_mile: number
    tour_id: string
    load_financials: {
      load_id: string
      base_rate_usd: number
      fuel_surcharge_usd: number
      toll_charge_usd: number
      total_usd: number
    }[]
  }
  stops: ScrapedLoadStop[]
  legs: {
    from_stop_number: number
    from_site_code: string
    to_stop_number: number
    to_site_code: string
    distance_miles: number
    estimated_drive_time: string
  }[]
  ui_actions_present: {
    book_button_present: boolean
    confirm_booking_modal_present: boolean
    confirm_buttons: string[]
  }
  raw_strings_detected: {
    header_rate_per_mile: string
    deadhead: string
    details_distance: string
    details_duration: string
  }
}

export interface SendLoadsResponse {
  received: number
}

// ============================================
// Saved Searches
// ============================================

export type ScrapeStatus = "start" | "stop"

export interface SavedSearchesResponse {
  scrape_status: ScrapeStatus
  searches: import("~/core/types").SavedSearch[]
}
