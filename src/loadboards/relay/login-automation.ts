/**
 * Amazon Relay sign-in page automation.
 * Detects which step of the login flow is showing (email, password, OTP)
 * and fills in credentials fetched from the API via background message passing.
 *
 * Each page navigation creates a new content script instance, so this function
 * handles exactly one step per invocation.
 */

import {
  randomDelay,
  waitForElement,
  humanClick,
  humanType,
  logStep,
} from "~/core/automation/dom-utils"
import { AMAZON_SIGNIN_SELECTORS } from "./selectors"

// ============================================
// Timing Profile
// ============================================

const TIMING_MODE: "fast" | "prod" = "fast"

const TIMING = {
  fast: { stepMin: 300, stepMax: 600, shortMin: 100, shortMax: 300 },
  prod: { stepMin: 2000, stepMax: 8000, shortMin: 500, shortMax: 1000 },
}[TIMING_MODE]

function stepDelay(): Promise<void> {
  return randomDelay(TIMING.stepMin, TIMING.stepMax)
}

function shortDelay(): Promise<void> {
  return randomDelay(TIMING.shortMin, TIMING.shortMax)
}

// ============================================
// Step Detection
// ============================================

type SigninStep = "email" | "password" | "otp" | "unknown"

function detectStep(): SigninStep {
  if (document.querySelector(AMAZON_SIGNIN_SELECTORS.otpInput)) return "otp"
  if (document.querySelector(AMAZON_SIGNIN_SELECTORS.passwordInput)) return "password"
  if (document.querySelector(AMAZON_SIGNIN_SELECTORS.emailInput)) return "email"
  return "unknown"
}

// ============================================
// Step Handlers
// ============================================

async function handleEmailStep(shouldContinue: () => boolean): Promise<void> {
  logStep("Login-1", "Email step detected — fetching credentials...")

  const response = await chrome.runtime.sendMessage({ type: "API_GET_CREDENTIALS" })
  if (!response?.success || !response.data) {
    console.error("[Neblo Signin] Failed to get credentials:", response?.error)
    return
  }

  const { email } = response.data
  if (!email) {
    console.error("[Neblo Signin] No email in credentials response")
    return
  }

  const emailInput = await waitForElement(AMAZON_SIGNIN_SELECTORS.emailInput, {
    timeout: 5000,
    shouldContinue,
  })
  if (!emailInput || !shouldContinue()) return

  await humanType(emailInput as HTMLInputElement, email, {
    description: "Email input",
    shouldContinue,
  })
  await shortDelay()
  if (!shouldContinue()) return

  logStep("Login-2", "Clicking continue button...")
  const continueBtn = await waitForElement(AMAZON_SIGNIN_SELECTORS.continueButton, {
    timeout: 5000,
    shouldContinue,
  })
  if (!continueBtn || !shouldContinue()) return

  await humanClick(continueBtn as HTMLElement, "Continue button")
  await stepDelay()
}

async function handlePasswordStep(shouldContinue: () => boolean): Promise<void> {
  logStep("Login-3", "Password step detected — fetching credentials...")

  const response = await chrome.runtime.sendMessage({ type: "API_GET_CREDENTIALS" })
  if (!response?.success || !response.data) {
    console.error("[Neblo Signin] Failed to get credentials:", response?.error)
    return
  }

  const { password } = response.data
  if (!password) {
    console.error("[Neblo Signin] No password in credentials response")
    return
  }

  const passwordInput = await waitForElement(AMAZON_SIGNIN_SELECTORS.passwordInput, {
    timeout: 5000,
    shouldContinue,
  })
  if (!passwordInput || !shouldContinue()) return

  await humanType(passwordInput as HTMLInputElement, password, {
    description: "Password input",
    shouldContinue,
  })
  await shortDelay()
  if (!shouldContinue()) return

  logStep("Login-4", "Clicking sign-in button...")
  const signInBtn = await waitForElement(AMAZON_SIGNIN_SELECTORS.signInButton, {
    timeout: 5000,
    shouldContinue,
  })
  if (!signInBtn || !shouldContinue()) return

  await humanClick(signInBtn as HTMLElement, "Sign In button")
  await stepDelay()
}

async function handleOtpStep(shouldContinue: () => boolean): Promise<void> {
  logStep("Login-5", "OTP step detected — fetching 2FA code...")

  const submitOtp = async (isRetry: boolean): Promise<boolean> => {
    const response = await chrome.runtime.sendMessage({ type: "API_GET_2FA_CODE" })
    if (!response?.success || !response.data) {
      console.error(
        `[Neblo Signin] Failed to get 2FA code${isRetry ? " (retry)" : ""}:`,
        response?.error
      )
      return false
    }

    const { code } = response.data
    if (!code) {
      console.error("[Neblo Signin] No code in 2FA response")
      return false
    }

    const otpInput = await waitForElement(AMAZON_SIGNIN_SELECTORS.otpInput, {
      timeout: 5000,
      shouldContinue,
    })
    if (!otpInput || !shouldContinue()) return false

    await humanType(otpInput as HTMLInputElement, code, {
      description: `OTP input${isRetry ? " (retry)" : ""}`,
      shouldContinue,
    })
    await shortDelay()
    if (!shouldContinue()) return false

    logStep("Login-6", `Clicking OTP submit button${isRetry ? " (retry)" : ""}...`)
    const submitBtn = await waitForElement(AMAZON_SIGNIN_SELECTORS.otpSubmitButton, {
      timeout: 5000,
      shouldContinue,
    })
    if (!submitBtn || !shouldContinue()) return false

    await humanClick(submitBtn as HTMLElement, "OTP submit button")
    await stepDelay()
    return true
  }

  const firstAttempt = await submitOtp(false)
  if (!firstAttempt || !shouldContinue()) return

  // Check if we're still on the OTP page (indicates failure) — retry once after 5s with fresh code
  await randomDelay(3000, 5000)
  if (!shouldContinue()) return

  const stillOnOtp = document.querySelector(AMAZON_SIGNIN_SELECTORS.otpInput)
  if (stillOnOtp) {
    console.warn("[Neblo Signin] Still on OTP page after first attempt — retrying with fresh code...")
    await randomDelay(3000, 5000)
    if (!shouldContinue()) return
    await submitOtp(true)
  }
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Handle the current Amazon sign-in page step.
 * Detects which step is showing and fills in the appropriate credentials.
 */
export async function handleSigninPage(shouldContinue: () => boolean): Promise<void> {
  // Brief pause to let the page fully render
  await randomDelay(500, 1500)
  if (!shouldContinue()) return

  const step = detectStep()
  console.log(`[Neblo Signin] Detected sign-in step: ${step}`)

  switch (step) {
    case "email":
      await handleEmailStep(shouldContinue)
      break
    case "password":
      await handlePasswordStep(shouldContinue)
      break
    case "otp":
      await handleOtpStep(shouldContinue)
      break
    case "unknown":
      console.warn("[Neblo Signin] Could not detect sign-in step — page may have changed")
      break
  }
}
