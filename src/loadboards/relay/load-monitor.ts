/**
 * Amazon Relay loadboard load monitoring.
 * Scans visible load cards, marks them as processed, and refreshes periodically.
 * doMonitoringPass() runs a single scan → wait → refresh → scan cycle,
 * designed to be called once per background-scheduler "turn".
 */

import { randomDelay, randInt, humanClick } from "~/core/automation/dom-utils"
import { RELAY_SELECTORS, RELAY_MARKER } from "./selectors"

/**
 * Mark a load card as processed by Neblo.
 */
function markLoadCard(loadCard: Element): void {
  if (loadCard.classList.contains(RELAY_MARKER.className)) return

  loadCard.classList.add(RELAY_MARKER.className)

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
  marker.textContent = RELAY_MARKER.text

  const cardElement = loadCard as HTMLElement
  if (window.getComputedStyle(cardElement).position === "static") {
    cardElement.style.position = "relative"
  }

  loadCard.appendChild(marker)
  console.log("[Neblo Relay] Marked load card")
}

/**
 * Process all visible load cards, marking unprocessed ones.
 */
async function processLoadCards(): Promise<number> {
  const loadList = document.getElementsByClassName(RELAY_SELECTORS.loadList)[0]
  if (!loadList) {
    console.log("[Neblo Relay] Load list not found")
    return 0
  }

  const loadCards = loadList.getElementsByClassName(RELAY_SELECTORS.loadCard)
  let newMarkedCount = 0

  for (const loadCard of loadCards) {
    if (!loadCard.classList.contains(RELAY_MARKER.className)) {
      markLoadCard(loadCard)
      newMarkedCount++
      // Small random pause between marking cards to mimic natural reading pace
      await randomDelay(150, 400)
    }
  }

  if (newMarkedCount > 0) {
    console.log(`[Neblo Relay] Marked ${newMarkedCount} new load cards`)
  }

  return newMarkedCount
}

/**
 * Click the refresh button on the Relay loadboard.
 */
async function clickRefreshButton(): Promise<boolean> {
  const refreshPath = document.querySelector(RELAY_SELECTORS.refreshSvgPath)
  if (!refreshPath) {
    console.warn("[Neblo Relay] Refresh button not found")
    return false
  }

  // Traverse up to find the clickable parent button/anchor
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

/**
 * Single monitoring pass: scan cards → wait → refresh → scan again.
 * Called once per scheduler turn. Completes and returns so the background
 * can rotate to the next tab.
 */
export async function doMonitoringPass(shouldContinue: () => boolean): Promise<void> {
  console.log("[Neblo Relay] Starting monitoring pass...")

  // Scan current load cards
  await processLoadCards()
  if (!shouldContinue()) return

  // Human-like pause before hitting refresh (6-12 seconds — varies naturally)
  const preRefreshDelay = randInt(6000, 12000)
  console.log(`[Neblo Relay] Waiting ${(preRefreshDelay / 1000).toFixed(1)}s before refresh...`)
  await randomDelay(preRefreshDelay, preRefreshDelay + randInt(0, 500))
  if (!shouldContinue()) return

  // Click refresh
  console.log("[Neblo Relay] Clicking refresh...")
  await clickRefreshButton()

  // Wait for page to update after refresh
  await randomDelay(1500, 3000)
  if (!shouldContinue()) return

  // Scan again to catch anything that appeared after the refresh
  await processLoadCards()

  console.log("[Neblo Relay] Monitoring pass complete")
}
