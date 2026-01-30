import type { PlasmoCSConfig } from "plasmo"
import type { ExtensionSettings } from "../types"
import { DEFAULT_SETTINGS } from "../types"

// Plasmo content script configuration
export const config: PlasmoCSConfig = {
  matches: ["https://relay.amazon.com/loadboard/*"],
  run_at: "document_idle"
}

console.log("[Neblo Extension] Relay loadboard content script loaded")

let isAutomationActive = false
let isAutomationTab = false
let isAutomationRunning = false // Prevents double execution
let currentSettings: ExtensionSettings = DEFAULT_SETTINGS

// ============================================
// Human-like Automation Utilities
// ============================================

/**
 * Returns a promise that resolves after a random delay between min and max ms
 */
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Delay between major steps (2-8 seconds)
 */
function stepDelay(): Promise<void> {
  return randomDelay(2000, 8000)
}

/**
 * Check if automation should continue (not stopped by user)
 */
function shouldContinue(): boolean {
  return isAutomationActive && isAutomationTab
}

/**
 * Find element by exact or partial text content
 */
function getElementByText(tagName: string, text: string, exact: boolean = true): Element | null {
  const elements = document.getElementsByTagName(tagName)

  // First try exact match
  for (const element of elements) {
    const content = element.textContent?.trim()
    if (exact && content === text) {
      return element
    }
    if (!exact && content?.includes(text)) {
      return element
    }
  }

  // If exact match requested but not found, try includes as fallback
  if (exact) {
    for (const element of elements) {
      if (element.textContent?.includes(text)) {
        return element
      }
    }
  }

  return null
}

/**
 * Check if element is visible and interactable
 */
function isElementVisible(element: Element): boolean {
  const el = element as HTMLElement
  const rect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    style.opacity !== "0"
  )
}

/**
 * Wait for element to appear in DOM and be visible
 */
async function waitForElement(
  selector: string | (() => Element | null),
  options: { timeout?: number; visible?: boolean } = {}
): Promise<Element | null> {
  const { timeout = 10000, visible = true } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (!shouldContinue()) {
      console.log("[Neblo Extension] Automation stopped, aborting wait")
      return null
    }

    let element: Element | null
    if (typeof selector === "function") {
      element = selector()
    } else {
      element = document.querySelector(selector)
    }

    if (element && (!visible || isElementVisible(element))) {
      return element
    }

    await randomDelay(100, 200)
  }

  const selectorStr = typeof selector === "function" ? "function" : selector
  console.warn(`[Neblo Extension] Timeout waiting for element: ${selectorStr}`)
  return null
}

/**
 * Human-like click with proper event sequence
 * Uses only dispatched mouse events to avoid double-clicking issues
 */
