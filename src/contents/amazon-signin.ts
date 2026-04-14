/**
 * Plasmo content script for Amazon sign-in pages.
 *
 * On each page load, asks the background if this tab is the login tab.
 * If yes, delegates to handleSigninPage() which detects the current step
 * (email / password / OTP) and fills in credentials automatically.
 *
 * Each navigation within the sign-in flow creates a new content script
 * instance, so this runs once per page.
 */

import type { PlasmoCSConfig } from "plasmo"
import { handleSigninPage } from "~/loadboards/relay/login-automation"

export const config: PlasmoCSConfig = {
  matches: ["https://www.amazon.com/ap/*"],
  run_at: "document_idle",
}

console.log("[Neblo] Amazon sign-in content script loaded")

// ============================================
// State
// ============================================

let isActive = false

function shouldContinue(): boolean {
  return isActive
}

// ============================================
// Init
// ============================================

async function init(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: "LOGIN_CHECK" })

    if (!response?.shouldLogin) {
      console.log("[Neblo Signin] This tab is not the login tab — standing by")
      return
    }

    console.log("[Neblo Signin] This is the login tab — starting sign-in automation")
    isActive = true
    await handleSigninPage(shouldContinue)
  } catch (error) {
    console.error("[Neblo Signin] Error during init:", error)
  }
}

// ============================================
// Message Handling
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "STOP_AUTOMATION") {
    isActive = false
    sendResponse({ success: true })
    return false
  }

  return true
})

// ============================================
// Start
// ============================================

init()
