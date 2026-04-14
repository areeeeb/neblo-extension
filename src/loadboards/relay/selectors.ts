/**
 * Amazon Relay loadboard DOM selectors and constants.
 * Centralized here so UI changes only need updating in one place.
 */

export const RELAY_URL = "https://relay.amazon.com/loadboard/search"

export const RELAY_SELECTORS = {
  searchPanel: ".search__panel",
  equipment: '[aria-label="Equipment*"]',
  originRadiusLabel: "rlb-origin-radius-filter-label",
  destRegionFilter: "rlb-destination-region-city-filter",
  destCityInput:
    '[aria-labelledby="rlb-destination-city-filter-value rlb-destination-city-filter-label"]',
  destRadiusDropdown: "rlb-destination-radius-filter-value",
  excludedCityInput: '[placeholder="Search cities"]',
  startDateFilter: "rlb-start-date-filter",
  startTimeFilter: "rlb-start-time-filter",
  endDateFilter: "rlb-end-date-filter",
  endTimeFilter: "rlb-end-time-filter",
  refreshSvgPath:
    '[d="M20.128 2l-.493 5.635L14 7.142M19.44 6.935a9 9 0 101.023 8.134"]',
  loadList: "load-list",
  loadCard: "load-card",
  savedSearchListBox: "saved-search__list__box",
  saveSearchNameInput: '[aria-label="Save search name"]',
} as const

/** Text labels used for getElementByText lookups on the Relay page. */
export const RELAY_LABELS = {
  newSearch: "New Search",
  savedSearches: "Saved searches",
  sortRelevance: "Relevance",
  sortHighest: "Highest",
  apply: "Apply",
  saveThisSearch: "Save this search",
  save: "Save",
  seeMoreEquipment: "See more equipment",
  destCityOption: "City",
  pricePerMileMin: "Price/mile (min)",
  payoutMin: "Payout (min)",
  equipmentParents: {
    powerOnly: "Power only",
    tractorTrailer: "Tractor & Trailer",
    boxTruck: "Box truck",
  },
  workTypes: ["Block", "Hostler/Shuttle", "One-Way/Round Trip"],
} as const

export const RELAY_MARKER = {
  className: "neblo-marked",
  text: "Scanned by Neblo"
} as const

/** Selectors for elements inside the load detail panel (opened by clicking a load card). */
export const RELAY_LOAD_DETAIL = {
  /** The detail panel container */
  panel: "#selected-work-sheet",
  /** Tour and Load ID elements (e.g. "Tour...c75025a8", "Load...def456") */
  entityId: ".entity-id",
  /** Total payout display (e.g. "$4,445.87") */
  totalPayout: ".wo-total_payout",
  /** Scheduled arrival time per stop */
  scheduledTime: ".scheduled-arrival__time .scheduled-time",
  /** Header components section (contains postal codes) */
  headerComponents: ".wo-card-header__components",
  /** Location spans (origin/dest) — inside tabindex="0" wrapper, excludes date spans */
  stopLocation: 'span[tabindex="0"] .wo-card-header__components',
  /** SVG path identifying the equipment/trailer icon */
  equipmentSvgPath: '[d="M20 17H2v-5.836C2 10.52 2.446 10 2.998 10h16.004c.552 0 .998.52.998 1.164V17z"]',
  /** SVG path identifying the driver mode icon (Solo/Team) */
  driverModeSvgPath: '[d="M10 2a4 4 0 110 8 4 4 0 010-8zm0-2a6 6 0 100 12 6 6 0 000-12z"]',
} as const

// ============================================
// Amazon Sign-In Page Selectors
// ============================================

export const AMAZON_SIGNIN_SELECTORS = {
  emailInput: "#ap_email",
  continueButton: "#continue",
  passwordInput: "#ap_password",
  signInButton: "#signInSubmit",
  otpInput: "#input-box-otp",
  otpSubmitButton: 'input[type="submit"]',
} as const

export const AMAZON_SIGNIN_URLS = {
  signinPrefix: "www.amazon.com/ap/signin",
  relayLoadboard: "relay.amazon.com/loadboard",
} as const

/** Regex patterns for extracting values from load detail text content. */
export const RELAY_LOAD_PATTERNS = {
  /** "Tour...c75025a8" or "Tour… c75025a8" (ellipsis variants) */
  tourId: /Tour[\s.\u2026]*([a-f0-9]+)/i,
  /** "Load...def456" */
  loadId: /Load[\s.\u2026]*([a-f0-9]+)/i,
  /** "$4,445.87" */
  dollarAmount: /\$([\d,]+\.\d{2})/,
  /** "$2.18/mi" */
  ratePerMile: /\$([\d.]+)\/mi/,
  /** "2,040.5 mi" or "1040 mi" */
  totalMiles: /([\d,]+\.?\d*)\s*mi\b/i,
  /** "3 Stops" or "1 Stop" */
  stopsCount: /(\d+)\s*Stops?\b/i,
  /** 5-digit US postal code */
  postalCode: /\b(\d{5})\b/,
  /** Full-match "City, ST" pattern for leaf element text */
  cityState: /^[A-Za-z\s.'-]+,\s*[A-Z]{2}$/,
} as const
