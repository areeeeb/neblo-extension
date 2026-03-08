/**
 * Shared DOM automation utilities.
 * Loadboard-agnostic — used by any content script that needs human-like browser interaction.
 * All functions are stateless; cancellation is handled via shouldContinue callbacks.
 */

// ============================================
// Timing Utilities
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function randomDelay(min: number, max: number): Promise<void> {
  return sleep(randInt(min, max))
}

// ============================================
// DOM Query Utilities
// ============================================

/**
 * Find element by exact or partial text content within a given tag.
 */
export function getElementByText(
  tagName: string,
  text: string,
  exact: boolean = true
): Element | null {
  const elements = document.getElementsByTagName(tagName)

  for (const element of elements) {
    const content = element.textContent?.trim()
    if (exact && content === text) return element
    if (!exact && content?.includes(text)) return element
  }

  // Fallback: if exact match requested but not found, try includes
  if (exact) {
    for (const element of elements) {
      if (element.textContent?.includes(text)) return element
    }
  }

  return null
}

/**
 * Check if element is visible and interactable.
 */
export function isElementVisible(element: Element): boolean {
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
 * Wait for an element to appear in the DOM (and optionally be visible).
 * Accepts a shouldContinue callback to support cancellation.
 */
export async function waitForElement(
  selector: string | (() => Element | null),
  options: {
    timeout?: number
    visible?: boolean
    shouldContinue?: () => boolean
  } = {}
): Promise<Element | null> {
  const { timeout = 10000, visible = true, shouldContinue } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (shouldContinue && !shouldContinue()) {
      console.log("[Neblo] Automation stopped, aborting wait")
      return null
    }

    const element =
      typeof selector === "function"
        ? selector()
        : document.querySelector(selector)

    if (element && (!visible || isElementVisible(element))) {
      return element
    }

    await randomDelay(100, 200)
  }

  const selectorStr = typeof selector === "function" ? "function" : selector
  console.warn(`[Neblo] Timeout waiting for element: ${selectorStr}`)
  return null
}

// ============================================
// Human-like Interaction
// ============================================

export interface ClickResult {
  x: number
  y: number
  rect: DOMRect
}

export interface ClickOptions {
  scroll?: boolean
  padding?: number
  moveSteps?: number
  minDelay?: number
  maxDelay?: number
}

/**
 * Human-like click with proper event sequence:
 * focus -> mousemove approach -> mouseover/enter -> pointerdown/mousedown -> pointerup/mouseup -> click
 */
export async function humanClick(
  el: HTMLElement,
  description?: string,
  {
    scroll = true,
    padding = 6,
    moveSteps = 8,
    minDelay = 25,
    maxDelay = 120
  }: ClickOptions = {}
): Promise<ClickResult> {
  if (!el) throw new Error("humanClick: element is null/undefined")
  const desc = description || el.tagName

  // Scroll element into view
  if (scroll) {
    try {
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" })
    } catch {
      el.scrollIntoView(true)
    }
    await sleep(randInt(80, 220))
  }

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    throw new Error("humanClick: element has no size (maybe display:none or not in DOM)")
  }

  // Pick a random point inside the element, avoiding edges
  const padX = Math.min(padding, rect.width / 3)
  const padY = Math.min(padding, rect.height / 3)
  const x = rand(rect.left + padX, rect.right - padX)
  const y = rand(rect.top + padY, rect.bottom - padY)

  const dispatch = (
    type: string,
    EventCtor: typeof MouseEvent | typeof PointerEvent,
    props: object
  ) => {
    el.dispatchEvent(
      new EventCtor(type, { bubbles: true, cancelable: true, composed: true, ...props })
    )
  }

  // Focus
  if (typeof el.focus === "function") {
    el.focus({ preventScroll: true })
    await sleep(randInt(minDelay, maxDelay))
  }

  // Simulated mousemove approach
  const fromX = x + rand(-20, 20)
  const fromY = y + rand(-20, 20)

  for (let i = 1; i <= moveSteps; i++) {
    const t = i / moveSteps
    const mx = fromX + (x - fromX) * t + rand(-0.8, 0.8)
    const my = fromY + (y - fromY) * t + rand(-0.8, 0.8)
    dispatch("mousemove", MouseEvent, {
      clientX: mx, clientY: my, screenX: mx, screenY: my, buttons: 0
    })
    await sleep(randInt(5, 18))
  }

  // Hover events
  dispatch("mouseover", MouseEvent, { clientX: x, clientY: y, buttons: 0 })
  dispatch("mouseenter", MouseEvent, { clientX: x, clientY: y, buttons: 0 })
  await sleep(randInt(minDelay, maxDelay))

  // Pointer + mouse down
  dispatch("pointerdown", PointerEvent, {
    pointerId: 1, pointerType: "mouse", isPrimary: true,
    clientX: x, clientY: y, buttons: 1, button: 0
  })
  dispatch("mousedown", MouseEvent, {
    clientX: x, clientY: y, buttons: 1, button: 0
  })

  await sleep(randInt(minDelay, maxDelay) + randInt(10, 80))

  // Pointer + mouse up
  dispatch("pointerup", PointerEvent, {
    pointerId: 1, pointerType: "mouse", isPrimary: true,
    clientX: x, clientY: y, buttons: 0, button: 0
  })
  dispatch("mouseup", MouseEvent, {
    clientX: x, clientY: y, buttons: 0, button: 0
  })

  // Click
  dispatch("click", MouseEvent, {
    clientX: x, clientY: y, buttons: 0, button: 0
  })

  console.log(`[Neblo] Clicked: ${desc}`)
  await sleep(randInt(minDelay, maxDelay))

  return { x, y, rect }
}

/**
 * Set input value using React-compatible native value setter.
 */
export function setNativeValue(element: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  if (valueSetter) {
    valueSetter.call(element, value)
  } else {
    element.value = value
  }
}

export interface TypeOptions {
  description?: string
  shouldContinue?: () => boolean
}

/**
 * Human-like typing that works with React controlled inputs.
 * Types character by character with realistic delays.
 */
export async function humanType(
  element: Element | null,
  text: string,
  options: TypeOptions = {}
): Promise<boolean> {
  const { description, shouldContinue } = options

  if (!element) {
    console.warn(`[Neblo] humanType: element is null${description ? ` (${description})` : ""}`)
    return false
  }

  if (shouldContinue && !shouldContinue()) return false

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
    if (shouldContinue && !shouldContinue()) return false

    const char = text[i]
    currentValue += char

    el.dispatchEvent(new KeyboardEvent("keydown", {
      key: char, bubbles: true, cancelable: true
    }))

    setNativeValue(el, currentValue)
    el.dispatchEvent(new Event("input", { bubbles: true }))

    el.dispatchEvent(new KeyboardEvent("keyup", {
      key: char, bubbles: true, cancelable: true
    }))

    // Variable typing delay — occasional longer pause
    if (Math.random() < 0.1) {
      await randomDelay(150, 300)
    } else {
      await randomDelay(40, 100)
    }
  }

  el.dispatchEvent(new Event("change", { bubbles: true }))
  console.log(`[Neblo] Typed "${text}" into ${desc}`)
  return true
}

/**
 * Press Escape key to close dropdowns/modals.
 */
export async function pressEscape(): Promise<void> {
  document.body.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true
  }))
  await randomDelay(50, 100)
  document.body.dispatchEvent(new KeyboardEvent("keyup", {
    key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true
  }))
  console.log("[Neblo] Pressed Escape")
}

// ============================================
// Logging
// ============================================

export function logStep(step: number | string, message: string): void {
  console.log(`[Neblo] Step ${step}: ${message}`)
}