async function humanClick(el, description?: string, {
  scroll = true,
  padding = 6,          // keep clicks away from edges
  moveSteps = 8,        // more steps = "smoother" movement
  minDelay = 25,        // ms
  maxDelay = 120        // ms
} = {}) {
  if (!el) throw new Error("humanClick: element is null/undefined");
  const desc = description || el.tagName

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));

  // Ensure element is visible-ish
  if (scroll) {
    try { el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); }
    catch { el.scrollIntoView(true); }
    await sleep(randInt(80, 220));
  }

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error("humanClick: element has no size (maybe display:none or not in DOM)");
  }

  // Pick a point inside the element, avoiding edges
  const padX = Math.min(padding, rect.width / 3);
  const padY = Math.min(padding, rect.height / 3);

  const x = rand(rect.left + padX, rect.right - padX);
  const y = rand(rect.top + padY, rect.bottom - padY);

  // Helper to dispatch events
  const dispatch = (type, EventCtor, props) => {
    const ev = new EventCtor(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      ...props
    });
    el.dispatchEvent(ev);
  };

  // Focus first (common in real interactions)
  if (typeof el.focus === "function") {
    el.focus({ preventScroll: true });
    await sleep(randInt(minDelay, maxDelay));
  }

  // Simulated "mousemove" approach: dispatch a few mousemove events with interpolated coords
  // Note: These events are not "trusted" like real user input, but many UI libs still respond.
  const fromX = x + rand(-20, 20);
  const fromY = y + rand(-20, 20);

  for (let i = 1; i <= moveSteps; i++) {
    const t = i / moveSteps;
    const mx = fromX + (x - fromX) * t + rand(-0.8, 0.8);
    const my = fromY + (y - fromY) * t + rand(-0.8, 0.8);

    dispatch("mousemove", MouseEvent, {
      clientX: mx,
      clientY: my,
      screenX: mx,
      screenY: my,
      buttons: 0
    });
    await sleep(randInt(5, 18));
  }

  // Hover-ish events (some UIs care)
  dispatch("mouseover", MouseEvent, { clientX: x, clientY: y, buttons: 0 });
  dispatch("mouseenter", MouseEvent, { clientX: x, clientY: y, buttons: 0 });
  await sleep(randInt(minDelay, maxDelay));

  // Pointer + mouse down/up/click sequence
  dispatch("pointerdown", PointerEvent, {
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    clientX: x,
    clientY: y,
    buttons: 1,
    button: 0
  });
  dispatch("mousedown", MouseEvent, {
    clientX: x,
    clientY: y,
    buttons: 1,
    button: 0
  });

  await sleep(randInt(minDelay, maxDelay) + randInt(10, 80));

  dispatch("pointerup", PointerEvent, {
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    clientX: x,
    clientY: y,
    buttons: 0,
    button: 0
  });
  dispatch("mouseup", MouseEvent, {
    clientX: x,
    clientY: y,
    buttons: 0,
    button: 0
  });

  // Click (and possibly dblclick if you want)
  dispatch("click", MouseEvent, {
    clientX: x,
    clientY: y,
    buttons: 0,
    button: 0
  });

  console.log(`[Neblo Extension] Clicked: ${desc}`)

  await sleep(randInt(minDelay, maxDelay));
  return { x, y, rect };
}

/**
 * Set input value using React-compatible method
 * This works by using the native value setter to bypass React's controlled input
 */
function setNativeValue(element: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  if (valueSetter) {
    valueSetter.call(element, value)
  } else {
    element.value = value
  }
}

/**
 * Human-like typing that works with React controlled inputs
 * Types character by character with realistic delays
 */
async function humanType(element: Element | null, text: string, description?: string): Promise<boolean> {
  if (!element) {
    console.warn(`[Neblo Extension] humanType: element is null${description ? ` (${description})` : ""}`)
    return false
  }

  if (!shouldContinue()) {
    return false
  }

  const el = element as HTMLInputElement
  const desc = description || "input"

  // Focus the element
  el.focus()
  el.dispatchEvent(new FocusEvent("focus", { bubbles: true }))
  await randomDelay(100, 200)

  // Clear existing value
  setNativeValue(el, "")
  el.dispatchEvent(new Event("input", { bubbles: true }))
  await randomDelay(50, 100)

  // Type character by character
  let currentValue = ""
  for (let i = 0; i < text.length; i++) {
    if (!shouldContinue()) {
      return false
    }

    const char = text[i]
    currentValue += char

    // Dispatch keydown
    el.dispatchEvent(new KeyboardEvent("keydown", {
      key: char,
      bubbles: true,
      cancelable: true
    }))

    // Set the value using native setter (React-compatible)
    setNativeValue(el, currentValue)

    // Dispatch input event (React listens to this)
    el.dispatchEvent(new Event("input", { bubbles: true }))

    // Dispatch keyup
    el.dispatchEvent(new KeyboardEvent("keyup", {
      key: char,
      bubbles: true,
      cancelable: true
    }))

    // Variable typing delay - occasionally pause longer
    if (Math.random() < 0.1) {
      await randomDelay(150, 300) // Occasional pause
    } else {
      await randomDelay(40, 100) // Normal typing speed
    }
  }

  // Final change event
  el.dispatchEvent(new Event("change", { bubbles: true }))

  console.log(`[Neblo Extension] Typed "${text}" into ${desc}`)
  return true
}

