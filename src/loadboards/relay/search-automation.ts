/**
 * Amazon Relay loadboard search automation.
 * Fills in all search filters (origin/dest cities, radii, rates, equipment)
 * using human-like interactions.
 *
 * Flow:
 *   1. Try to load the search from Relay's saved searches by uniqueName.
 *   2. If found → click it → Apply → done (return true).
 *   3. If not found → run the full New Search parameter flow.
 *   4. After filling all params → save the search with uniqueName.
 *   5. Return true.
 */

import type { SavedSearch } from "~/core/types"
import {
  randomDelay,
  waitForElement,
  humanClick,
  humanType,
  pressEscape,
  getElementByText,
  logStep
} from "~/core/automation/dom-utils"
import { RELAY_SELECTORS, RELAY_LABELS } from "./selectors"

/** Delay between major automation steps (2–8 seconds, mimics human pace). */
function stepDelay(): Promise<void> {
  return randomDelay(2000, 8000)
}

/** Parse a datetime-local value (YYYY-MM-DDTHH:MM) into date (MM/DD/YYYY) and time (HH:MM). */
function parseDateTimeLocal(value: string): { date: string; time: string } | null {
  if (!value) return null
  const [datePart, timePart] = value.split("T")
  if (!datePart || !timePart) return null
  const [year, month, day] = datePart.split("-")
  if (!year || !month || !day) return null
  return { date: `${month}/${day}/${year}`, time: timePart }
}

// ============================================
// Saved Search Helpers
// ============================================

/**
 * Try to load a saved search from Relay's "Saved searches" panel by uniqueName.
 * Returns true if the search was found and applied (ready to scan loads).
 * Returns false if not found (caller should run the full New Search flow).
 */
async function tryLoadSavedSearch(
  uniqueName: string,
  shouldContinue: () => boolean
): Promise<boolean> {
  logStep("S1", `Looking for "Saved searches" button to load "${uniqueName}"...`)

  const savedSearchesBtn = await waitForElement(
    () => getElementByText("button", RELAY_LABELS.savedSearches),
    { timeout: 10000, shouldContinue }
  )

  if (!savedSearchesBtn) {
    console.warn('[Neblo Relay] Could not find "Saved searches" button — proceeding with New Search')
    return false
  }

  await humanClick(savedSearchesBtn as HTMLElement, "Saved searches button")
  // Give the panel time to open and populate
  await randomDelay(800, 1400)
  if (!shouldContinue()) return false

  // Scan the saved-search list boxes for a match
  const listBoxes = document.getElementsByClassName(RELAY_SELECTORS.savedSearchListBox)
  let matchedBox: HTMLElement | null = null

  for (const box of listBoxes) {
    if (box.textContent?.trim() === uniqueName) {
      matchedBox = box as HTMLElement
      break
    }
  }

  if (!matchedBox) {
    console.log(`[Neblo Relay] No saved search found for "${uniqueName}" — will run New Search`)
    await pressEscape()
    await randomDelay(400, 700)
    return false
  }

  logStep("S2", `Found saved search "${uniqueName}", clicking...`)
  await humanClick(matchedBox, `Saved search: ${uniqueName}`)
  await randomDelay(1000, 2000)
  if (!shouldContinue()) return false

  logStep("S3", 'Clicking "Apply" button...')
  const applyBtn = await waitForElement(
    () => getElementByText("button", RELAY_LABELS.apply),
    { timeout: 6000, shouldContinue }
  )

  if (!applyBtn) {
    console.warn('[Neblo Relay] Could not find "Apply" button after selecting saved search')
    return false
  }

  await humanClick(applyBtn as HTMLElement, "Apply button")
  await stepDelay()

  console.log(`[Neblo Relay] Loaded saved search "${uniqueName}" successfully`)
  return true
}

/**
 * Save the current search configuration under the given uniqueName.
 * Called after all search parameters have been filled in.
 */
