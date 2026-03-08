/**
 * Mock data for API endpoints.
 * Keyed by company name slug with "default" fallback.
 */

import type { CredentialsResponse, TwoFACodeResponse, SavedSearchesResponse } from "./types"

export const MOCK_CREDENTIALS: Record<string, CredentialsResponse> = {
  default: {
    email: "driver@neblo-demo.com",
    password: "mock-password-123"
  },
  "acme-logistics": {
    email: "driver@acme-logistics.com",
    password: "acme-pass-456"
  }
}

export const MOCK_2FA_CODES: Record<string, TwoFACodeResponse> = {
  default: {
    code: "123456"
  },
  "acme-logistics": {
    code: "654321"
  }
}

export const MOCK_SAVED_SEARCHES: SavedSearchesResponse = {
  scrape_status: "start",
  searches: [
  {
    uniqueName: "[neblo] Chicago to Dallas",
    version: 1,
    isUpdated: false,
    loadboardId: "relay",
    preferences: {
      originCities: ["Chicago, IL"],
      destinationCities: ["Dallas, TX"],
      originRadius: 150,
      destinationRadius: 200,
      minDollarsPerMile: 3.0,
      minTotalPayout: 500,
      excludedCities: [],
      startDateTime: "",
      endDateTime: "",
      equipment: {
        powerOnly: false,
        tractorTrailer: true,
        powerTractorOptions: ["53' Trailer"],
        boxTruck: false,
        boxTruckOptions: []
      },
      workTypes: ["One-Way/Round Trip"],
      driverTypes: ["Solo"],
      loadTypes: ["Live", "Drop and hook"]
    }
  },
  {
    uniqueName: "[neblo] Milwaukee Hub",
    version: 2,
    isUpdated: true,
    loadboardId: "relay",
    preferences: {
      originCities: ["Milwaukee, WI"],
      destinationCities: ["Chicago, IL", "Indianapolis, IN"],
      originRadius: 100,
      destinationRadius: 150,
      minDollarsPerMile: 2.5,
      minTotalPayout: 300,
      excludedCities: ["Detroit, MI"],
      startDateTime: "",
      endDateTime: "",
      equipment: {
        powerOnly: true,
        tractorTrailer: false,
        powerTractorOptions: ["53' Container", "45' Container"],
        boxTruck: false,
        boxTruckOptions: []
      },
      workTypes: ["Block", "One-Way/Round Trip"],
      driverTypes: ["Solo", "Team"],
      loadTypes: ["Live"]
    }
  },
  {
    uniqueName: "[neblo] Chicago to Dallas",
    version: 1,
    isUpdated: false,
    loadboardId: "relay",
    preferences: {
      originCities: ["Chicago, IL"],
      destinationCities: ["Dallas, TX"],
      originRadius: 150,
      destinationRadius: 200,
      minDollarsPerMile: 3.0,
      minTotalPayout: 500,
      excludedCities: [],
      startDateTime: "",
      endDateTime: "",
      equipment: {
        powerOnly: false,
        tractorTrailer: true,
        powerTractorOptions: ["53' Trailer"],
        boxTruck: false,
        boxTruckOptions: []
      },
      workTypes: ["One-Way/Round Trip"],
      driverTypes: ["Solo"],
      loadTypes: ["Live", "Drop and hook"]
    }
  },
]
}