/**
 * Press Escape key to close dropdowns/modals
 */
async function pressEscape(): Promise<void> {
  document.body.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
    bubbles: true,
    cancelable: true
  }))

  await randomDelay(50, 100)

  document.body.dispatchEvent(new KeyboardEvent("keyup", {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
    bubbles: true,
    cancelable: true
  }))

  console.log("[Neblo Extension] Pressed Escape")
}

/**
 * Log step with consistent formatting
 */
function logStep(step: number, message: string): void {
  console.log(`[Neblo Extension] Step ${step}: ${message}`)
}

// ============================================
// Main Automation Flow
// ============================================

async function runSearchAutomation(): Promise<void> {
  // Prevent double execution
  if (isAutomationRunning) {
    console.log("[Neblo Extension] Automation already running, skipping duplicate call")
    return
  }
  isAutomationRunning = true

  console.log("[Neblo Extension] ========================================")
  console.log("[Neblo Extension] Starting search automation")
  console.log("[Neblo Extension] Settings:", JSON.stringify(currentSettings, null, 2))
  console.log("[Neblo Extension] ========================================")

  try {
    // ----------------------------------------
    // Step 1: Click "New Search" button
    // ----------------------------------------
    logStep(1, "Looking for 'New Search' button...")

    const newSearchSpan = await waitForElement(
      () => getElementByText("span", "New Search"),
      { timeout: 15000 }
    )

    if (!newSearchSpan) {
      console.error("[Neblo Extension] FATAL: Could not find 'New Search' button")
      return
    }

    await humanClick(newSearchSpan, "New Search button")
    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 2: Click the origin city input field
    // ----------------------------------------
    logStep(2, "Clicking origin city input...")

    const searchPanel = await waitForElement(".search__panel")
    if (!searchPanel) {
      console.error("[Neblo Extension] FATAL: Could not find search panel")
      return
    }

    const originInput = searchPanel.querySelector("input")
    if (!originInput) {
      console.error("[Neblo Extension] FATAL: Could not find origin input in search panel")
      return
    }

    await humanClick(originInput, "Origin city input")
    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Steps 3-5: Add each origin city
    // ----------------------------------------
    for (let i = 0; i < currentSettings.originCities.length; i++) {
      if (!shouldContinue()) return

      const cityRaw = currentSettings.originCities[i]
      const city = cityRaw.toUpperCase()

      logStep(3, `Adding origin city ${i + 1}/${currentSettings.originCities.length}: ${city}`)

      // Get fresh reference to input
      const currentPanel = document.querySelector(".search__panel")
      const currentInput = currentPanel?.querySelector("input") as HTMLInputElement

      if (!currentInput) {
        console.error(`[Neblo Extension] Could not find input for origin city ${i + 1}`)
        continue
      }

      // Type the city name
      await humanType(currentInput, city, `Origin city ${i + 1}`)
      await randomDelay(500, 1000) // Wait for dropdown to appear

      if (!shouldContinue()) return

      // Click the dropdown option
      logStep(4, `Selecting "${city}" from dropdown...`)
      const cityOption = await waitForElement(
        `[aria-label="${city}"]`,
        { timeout: 5000 }
      )

      if (cityOption) {
        await humanClick(cityOption, `City option: ${city}`)
      } else {
        console.warn(`[Neblo Extension] Could not find dropdown option for: ${city}`)
      }

      await stepDelay()
    }

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 6: Click Equipment dropdown
    // ----------------------------------------
    logStep(6, "Clicking Equipment dropdown...")

    const equipmentDropdown = await waitForElement('[aria-label="Equipment*"]')
    if (!equipmentDropdown) {
      console.error("[Neblo Extension] Could not find Equipment dropdown")
      return
    }

    await humanClick(equipmentDropdown, "Equipment dropdown")
    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 7: Select "Power only"
    // ----------------------------------------
    logStep(7, "Selecting 'Power only'...")

    const powerOnlyLabel = await waitForElement(
      () => getElementByText("label", "Power only")
    )

    if (powerOnlyLabel) {
      await humanClick(powerOnlyLabel, "Power only checkbox")
    } else {
      console.warn("[Neblo Extension] Could not find 'Power only' option")
    }

    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 8: Select "53' Trailer"
    // ----------------------------------------
    logStep(8, "Selecting 53' Trailer...")

    const trailerOption = await waitForElement(
      () => getElementByText("div", "53' Trailer")
    )

    if (trailerOption) {
      await humanClick(trailerOption, "53' Trailer option")
    } else {
      console.warn("[Neblo Extension] Could not find 53' Trailer option")
    }

    await stepDelay()

    // Press escape to close equipment dropdown
    await pressEscape()
    await randomDelay(300, 500)

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 9: Click origin radius dropdown
    // ----------------------------------------
    logStep(9, "Clicking origin radius dropdown...")

    const originRadiusLabel = document.getElementById("rlb-origin-radius-filter-label")
    if (!originRadiusLabel) {
      console.error("[Neblo Extension] Could not find origin radius dropdown")
      return
    }

    await humanClick(originRadiusLabel, "Origin radius dropdown")
    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 10: Select origin radius value
    // ----------------------------------------
    const originRadiusValue = currentSettings.originRadius.toString()
    logStep(10, `Selecting origin radius: ${originRadiusValue} miles...`)

    const originRadiusOption = await waitForElement(`[aria-label="${originRadiusValue}"]`)

    if (originRadiusOption) {
      await humanClick(originRadiusOption, `Origin radius: ${originRadiusValue}`)
    } else {
      console.warn(`[Neblo Extension] Could not find origin radius option: ${originRadiusValue}`)
    }

    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 11: Click destination region filter
    // ----------------------------------------
    logStep(11, "Clicking destination region filter...")

    const destRegionFilter = document.getElementById("rlb-destination-region-city-filter")
    if (!destRegionFilter) {
      console.error("[Neblo Extension] Could not find destination region filter")
      return
    }

    await humanClick(destRegionFilter, "Destination region filter")
    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 12: Select "City" option
    // ----------------------------------------
    logStep(12, "Selecting 'City' option...")

    const cityFilterOption = await waitForElement('[aria-label="City"]')

    if (cityFilterOption) {
      await humanClick(cityFilterOption, "City filter option")
    } else {
      console.warn("[Neblo Extension] Could not find 'City' option")
    }

    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 13: Click destination city input (with retry logic)
    // ----------------------------------------
    logStep(13, "Clicking destination city input...")

    const destCityInputSelector = '[aria-labelledby="rlb-destination-city-filter-value rlb-destination-city-filter-label"]'
    let destCityInput: Element | null = null
    const maxRetries = 5

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!shouldContinue()) return

      destCityInput = await waitForElement(destCityInputSelector, { timeout: 5000, visible: false })

      if (destCityInput) {
        console.log(`[Neblo Extension] Found destination city input on attempt ${attempt}`)
        break
      }

      console.warn(`[Neblo Extension] Attempt ${attempt}/${maxRetries}: Could not find destination city input, retrying...`)

      // Try clicking the City option again in case dropdown closed
      if (attempt < maxRetries) {
        const cityOptionRetry = await waitForElement('[aria-label="City"]', { timeout: 2000 })
        if (cityOptionRetry) {
          await humanClick(cityOptionRetry, "City filter option (retry)")
        }
        await randomDelay(1000, 2000)
      }
    }

    if (!destCityInput) {
      console.error("[Neblo Extension] Could not find destination city input after all retries")
      return
    }

    await humanClick(destCityInput, "Destination city input")
    await stepDelay()

    // ----------------------------------------
    // Steps 14-16: Add each destination city
    // ----------------------------------------
    if (currentSettings.destinationCities.length > 0) {
      for (let i = 0; i < currentSettings.destinationCities.length; i++) {
        if (!shouldContinue()) return

        const cityRaw = currentSettings.destinationCities[i]
        const city = cityRaw.toUpperCase()

        logStep(14, `Adding destination city ${i + 1}/${currentSettings.destinationCities.length}: ${city}`)

        // Get fresh reference to destination input
        const currentDestInput = document.querySelector(destCityInputSelector) as HTMLInputElement

        if (!currentDestInput) {
          console.error(`[Neblo Extension] Could not find input for destination city ${i + 1}`)
          continue
        }

        // Type the city name
        await humanType(currentDestInput, city, `Destination city ${i + 1}`)
        await randomDelay(500, 1000) // Wait for dropdown

        if (!shouldContinue()) return

        // Click the dropdown option
        logStep(15, `Selecting "${city}" from dropdown...`)
        const destCityOption = await waitForElement(
          `[aria-label="${city}"]`,
          { timeout: 5000 }
        )

        if (destCityOption) {
          await humanClick(destCityOption, `Destination city: ${city}`)
        } else {
          console.warn(`[Neblo Extension] Could not find dropdown option for destination: ${city}`)
        }

        await stepDelay()
      }

      // ----------------------------------------
      // Step 17: Press Escape to close dropdown
      // ----------------------------------------
      logStep(17, "Pressing Escape to close dropdown...")
      await pressEscape()
      await stepDelay()
    } else {
      console.log("[Neblo Extension] No destination cities configured, skipping steps 14-17")
    }

    if (!shouldContinue()) return

    // ----------------------------------------
    // Click start date filter to focus out of destination cities
    // ----------------------------------------
    logStep(17.5, "Clicking start date filter to focus out...")

    const startDateFilter = document.getElementById("rlb-start-date-filter")
    if (startDateFilter) {
      await humanClick(startDateFilter, "Start date filter (focus out)")
      await randomDelay(500, 1000)
      await pressEscape() // Close any date picker that might open
      await stepDelay()
    }

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 18: Click destination radius dropdown
    // ----------------------------------------
    logStep(18, "Clicking destination radius dropdown...")

    const destRadiusDropdown = document.getElementById("rlb-destination-radius-filter-value")

    if (!destRadiusDropdown) {
      console.error("[Neblo Extension] Could not find destination radius dropdown")
      return
    }

    await humanClick(destRadiusDropdown, "Destination radius dropdown")
    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 19: Select destination radius value
    // ----------------------------------------
    const destRadiusValue = currentSettings.destinationRadius.toString()
    logStep(19, `Selecting destination radius: ${destRadiusValue} miles...`)

    const destRadiusOption = await waitForElement(`[aria-label="${destRadiusValue}"]`)

    if (destRadiusOption) {
      await humanClick(destRadiusOption, `Destination radius: ${destRadiusValue}`)
    } else {
      console.warn(`[Neblo Extension] Could not find destination radius option: ${destRadiusValue}`)
    }

    await stepDelay()

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 20: Enter minimum price per mile
    // ----------------------------------------
    const pricePerMileLabel = getElementByText('p', 'Price/mile (min)')
    const minPricePerMileInput = pricePerMileLabel?.parentElement?.parentElement?.getElementsByTagName('input')[0]

    if (currentSettings.minDollarsPerMile) {
      logStep(20, `Entering minimum price per mile: ${currentSettings.minDollarsPerMile}...`)

      if (minPricePerMileInput) {
        await humanClick(minPricePerMileInput, "Min price per mile input")
        await randomDelay(300, 600)
        await humanType(minPricePerMileInput, currentSettings.minDollarsPerMile.toString(), "Min price per mile")
        await stepDelay()

        // Focus out by clicking start date filter
        logStep(20.5, "Clicking start date filter to focus out...")
        const startDateFilterFocusOut = document.getElementById("rlb-start-date-filter")
        if (startDateFilterFocusOut) {
          await humanClick(startDateFilterFocusOut, "Start date filter (focus out)")
          await randomDelay(500, 1000)
          await pressEscape()
          await stepDelay()
        }
      } else {
        console.warn("[Neblo Extension] Could not find min price per mile input")
      }
    } else {
      console.log("[Neblo Extension] No minimum price per mile configured, skipping step 20")
    }

    if (!shouldContinue()) return

    // ----------------------------------------
    // Step 21: Enter minimum total payout
    // ----------------------------------------
    if (currentSettings.minTotalPayout) {
      logStep(21, `Entering minimum total payout: ${currentSettings.minTotalPayout}...`)

      const payoutLabel = getElementByText('p', 'Payout (min)')
      const minPayoutInput = payoutLabel?.parentElement?.parentElement?.getElementsByTagName('input')[0]

      if (minPayoutInput) {
        await humanClick(minPayoutInput, "Min total payout input")
        await randomDelay(300, 600)
        await humanType(minPayoutInput, currentSettings.minTotalPayout.toString(), "Min total payout")
        await stepDelay()

        // Focus out by clicking start date filter
        logStep(21.5, "Clicking start date filter to focus out...")
        const startDateFilterFocusOut2 = document.getElementById("rlb-start-date-filter")
        if (startDateFilterFocusOut2) {
          await humanClick(startDateFilterFocusOut2, "Start date filter (focus out)")
          await randomDelay(500, 1000)
          await pressEscape()
          await stepDelay()
        }
      } else {
        console.warn("[Neblo Extension] Could not find min total payout input")
      }
    } else {
      console.log("[Neblo Extension] No minimum total payout configured, skipping step 21")
    }

    // ----------------------------------------
    // Complete - Start monitoring loads
    // ----------------------------------------
    console.log("[Neblo Extension] ========================================")
    console.log("[Neblo Extension] Search automation completed successfully!")
    console.log("[Neblo Extension] Starting load monitoring...")
    console.log("[Neblo Extension] ========================================")

    // Start the monitoring loop
    await monitorLoads()

  } catch (error) {
    console.error("[Neblo Extension] Error during search automation:", error)
  } finally {
    isAutomationRunning = false
  }
}