async function saveSearch(
  uniqueName: string,
  shouldContinue: () => boolean
): Promise<void> {
  logStep("Save-1", `Saving search as "${uniqueName}"...`)

  const saveThisSearchBtn = await waitForElement(
    () => getElementByText("button", RELAY_LABELS.saveThisSearch),
    { timeout: 6000, shouldContinue }
  )

  if (!saveThisSearchBtn) {
    console.warn('[Neblo Relay] Could not find "Save this search" button — skipping save')
    return
  }

  await humanClick(saveThisSearchBtn as HTMLElement, "Save this search button")
  await randomDelay(600, 1200)
  if (!shouldContinue()) return

  logStep("Save-2", `Typing search name "${uniqueName}"...`)

  const nameInput = document.querySelectorAll(
    RELAY_SELECTORS.saveSearchNameInput
  )[0] as HTMLInputElement | undefined

  if (!nameInput) {
    console.warn("[Neblo Relay] Could not find save search name input — skipping save")
    return
  }

  await humanType(nameInput, uniqueName, { description: "Search name", shouldContinue })
  await randomDelay(400, 800)
  if (!shouldContinue()) return

  logStep("Save-3", 'Clicking "Save" button...')

  const saveBtn = await waitForElement(
    () => getElementByText("button", RELAY_LABELS.save),
    { timeout: 6000, shouldContinue }
  )

  if (!saveBtn) {
    console.warn('[Neblo Relay] Could not find "Save" button — skipping save')
    return
  }

  await humanClick(saveBtn as HTMLElement, "Save button")
  await stepDelay()

  console.log(`[Neblo Relay] Search saved as "${uniqueName}"`)
}

// ============================================
// Main Search Automation
// ============================================

/**
 * Runs the full Relay loadboard search automation for the given SavedSearch.
 * Returns true if the search was set up successfully, false if cancelled or failed.
 */
