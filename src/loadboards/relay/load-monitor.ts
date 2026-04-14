/**
 * Amazon Relay loadboard load monitoring.
 * Clicks each new (unmarked) load card, opens its detail panel,
 * extracts load data into LoadPayload, marks the card, and sends
 * collected loads to the API at the end of each scan.
 *
 * doMonitoringPass() runs: scan → send → wait → refresh → scan → send,
 * designed to be called once per background-scheduler "turn".
 */

import type { LoadPayload } from "~/core/api/types"
import {
  randomDelay,
  randInt,
  humanClick,
  waitForElement,
  pressEscape,
  sleep,
  getElementByText,
} from "~/core/automation/dom-utils"
import {
  RELAY_SELECTORS,
  RELAY_LABELS,
  RELAY_MARKER,
  RELAY_LOAD_DETAIL,
  RELAY_LOAD_PATTERNS,
} from "./selectors"

// ============================================
// Tab-level Tour ID Cache
// ============================================

/**
 * Tracks tour IDs already sent to the API during this tab's lifetime.
 * Prevents duplicate submissions across refreshes. Clears when tab closes.
 * TODO: move to chrome.storage.local for cross-tab persistence later.
 */
const sentTourIds = new Set<string>()

// ============================================
// Timing (configurable fast/prod, matches search-automation.ts pattern)
// ============================================

const TIMING_MODE: "fast" | "prod" = "prod"
const TIMING = {
  fast: { panelWait: 800, cardDelayMin: 200, cardDelayMax: 400 },
  prod: { panelWait: 1200, cardDelayMin: 800, cardDelayMax: 1500 },
}[TIMING_MODE]

// ============================================
// Load Card Marking
// ============================================

function markLoadCard(loadCard: Element): void {
  if (loadCard.classList.contains(RELAY_MARKER.className)) return

  loadCard.classList.add(RELAY_MARKER.className)

  const marker = document.createElement("div")
  marker.style.cssText = `
    position: absolute;
    bottom: 2px;
    right: 2px;
    background: #059669;
    color: white;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 8px;
    font-weight: 600;
    line-height: 14px;
    z-index: 100;
    opacity: 0.85;
    letter-spacing: 0.3px;
    pointer-events: none;
  `
  marker.textContent = RELAY_MARKER.text

  const cardElement = loadCard as HTMLElement
  if (window.getComputedStyle(cardElement).position === "static") {
    cardElement.style.position = "relative"
  }

  loadCard.appendChild(marker)
}

// ============================================
// Detail Panel Discovery
// ============================================

/**
 * Get the load detail panel by its known container ID.
 */
function findDetailPanel(): Element | null {
  return document.querySelector(RELAY_LOAD_DETAIL.panel)
}

// ============================================
// Extraction Helpers
// ============================================

function parseMoney(text: string | null | undefined): number {
  if (!text) return 0
  const match = text.match(RELAY_LOAD_PATTERNS.dollarAmount)
  return match ? parseFloat(match[1].replace(/,/g, "")) : 0
}

/**
 * Parse a postal code (5-digit, optionally +4) from a location string.
 * e.g. "POC1 FONTANA, California 92336-1123" → "92336"
 */
function parsePostalCode(location: string): string {
  const match = location.match(/\b(\d{5})(?:-\d{4})?\b/)
  return match ? match[1] : ""
}

/**
 * Extract origin/destination locations, postal codes, stop dates, and stops
 * count from the panel header.
 *
 * Locations live in `span[tabindex="0"] .wo-card-header__components`.
 * Stop numbers are in the previous sibling div of each location wrapper.
 * Dates are sibling `.wo-card-header__components` outside the tabindex wrapper.
 */