// ============================================
// Load Monitoring
// ============================================

const NEBLO_MARKER_CLASS = "neblo-marked"
const NEBLO_MARKER_TEXT = "Scanned by Neblo"

/**
 * Mark a load card as processed by Neblo
 */
function markLoadCard(loadCard: Element): void {
  // Check if already marked
  if (loadCard.classList.contains(NEBLO_MARKER_CLASS)) {
    return
  }

  // Add marker class
  loadCard.classList.add(NEBLO_MARKER_CLASS)

  // Create the marker element
  const marker = document.createElement("div")
  marker.style.cssText = `
    position: absolute;
    top: 4px;
    right: 4px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `
  marker.textContent = NEBLO_MARKER_TEXT

  // Make the load card position relative if not already
  const cardElement = loadCard as HTMLElement
  const computedStyle = window.getComputedStyle(cardElement)
  if (computedStyle.position === "static") {
    cardElement.style.position = "relative"
  }

  // Add the marker to the load card
  loadCard.appendChild(marker)

  console.log("[Neblo Extension] Marked load card:", loadCard)
}

/**
 * Process all visible load cards one by one with delay
 */
async function processLoadCards(): Promise<number> {
  const loadList = document.getElementsByClassName("load-list")[0]
  if (!loadList) {
    console.log("[Neblo Extension] Load list not found")
    return 0
  }

  const loadCards = loadList.getElementsByClassName("load-card")
  let newMarkedCount = 0

  for (const loadCard of loadCards) {
    if (!loadCard.classList.contains(NEBLO_MARKER_CLASS)) {
      markLoadCard(loadCard)
      newMarkedCount++
      // Small delay between marking each card
      await randomDelay(150, 350)
    }
  }

  if (newMarkedCount > 0) {
    console.log(`[Neblo Extension] Marked ${newMarkedCount} new load cards`)
  }

  return newMarkedCount
}