export async function runRelaySearch(
  search: SavedSearch,
  shouldContinue: () => boolean
): Promise<boolean> {
  const prefs = search.preferences

  console.log("[Neblo Relay] ========================================")
  console.log(`[Neblo Relay] Starting search: "${search.uniqueName}"`)
  console.log("[Neblo Relay] ========================================")

  // ------------------------------------------------------------------
  // Attempt to load from Relay's saved searches first.
  // If the search was previously saved under this uniqueName, we can
  // skip the entire parameter-filling flow.
  // ------------------------------------------------------------------
  const loadedFromSaved = await tryLoadSavedSearch(search.uniqueName, shouldContinue)
  if (loadedFromSaved) return true
  if (!shouldContinue()) return false

  // ------------------------------------------------------------------
  // Full New Search parameter flow
  // ------------------------------------------------------------------

  // ----------------------------------------
  // Step 1: Click "New Search" button
  // ----------------------------------------
  logStep(1, 'Looking for "New Search" button...')

  const newSearchSpan = await waitForElement(
    () => getElementByText("span", RELAY_LABELS.newSearch),
    { timeout: 15000, shouldContinue }
  )

  if (!newSearchSpan) {
    console.error('[Neblo Relay] FATAL: Could not find "New Search" button')
    return false
  }

  await humanClick(newSearchSpan as HTMLElement, "New Search button")
  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 2: Click the origin city input field
  // ----------------------------------------
  logStep(2, "Clicking origin city input...")

  const searchPanel = await waitForElement(RELAY_SELECTORS.searchPanel, { shouldContinue })
  if (!searchPanel) {
    console.error("[Neblo Relay] FATAL: Could not find search panel")
    return false
  }

  const originInput = searchPanel.querySelector("input")
  if (!originInput) {
    console.error("[Neblo Relay] FATAL: Could not find origin input in search panel")
    return false
  }

  await humanClick(originInput as HTMLElement, "Origin city input")
  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Steps 3–5: Add each origin city
  // ----------------------------------------
  for (let i = 0; i < prefs.originCities.length; i++) {
    if (!shouldContinue()) return false

    const city = prefs.originCities[i].toUpperCase()
    logStep(3, `Adding origin city ${i + 1}/${prefs.originCities.length}: ${city}`)

    const currentPanel = document.querySelector(RELAY_SELECTORS.searchPanel)
    const currentInput = currentPanel?.querySelector("input") as HTMLInputElement

    if (!currentInput) {
      console.error(`[Neblo Relay] Could not find input for origin city ${i + 1}`)
      continue
    }

    await humanType(currentInput, city, { description: `Origin city ${i + 1}`, shouldContinue })
    await randomDelay(500, 1000)
    if (!shouldContinue()) return false

    logStep(4, `Selecting "${city}" from dropdown...`)
    const cityOption = await waitForElement(
      `[aria-label="${city}"]`,
      { timeout: 5000, shouldContinue }
    )

    if (cityOption) {
      await humanClick(cityOption as HTMLElement, `City option: ${city}`)
    } else {
      console.warn(`[Neblo Relay] Could not find dropdown option for: ${city}`)
    }

    await stepDelay()
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 6: Click Equipment dropdown
  // ----------------------------------------
  logStep(6, "Clicking Equipment dropdown...")

  const equipmentDropdown = await waitForElement(RELAY_SELECTORS.equipment, { shouldContinue })
  if (!equipmentDropdown) {
    console.error("[Neblo Relay] Could not find Equipment dropdown")
    return false
  }

  await humanClick(equipmentDropdown as HTMLElement, "Equipment dropdown")
  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 7: Select equipment type parents
  // ----------------------------------------
  const equipmentParents: { selected: boolean; label: string }[] = [
    { selected: prefs.equipment.powerOnly, label: RELAY_LABELS.equipmentParents.powerOnly },
    { selected: prefs.equipment.tractorTrailer, label: RELAY_LABELS.equipmentParents.tractorTrailer },
    { selected: prefs.equipment.boxTruck, label: RELAY_LABELS.equipmentParents.boxTruck },
  ]

  for (const { selected, label } of equipmentParents) {
    if (!selected) continue
    if (!shouldContinue()) return false

    logStep(7, `Selecting '${label}'...`)
    const parentLabel = await waitForElement(
      () => getElementByText("label", label),
      { shouldContinue }
    )

    if (parentLabel) {
      await humanClick(parentLabel as HTMLElement, `${label} checkbox`)
    } else {
      console.warn(`[Neblo Relay] Could not find '${label}' option`)
    }
    await stepDelay()
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 7.5: Click "See more equipment" if visible
  // ----------------------------------------
  const seeMoreSpan = getElementByText("a", RELAY_LABELS.seeMoreEquipment)
  if (seeMoreSpan) {
    logStep("7.5", 'Clicking "See more equipment"...')
    await humanClick(seeMoreSpan as HTMLElement, "See more equipment")
    await stepDelay()
    if (!shouldContinue()) return false
  }

  // ----------------------------------------
  // Step 8: Select equipment sub-options
  // ----------------------------------------
  const allSubOptions = [
    ...prefs.equipment.powerTractorOptions,
    ...prefs.equipment.boxTruckOptions,
  ].filter((o) => o.toLowerCase() !== "all")

  for (const option of allSubOptions) {
    if (!shouldContinue()) return false

    logStep(8, `Selecting '${option}'...`)
    const optionEl = await waitForElement(
      () => getElementByText("div", option),
      { shouldContinue }
    )

    if (optionEl) {
      await humanClick(optionEl as HTMLElement, `Equipment option: ${option}`)
    } else {
      console.warn(`[Neblo Relay] Could not find equipment option: ${option}`)
    }
    await stepDelay()
  }

  await pressEscape()
  await randomDelay(300, 500)
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 9: Click origin radius dropdown
  // ----------------------------------------
  logStep(9, "Clicking origin radius dropdown...")

  const originRadiusLabel = document.getElementById(RELAY_SELECTORS.originRadiusLabel)
  if (!originRadiusLabel) {
    console.error("[Neblo Relay] Could not find origin radius dropdown")
    return false
  }

  await humanClick(originRadiusLabel, "Origin radius dropdown")
  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 10: Select origin radius value
  // ----------------------------------------
  const originRadiusValue = prefs.originRadius.toString()
  logStep(10, `Selecting origin radius: ${originRadiusValue} miles...`)

  const originRadiusOption = await waitForElement(
    `[aria-label="${originRadiusValue}"]`,
    { shouldContinue }
  )

  if (originRadiusOption) {
    await humanClick(originRadiusOption as HTMLElement, `Origin radius: ${originRadiusValue}`)
  } else {
    console.warn(`[Neblo Relay] Could not find origin radius option: ${originRadiusValue}`)
  }

  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 11: Click destination region filter
  // ----------------------------------------
  logStep(11, "Clicking destination region filter...")

  const destRegionFilter = document.getElementById(RELAY_SELECTORS.destRegionFilter)
  if (!destRegionFilter) {
    console.error("[Neblo Relay] Could not find destination region filter")
    return false
  }

  await humanClick(destRegionFilter, "Destination region filter")
  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 12: Select "City" option
  // ----------------------------------------
  logStep(12, 'Selecting "City" option...')

  const cityFilterOption = await waitForElement(
    `[aria-label="${RELAY_LABELS.destCityOption}"]`,
    { shouldContinue }
  )

  if (cityFilterOption) {
    await humanClick(cityFilterOption as HTMLElement, "City filter option")
  } else {
    console.warn('[Neblo Relay] Could not find "City" option')
  }

  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 13: Click destination city input (with retry logic)
  // ----------------------------------------
  logStep(13, "Clicking destination city input...")

  let destCityInput: Element | null = null
  const maxRetries = 5

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (!shouldContinue()) return false

    destCityInput = await waitForElement(RELAY_SELECTORS.destCityInput, {
      timeout: 5000,
      visible: false,
      shouldContinue
    })

    if (destCityInput) {
      console.log(`[Neblo Relay] Found destination city input on attempt ${attempt}`)
      break
    }

    console.warn(
      `[Neblo Relay] Attempt ${attempt}/${maxRetries}: Could not find destination city input, retrying...`
    )

    if (attempt < maxRetries) {
      const cityOptionRetry = await waitForElement(
        `[aria-label="${RELAY_LABELS.destCityOption}"]`,
        { timeout: 2000, shouldContinue }
      )
      if (cityOptionRetry) {
        await humanClick(cityOptionRetry as HTMLElement, "City filter option (retry)")
      }
      await randomDelay(1000, 2000)
    }
  }

  if (!destCityInput) {
    console.error("[Neblo Relay] Could not find destination city input after all retries")
    return false
  }

  await humanClick(destCityInput as HTMLElement, "Destination city input")
  await stepDelay()

  // ----------------------------------------
  // Steps 14–16: Add each destination city
  // ----------------------------------------
  if (prefs.destinationCities.length > 0) {
    for (let i = 0; i < prefs.destinationCities.length; i++) {
      if (!shouldContinue()) return false

      const city = prefs.destinationCities[i].toUpperCase()
      logStep(14, `Adding destination city ${i + 1}/${prefs.destinationCities.length}: ${city}`)

      const currentDestInput = document.querySelector(
        RELAY_SELECTORS.destCityInput
      ) as HTMLInputElement

      if (!currentDestInput) {
        console.error(`[Neblo Relay] Could not find input for destination city ${i + 1}`)
        continue
      }

      await humanType(currentDestInput, city, {
        description: `Destination city ${i + 1}`,
        shouldContinue
      })
      await randomDelay(500, 1000)
      if (!shouldContinue()) return false

      logStep(15, `Selecting "${city}" from dropdown...`)
      const destCityOption = await waitForElement(`[aria-label="${city}"]`, {
        timeout: 5000,
        shouldContinue
      })

      if (destCityOption) {
        await humanClick(destCityOption as HTMLElement, `Destination city: ${city}`)
      } else {
        console.warn(`[Neblo Relay] Could not find dropdown option for destination: ${city}`)
      }

      await stepDelay()
    }

    logStep(17, "Pressing Escape to close dropdown...")
    await pressEscape()
    await stepDelay()
  } else {
    console.log("[Neblo Relay] No destination cities configured, skipping")
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 17.5: Focus out of destination cities
  // ----------------------------------------
  logStep("17.5", "Clicking start date filter to focus out...")

  const startDateFilter = document.getElementById(RELAY_SELECTORS.startDateFilter)
  if (startDateFilter) {
    await humanClick(startDateFilter, "Start date filter (focus out)")
    await randomDelay(500, 1000)
    await pressEscape()
    await stepDelay()
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 18: Click destination radius dropdown
  // ----------------------------------------
  logStep(18, "Clicking destination radius dropdown...")

  const destRadiusDropdown = document.getElementById(RELAY_SELECTORS.destRadiusDropdown)
  if (!destRadiusDropdown) {
    console.error("[Neblo Relay] Could not find destination radius dropdown")
    return false
  }

  await humanClick(destRadiusDropdown, "Destination radius dropdown")
  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 19: Select destination radius value
  // ----------------------------------------
  const destRadiusValue = prefs.destinationRadius.toString()
  logStep(19, `Selecting destination radius: ${destRadiusValue} miles...`)

  const destRadiusOption = await waitForElement(
    `[aria-label="${destRadiusValue}"]`,
    { shouldContinue }
  )

  if (destRadiusOption) {
    await humanClick(destRadiusOption as HTMLElement, `Destination radius: ${destRadiusValue}`)
  } else {
    console.warn(`[Neblo Relay] Could not find destination radius option: ${destRadiusValue}`)
  }

  await stepDelay()
  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 20: Enter minimum price per mile
  // ----------------------------------------
  if (prefs.minDollarsPerMile) {
    logStep(20, `Entering minimum price per mile: ${prefs.minDollarsPerMile}...`)

    const pricePerMileLabel = getElementByText("p", RELAY_LABELS.pricePerMileMin)
    const minPricePerMileInput =
      pricePerMileLabel?.parentElement?.parentElement?.getElementsByTagName("input")[0]

    if (minPricePerMileInput) {
      await humanClick(minPricePerMileInput as HTMLElement, "Min price per mile input")
      await randomDelay(300, 600)
      await humanType(minPricePerMileInput, prefs.minDollarsPerMile.toString(), {
        description: "Min price per mile",
        shouldContinue
      })
      await stepDelay()

      logStep("20.5", "Clicking start date filter to focus out...")
      const focusOut = document.getElementById(RELAY_SELECTORS.startDateFilter)
      if (focusOut) {
        await humanClick(focusOut, "Start date filter (focus out)")
        await randomDelay(500, 1000)
        await pressEscape()
        await stepDelay()
      }
    } else {
      console.warn("[Neblo Relay] Could not find min price per mile input")
    }
  } else {
    console.log("[Neblo Relay] No minimum price per mile configured, skipping")
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 21: Enter minimum total payout
  // ----------------------------------------
  if (prefs.minTotalPayout) {
    logStep(21, `Entering minimum total payout: ${prefs.minTotalPayout}...`)

    const payoutLabel = getElementByText("p", RELAY_LABELS.payoutMin)
    const minPayoutInput =
      payoutLabel?.parentElement?.parentElement?.getElementsByTagName("input")[0]

    if (minPayoutInput) {
      await humanClick(minPayoutInput as HTMLElement, "Min total payout input")
      await randomDelay(300, 600)
      await humanType(minPayoutInput, prefs.minTotalPayout.toString(), {
        description: "Min total payout",
        shouldContinue
      })
      await stepDelay()

      logStep("21.5", "Clicking start date filter to focus out...")
      const focusOut = document.getElementById(RELAY_SELECTORS.startDateFilter)
      if (focusOut) {
        await humanClick(focusOut, "Start date filter (focus out)")
        await randomDelay(500, 1000)
        await pressEscape()
        await stepDelay()
      }
    } else {
      console.warn("[Neblo Relay] Could not find min total payout input")
    }
  } else {
    console.log("[Neblo Relay] No minimum total payout configured, skipping")
  }

  // ----------------------------------------
  // Steps 22–24: Add excluded cities
  // ----------------------------------------
  if (prefs.excludedCities.length > 0) {
    logStep(22, "Finding excluded cities input...")

    const excludedInput = document.querySelectorAll(
      RELAY_SELECTORS.excludedCityInput
    )[0] as HTMLInputElement | undefined

    if (!excludedInput) {
      console.warn("[Neblo Relay] Could not find excluded cities input")
    } else {
      await humanClick(excludedInput, "Excluded cities input")
      await stepDelay()

      for (let i = 0; i < prefs.excludedCities.length; i++) {
        if (!shouldContinue()) return false

        const city = prefs.excludedCities[i].toUpperCase()
        logStep(23, `Adding excluded city ${i + 1}/${prefs.excludedCities.length}: ${city}`)

        const currentInput = document.querySelectorAll(
          RELAY_SELECTORS.excludedCityInput
        )[0] as HTMLInputElement | undefined

        if (!currentInput) {
          console.error(`[Neblo Relay] Could not find input for excluded city ${i + 1}`)
          continue
        }

        await humanType(currentInput, city, {
          description: `Excluded city ${i + 1}`,
          shouldContinue
        })
        await randomDelay(500, 1000)
        if (!shouldContinue()) return false

        logStep(24, `Selecting "${city}" from dropdown...`)
        const cityOption = await waitForElement(`[aria-label="${city}"]`, {
          timeout: 5000,
          shouldContinue
        })

        if (cityOption) {
          await humanClick(cityOption as HTMLElement, `Excluded city: ${city}`)
        } else {
          console.warn(`[Neblo Relay] Could not find dropdown option for excluded: ${city}`)
        }

        await stepDelay()
      }

      logStep(24, "Pressing Escape to close excluded cities dropdown...")
      await pressEscape()
      await stepDelay()
    }
  } else {
    console.log("[Neblo Relay] No excluded cities configured, skipping")
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Steps 25–28: Fill date/time filters
  // ----------------------------------------
  const startParts = parseDateTimeLocal(prefs.startDateTime)
  const endParts = parseDateTimeLocal(prefs.endDateTime)

  if (startParts) {
    logStep(25, `Entering start date: ${startParts.date}...`)
    const startDateEl = document.getElementById(RELAY_SELECTORS.startDateFilter)
    if (startDateEl) {
      await humanClick(startDateEl as HTMLElement, "Start date input")
      await randomDelay(300, 600)
      await humanType(startDateEl as HTMLInputElement, startParts.date, {
        description: "Start date",
        shouldContinue
      })
      await stepDelay()
    } else {
      console.warn("[Neblo Relay] Could not find start date filter")
    }

    if (!shouldContinue()) return false

    logStep(26, `Entering start time: ${startParts.time}...`)
    const startTimeEl = document.getElementById(RELAY_SELECTORS.startTimeFilter)
    if (startTimeEl) {
      await humanClick(startTimeEl as HTMLElement, "Start time input")
      await randomDelay(300, 600)
      await humanType(startTimeEl as HTMLInputElement, startParts.time, {
        description: "Start time",
        shouldContinue
      })
      await stepDelay()
    } else {
      console.warn("[Neblo Relay] Could not find start time filter")
    }
  } else {
    console.log("[Neblo Relay] No start date/time configured, skipping")
  }

  if (!shouldContinue()) return false

  if (endParts) {
    logStep(27, `Entering end date: ${endParts.date}...`)
    const endDateEl = document.getElementById(RELAY_SELECTORS.endDateFilter)
    if (endDateEl) {
      await humanClick(endDateEl as HTMLElement, "End date input")
      await randomDelay(300, 600)
      await humanType(endDateEl as HTMLInputElement, endParts.date, {
        description: "End date",
        shouldContinue
      })
      await stepDelay()
    } else {
      console.warn("[Neblo Relay] Could not find end date filter")
    }

    if (!shouldContinue()) return false

    logStep(28, `Entering end time: ${endParts.time}...`)
    const endTimeEl = document.getElementById(RELAY_SELECTORS.endTimeFilter)
    if (endTimeEl) {
      await humanClick(endTimeEl as HTMLElement, "End time input")
      await randomDelay(300, 600)
      await humanType(endTimeEl as HTMLInputElement, endParts.time, {
        description: "End time",
        shouldContinue
      })
      await stepDelay()
    } else {
      console.warn("[Neblo Relay] Could not find end time filter")
    }
  } else {
    console.log("[Neblo Relay] No end date/time configured, skipping")
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 29: Select driver types
  // ----------------------------------------
  if (prefs.driverTypes.length > 0) {
    for (const driverType of prefs.driverTypes) {
      if (!shouldContinue()) return false

      logStep(29, `Selecting driver type '${driverType}'...`)
      const driverEl = await waitForElement(
        () => getElementByText("div", driverType),
        { shouldContinue }
      )

      if (driverEl) {
        await humanClick(driverEl as HTMLElement, `Driver type: ${driverType}`)
      } else {
        console.warn(`[Neblo Relay] Could not find driver type: ${driverType}`)
      }
      await stepDelay()
    }
  } else {
    console.log("[Neblo Relay] No driver types configured, skipping")
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 30: Select load types
  // ----------------------------------------
  if (prefs.loadTypes.length > 0) {
    for (const loadType of prefs.loadTypes) {
      if (!shouldContinue()) return false

      logStep(30, `Selecting load type '${loadType}'...`)
      const loadEl = await waitForElement(
        () => getElementByText("div", loadType),
        { shouldContinue }
      )

      if (loadEl) {
        await humanClick(loadEl as HTMLElement, `Load type: ${loadType}`)
      } else {
        console.warn(`[Neblo Relay] Could not find load type: ${loadType}`)
      }
      await stepDelay()
    }
  } else {
    console.log("[Neblo Relay] No load types configured, skipping")
  }

  if (!shouldContinue()) return false

  // ----------------------------------------
  // Step 31: Uncheck unwanted work types
  // (all are checked by default — click the ones NOT in prefs to uncheck them)
  // ----------------------------------------
  if (prefs.workTypes.length > 0) {
    const toUncheck = RELAY_LABELS.workTypes.filter((wt) => !prefs.workTypes.includes(wt))

    for (const workType of toUncheck) {
      if (!shouldContinue()) return false

      logStep(31, `Unchecking work type '${workType}'...`)
      const workEl = await waitForElement(
        () => getElementByText("div", workType),
        { shouldContinue }
      )

      if (workEl) {
        await humanClick(workEl as HTMLElement, `Work type: ${workType}`)
      } else {
        console.warn(`[Neblo Relay] Could not find work type: ${workType}`)
      }
      await stepDelay()
    }
  } else {
    console.log("[Neblo Relay] No work type preferences configured, leaving defaults")
  }

  if (!shouldContinue()) return false

  // ------------------------------------------------------------------
  // All parameters filled — save the search so future runs can skip
  // the full parameter flow and just click the saved search.
  // ------------------------------------------------------------------
  await saveSearch(search.uniqueName, shouldContinue)

  console.log("[Neblo Relay] ========================================")
  console.log(`[Neblo Relay] Search setup complete: "${search.uniqueName}"`)
  console.log("[Neblo Relay] ========================================")

  return true
}