function extractStopInfo(panel: Element): {
  originLocation: string
  originPostal: string
  destLocation: string
  destPostal: string
  stopsCount: number
  stopDates: string[]
} {
  const locationEls = panel.querySelectorAll(RELAY_LOAD_DETAIL.stopLocation)
  const originLocation = locationEls[0]?.textContent?.trim() || ""
  const destLocation =
    locationEls.length > 1
      ? locationEls[locationEls.length - 1]?.textContent?.trim() || ""
      : ""

  const originPostal = parsePostalCode(originLocation)
  const destPostal = parsePostalCode(destLocation)

  // Stops count: the stop number before the last location element.
  // Structure: <div><p>3</p></div> <div>...<span tabindex="0">...location...</span>...</div>
  let stopsCount = 0
  const lastLocEl = locationEls[locationEls.length - 1]
  if (lastLocEl) {
    const tabindexWrapper = lastLocEl.closest("span[tabindex]")
    const locationDiv = tabindexWrapper?.parentElement
    const stopNumberDiv = locationDiv?.previousElementSibling
    const stopNum = parseInt(stopNumberDiv?.textContent?.trim() || "")
    if (!isNaN(stopNum)) stopsCount = stopNum
  }

  // Dates: for each location span, walk up to the tabindex wrapper's parent
  // div, then find the next sibling .wo-card-header__components (the date).
  const stopDates: string[] = []
  for (const locEl of locationEls) {
    const tabindexWrapper = locEl.closest("span[tabindex]")
    const parentDiv = tabindexWrapper?.parentElement
    if (!parentDiv) continue

    const allHeaderComponents = parentDiv.querySelectorAll(
      RELAY_LOAD_DETAIL.headerComponents
    )
    for (const comp of allHeaderComponents) {
      if (tabindexWrapper?.contains(comp)) continue
      const dateText = comp.textContent?.trim() || ""
      if (dateText) stopDates.push(dateText)
    }
  }

  return { originLocation, originPostal, destLocation, destPostal, stopsCount, stopDates }
}

/**
 * Extract a label from a detail panel element identified by its SVG icon.
 * Finds the SVG path, walks up to the container div, reads the sibling <p>.
 */
function extractBySvgIcon(panel: Element, pathSelector: string): string {
  const svgPath = panel.querySelector(pathSelector)
  if (!svgPath) return ""

  const container = svgPath.closest("div")
  if (!container) return ""

  const label = container.querySelector("p")
  return label?.textContent?.trim() || ""
}

// ============================================
// Load Detail Scraping
// ============================================

/**
 * Extract a LoadPayload from the currently visible detail panel.
 * Returns null if the tour ID can't be extracted (critical field).
 */
function scrapeLoadDetail(): LoadPayload | null {
  const panel = findDetailPanel()
  if (!panel) {
    console.warn("[Neblo Relay] Detail panel not found")
    return null
  }

  try {
    const panelText = panel.textContent || ""

    // ── Tour ID & Load Financial IDs ──
    const entityIdEls = panel.querySelectorAll(RELAY_LOAD_DETAIL.entityId)
    let tourId = ""
    const loadFinancials: { load_id: string }[] = []

    for (const el of entityIdEls) {
      const text = el.textContent?.trim() || ""
      const tourMatch = text.match(RELAY_LOAD_PATTERNS.tourId)
      if (tourMatch) {
        tourId = tourMatch[1]
        continue
      }
      const loadMatch = text.match(RELAY_LOAD_PATTERNS.loadId)
      if (loadMatch) {
        loadFinancials.push({ load_id: loadMatch[1] })
      }
    }

    if (!tourId) {
      console.warn("[Neblo Relay] Could not extract tour ID — skipping load")
      return null
    }

    // ── Payout ──
    const payoutEl = panel.querySelector(RELAY_LOAD_DETAIL.totalPayout)
    const totalPayout = parseMoney(payoutEl?.textContent)

    // ── Rate per mile ──
    const rateMatch = panelText.match(RELAY_LOAD_PATTERNS.ratePerMile)
    const ratePerMile = rateMatch ? parseFloat(rateMatch[1]) : 0

    // ── Details container (scoped lookups for miles, equipment, driver mode) ──
    const detailsHeading = getElementByText("div", "Details")
    const detailsContainer = detailsHeading?.parentElement

    // ── Total miles ──
    let totalMiles = 0
    if (detailsContainer) {
      const leafEls = detailsContainer.querySelectorAll("*")
      for (const el of leafEls) {
        const t = el.textContent?.trim() || ""
        const milesMatch = t.match(RELAY_LOAD_PATTERNS.totalMiles)
        if (milesMatch && /^\s*[\d,]+\.?\d*\s*mi\s*$/.test(t)) {
          totalMiles = parseFloat(milesMatch[1].replace(/,/g, ""))
          break
        }
      }
    }

    // ── Origin, Destination, Stops count & Stop arrival times ──
    const {
      originLocation, originPostal,
      destLocation, destPostal,
      stopsCount, stopDates,
    } = extractStopInfo(panel)
    const stops = stopDates.map((date) => ({
      appointment: { arrival: date },
    }))

    // ── Equipment ──
    const trailerType = detailsContainer
      ? extractBySvgIcon(detailsContainer, RELAY_LOAD_DETAIL.equipmentSvgPath)
      : ""
    const driverMode = detailsContainer
      ? extractBySvgIcon(detailsContainer, RELAY_LOAD_DETAIL.driverModeSvgPath)
      : ""

    const payload: LoadPayload = {
      trip: {
        origin: { city_state: originLocation, postal_code: originPostal },
        destination: { city_state: destLocation, postal_code: destPostal },
        total_miles: totalMiles,
        stops_count: stopsCount,
      },
      equipment: {
        trailer_type: trailerType,
        driver_mode: driverMode,
      },
      payout: {
        tour_id: tourId,
        estimated_total_payout_usd: totalPayout,
        display_rate_usd_per_mile: ratePerMile,
        load_financials: loadFinancials,
      },
      stops,
    }

    console.log("[Neblo Relay] Scraped load:", {
      tourId,
      totalPayout,
      ratePerMile,
      totalMiles,
      stopsCount,
      originLocation,
      originPostal,
      destLocation,
      destPostal,
      trailerType,
      driverMode,
      loadFinancials: loadFinancials.length,
      stops,
    })

    return payload
  } catch (error) {
    console.error("[Neblo Relay] Error scraping load detail:", error)
    return null
  }
}