/**
 * Click the refresh button
 */
async function clickRefreshButton(): Promise<boolean> {
  // Find refresh button by the SVG path
  const refreshPath = document.querySelector('[d="M20.128 2l-.493 5.635L14 7.142M19.44 6.935a9 9 0 101.023 8.134"]')

  if (!refreshPath) {
    console.warn("[Neblo Extension] Refresh button not found")
    return false
  }

  // Get the clickable parent (usually svg -> button or clickable container)
  let clickableElement: Element | null = refreshPath

  // Traverse up to find a clickable element (button, div with click handler, etc.)
  for (let i = 0; i < 5; i++) {
    const parent = clickableElement?.parentElement
    if (!parent) break
    clickableElement = parent

    // Check if this is likely the clickable element
    const tagName = parent.tagName.toLowerCase()
    if (tagName === "button" || tagName === "a" || parent.getAttribute("role") === "button") {
      break
    }
  }

  if (clickableElement) {
    await humanClick(clickableElement, "Refresh button")
    return true
  }

  return false
}

/**
 * Main monitoring loop - runs indefinitely
 */
async function monitorLoads(): Promise<void> {
  console.log("[Neblo Extension] Starting load monitoring loop...")

  while (shouldContinue()) {
    // Process any new load cards
    processLoadCards()

    // Random delay between 5-11 seconds
    const refreshDelay = Math.floor(Math.random() * 6000) + 5000 // 5000-11000ms
    console.log(`[Neblo Extension] Waiting ${(refreshDelay / 1000).toFixed(1)}s before refresh...`)

    await randomDelay(refreshDelay, refreshDelay + 100)

    if (!shouldContinue()) break

    // Click refresh button
    console.log("[Neblo Extension] Clicking refresh...")
    await clickRefreshButton()

    // Wait a bit for the page to update after refresh
    await randomDelay(1000, 2000)
  }

  console.log("[Neblo Extension] Load monitoring stopped")
}

