import { useState, useEffect } from "react"
import type { ExtensionSettings } from "./types"
import { DEFAULT_SETTINGS } from "./types"
import "~/style.css"

export default function Popup() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS)
  const [isRunning, setIsRunning] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  // Load settings on mount (merge with defaults for new fields)
  useEffect(() => {
    chrome.storage.sync.get("settings", (result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings })
      }
    })

    // Check if automation is running
    chrome.storage.local.get("isAutomationRunning", (result) => {
      setIsRunning(result.isAutomationRunning || false)
    })
  }, [])

  // Format date/time for display
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "Not set"
    const date = new Date(dateStr)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })
  }

  const handleStart = async () => {
    // Validate settings
    if (settings.originCities.length === 0) {
      setStatusMessage("❌ Please add origin cities in settings first")
      return
    }

    setStatusMessage("Opening Amazon Relay loadboard...")
    setIsRunning(true)

    // Store running state
    await chrome.storage.local.set({ isAutomationRunning: true })

    // Send message to background script to start
    chrome.runtime.sendMessage({ type: "START_AUTOMATION_FROM_POPUP" }, (response) => {
      if (response?.success) {
        setStatusMessage("Automation active on Relay loadboard")
      } else {
        setStatusMessage("Failed to start automation")
        setIsRunning(false)
      }
    })
  }

  const handleStop = async () => {
    setStatusMessage("Stopping automation...")
    setIsRunning(false)

    // Store running state
    await chrome.storage.local.set({ isAutomationRunning: false })

    // Send message to background script to stop
    chrome.runtime.sendMessage({ type: "STOP_ALL_AUTOMATION" }, (response) => {
      if (response?.success) {
        setStatusMessage("Automation stopped")
      }
    })
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="w-80 p-4 bg-white">
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">Neblo Load Automation</h1>
        <p className="text-xs text-gray-500 mt-1">Automated load monitoring & booking</p>
      </div>

      {/* Settings Summary */}
      <div className="mb-4 space-y-3 text-sm">
        {/* Rate Filters */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Min $/mile</div>
            <div className="font-medium">
              {settings.minDollarsPerMile ? `$${settings.minDollarsPerMile.toFixed(2)}` : "Any"}
            </div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Min Payout</div>
            <div className="font-medium">
              {settings.minTotalPayout ? `$${settings.minTotalPayout}` : "Any"}
            </div>
          </div>
        </div>


        {/* Radius Settings */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Origin Radius</div>
            <div className="font-medium">{settings.originRadius} mi</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Dest Radius</div>
            <div className="font-medium">{settings.destinationRadius} mi</div>
          </div>
        </div>

        {/* Origin Cities */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500 mb-1">
            Origin Cities ({settings.originCities.length})
          </div>
          {settings.originCities.length > 0 ? (
            <div className="text-xs space-y-0.5">
              {settings.originCities.slice(0, 3).map((city) => (
                <div key={city} className="text-gray-700">• {city}</div>
              ))}
              {settings.originCities.length > 3 && (
                <div className="text-gray-400">+ {settings.originCities.length - 3} more</div>
              )}
            </div>
          ) : (
            <div className="text-orange-600 text-xs">No cities configured</div>
          )}
        </div>

        {/* Destination Cities */}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500 mb-1">
            Destination Cities ({settings.destinationCities.length})
          </div>
          {settings.destinationCities.length > 0 ? (
            <div className="text-xs space-y-0.5">
              {settings.destinationCities.slice(0, 3).map((city) => (
                <div key={city} className="text-gray-700">• {city}</div>
              ))}
              {settings.destinationCities.length > 3 && (
                <div className="text-gray-400">+ {settings.destinationCities.length - 3} more</div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-xs">Any destination</div>
          )}
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          {statusMessage}
        </div>
      )}

      {/* Control Buttons */}
      <div className="space-y-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            Start Automation
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            Stop Automation
          </button>
        )}

        <button
          onClick={openOptions}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors text-sm"
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Info */}
      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
        <p>
          {isRunning
            ? "Monitoring Amazon Relay loadboard for qualifying loads."
            : "Click Start to open Relay loadboard and begin monitoring."}
        </p>
      </div>
    </div>
  )
}