// ============================================
// Card Processing
// ============================================

/**
 * Click the refresh button on the Relay loadboard.
 */
async function clickRefreshButton(): Promise<boolean> {
  const refreshPath = document.querySelector(RELAY_SELECTORS.refreshSvgPath)
  if (!refreshPath) {
    console.warn("[Neblo Relay] Refresh button not found")
    return false
  }

  let clickableElement: Element | null = refreshPath
  for (let i = 0; i < 5; i++) {
    const parent = clickableElement?.parentElement
    if (!parent) break
    clickableElement = parent

    const tagName = parent.tagName.toLowerCase()
    if (
      tagName === "button" ||
      tagName === "a" ||
      parent.getAttribute("role") === "button"
    ) {
      break
    }
  }

  if (clickableElement) {
    await humanClick(clickableElement as HTMLElement, "Refresh button")
    return true
  }

  return false
}

const MAX_LOADS_PER_PASS = 5

/**
 * Sort the load list by highest payout by clicking
 * the "Relevance" dropdown then selecting "Highest".
 */
async function sortByHighestPayout(): Promise<void> {
  const relevanceBtn = getElementByText("span", RELAY_LABELS.sortRelevance)
  if (!relevanceBtn) {
    console.warn("[Neblo Relay] Sort 'Relevance' button not found — skipping sort")
    return
  }

  await humanClick(relevanceBtn as HTMLElement, "Sort dropdown")
  await randomDelay(400, 800)

  const highestOption = getElementByText("span", RELAY_LABELS.sortHighest)
  if (!highestOption) {
    console.warn("[Neblo Relay] Sort 'Highest' option not found — skipping sort")
    return
  }

  await humanClick(highestOption as HTMLElement, "Sort by Highest")
  await randomDelay(800, 1200)

  console.log("[Neblo Relay] Sorted loads by highest payout")
}

/**
 * Process all visible load cards: click each new (unmarked) card to open its
 * detail panel, scrape load data, mark the card, and collect LoadPayloads.
 * Caps at MAX_LOADS_PER_PASS scraped loads.
 */
async function scrapeNewLoadCards(
  shouldContinue: () => boolean
): Promise<LoadPayload[]> {
  const loadList = document.getElementsByClassName(RELAY_SELECTORS.loadList)[0]
  if (!loadList) {
    console.log("[Neblo Relay] Load list not found")
    return []
  }

  // Snapshot into a static array — getElementsByClassName returns a live
  // collection that shifts when the DOM changes (marking, panel open/close).
  const loadCards = [...loadList.getElementsByClassName(RELAY_SELECTORS.loadCard)]
  const payloads: LoadPayload[] = []

  console.log(`[Neblo Relay] Found ${loadCards.length} load cards`)

  for (const loadCard of loadCards) {
    if (!shouldContinue()) break
    if (payloads.length >= MAX_LOADS_PER_PASS) break
    if (loadCard.classList.contains(RELAY_MARKER.className)) continue

    const clickTarget = loadCard.firstElementChild as HTMLElement
    if (!clickTarget) {
      markLoadCard(loadCard)
      continue
    }

    try {
      await humanClick(clickTarget, "Load card")

      // Wait for the detail panel to render
      await sleep(TIMING.panelWait)
      if (!shouldContinue()) break

      // Confirm detail loaded by waiting for the panel container
      const panelEl = await waitForElement(RELAY_LOAD_DETAIL.panel, {
        timeout: 3000,
        shouldContinue,
      })

      if (panelEl) {
        const payload = scrapeLoadDetail()
        if (payload) payloads.push(payload)
      } else {
        console.warn("[Neblo Relay] Detail panel didn't load for this card")
      }

      markLoadCard(loadCard)

      // Close the detail panel before moving to next card
      await pressEscape()
      await randomDelay(TIMING.cardDelayMin, TIMING.cardDelayMax)
    } catch (error) {
      console.warn("[Neblo Relay] Error processing load card:", error)
      markLoadCard(loadCard)
    }
  }

  if (payloads.length > 0) {
    console.log(`[Neblo Relay] Scraped ${payloads.length} new loads`)
  }

  return payloads
}