// ============================================
// Initialization & Message Handling
// ============================================

async function getCurrentTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_CURRENT_TAB_ID" }, (response) => {
      resolve(response?.tabId || null)
    })
  })
}

async function checkIfAutomationTab(): Promise<boolean> {
  const currentTabId = await getCurrentTabId()
  if (!currentTabId) return false

  const result = await chrome.storage.local.get("automationTabId")
  return result.automationTabId === currentTabId
}

async function init() {
  console.log("[Neblo Extension] Initializing relay loadboard content script")

  isAutomationTab = await checkIfAutomationTab()

  if (!isAutomationTab) {
    console.log("[Neblo Extension] This is not the automation tab, staying dormant")
    return
  }

  console.log("[Neblo Extension] This is the automation tab, activating...")

  const result = await chrome.storage.sync.get("settings")
  if (result.settings) {
    currentSettings = { ...DEFAULT_SETTINGS, ...result.settings }
  }

  const localResult = await chrome.storage.local.get("isAutomationRunning")
  isAutomationActive = localResult.isAutomationRunning || false

  if (isAutomationActive) {
    console.log("[Neblo Extension] Automation is active, waiting for page to stabilize...")
    await randomDelay(2000, 3000)
    runSearchAutomation()
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Neblo Extension] Relay content script received message:", message)

  if (message.type === "START_AUTOMATION") {
    isAutomationTab = true
    currentSettings = { ...DEFAULT_SETTINGS, ...message.settings }
    isAutomationActive = true

    randomDelay(2000, 3000).then(() => {
      runSearchAutomation()
    })

    sendResponse({ success: true })
  } else if (message.type === "STOP_AUTOMATION") {
    isAutomationActive = false
    isAutomationTab = false
    console.log("[Neblo Extension] Automation stopped by user")
    sendResponse({ success: true })
  }

  return true
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!isAutomationTab) return

  if (areaName === "sync" && changes.settings) {
    console.log("[Neblo Extension] Settings updated")
    currentSettings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue }
  }

  if (areaName === "local" && changes.isAutomationRunning) {
    isAutomationActive = changes.isAutomationRunning.newValue
  }

  if (areaName === "local" && changes.automationTabId && !changes.automationTabId.newValue) {
    isAutomationTab = false
    isAutomationActive = false
    console.log("[Neblo Extension] Automation tab cleared, deactivating")
  }
})

init()