// ============================================
// API Submission
// ============================================

/** Set to true to dry-run: log payloads without calling the API. */
const DRY_RUN = false

/**
 * Send loads to the API. Returns true on success so callers can
 * update the sentTourIds cache only when the API actually received them.
 */
async function sendLoadsToApi(
  searchUniqueName: string,
  loads: LoadPayload[]
): Promise<boolean> {
  if (loads.length === 0) return true

  if (DRY_RUN) {
    console.log(
      `[Neblo Relay] DRY RUN — would send ${loads.length} loads for "${searchUniqueName}":`,
      JSON.stringify(loads, null, 2)
    )
    return true
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "API_SEND_LOADS",
      searchUniqueName,
      loads,
    })

    if (response?.success) {
      console.log(
        `[Neblo Relay] Sent ${loads.length} loads to API — ` +
          `received: ${response.data?.received}, ` +
          `tour_ids: [${response.data?.tour_ids?.join(", ")}]`
      )
      return true
    } else {
      console.warn("[Neblo Relay] API rejected loads:", response?.error)
      return false
    }
  } catch (error) {
    console.error("[Neblo Relay] Error sending loads to API:", error)
    return false
  }
}

// ============================================
// Monitoring Pass (public API)
// ============================================

/**
 * Filter scraped loads to only those not yet sent, batch-send them,
 * and cache their tour IDs on success.
 */
async function sendNewLoads(
  searchUniqueName: string,
  allLoads: LoadPayload[]
): Promise<void> {
  const newLoads = allLoads.filter((l) => !sentTourIds.has(l.payout.tour_id))
  const skipped = allLoads.length - newLoads.length

  if (newLoads.length === 0) {
    if (allLoads.length > 0) {
      console.log(`[Neblo Relay] All ${allLoads.length} loads already sent — skipping`)
    }
    return
  }

  if (skipped > 0) {
    console.log(
      `[Neblo Relay] ${newLoads.length} new loads to send (${skipped} already in cache)`
    )
  }

  const success = await sendLoadsToApi(searchUniqueName, newLoads)

  if (success) {
    for (const load of newLoads) {
      sentTourIds.add(load.payout.tour_id)
    }
    console.log(`[Neblo Relay] Tour ID cache size: ${sentTourIds.size}`)
  }
}

/**
 * Single monitoring pass:
 *   1. Click each load card → open detail → scrape → mark
 *   2. Batch-send only NEW loads (by tourId) to API
 *   3. Human-like pause, then refresh
 *   4. Scrape any newly appeared cards after refresh
 *   5. Batch-send new loads again
 *
 * The sentTourIds cache (tab-level Set) ensures we never re-send the
 * same tour across refreshes. Only cached on successful API response.
 *
 * Called once per scheduler turn. Completes and returns so the background
 * can rotate to the next tab.
 */
export async function doMonitoringPass(
  shouldContinue: () => boolean,
  searchUniqueName: string
): Promise<void> {
  console.log("[Neblo Relay] Starting monitoring pass...")

  // Sort by highest payout before scraping
  await sortByHighestPayout()
  if (!shouldContinue()) return

  // Scrape top load cards (capped at MAX_LOADS_PER_PASS)
  const loads = await scrapeNewLoadCards(shouldContinue)
  if (!shouldContinue()) return

  // Batch-send only loads not already in cache
  await sendNewLoads(searchUniqueName, loads)

  // Human-like pause before refresh (6-12 seconds)
  const preRefreshDelay = randInt(6000, 12000)
  console.log(
    `[Neblo Relay] Waiting ${(preRefreshDelay / 1000).toFixed(1)}s before refresh...`
  )
  await randomDelay(preRefreshDelay, preRefreshDelay + randInt(0, 500))
  if (!shouldContinue()) return

  // Refresh
  console.log("[Neblo Relay] Clicking refresh...")
  await clickRefreshButton()
  await randomDelay(1500, 3000)
  if (!shouldContinue()) return

  // Scan again — DOM may have rebuilt, but cache prevents duplicate sends
  const refreshedLoads = await scrapeNewLoadCards(shouldContinue)
  await sendNewLoads(searchUniqueName, refreshedLoads)

  console.log("[Neblo Relay] Monitoring pass complete")
}
