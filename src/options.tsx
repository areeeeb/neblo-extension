import { useState, useEffect, useRef } from "react"
import type { ExtensionSettings, EquipmentSettings } from "./types"
import {
    DEFAULT_SETTINGS,
    RADIUS_OPTIONS,
    CITIES,
    POWER_TRACTOR_OPTIONS,
    BOX_TRUCK_OPTIONS,
    WORK_TYPE_OPTIONS,
    DRIVER_TYPE_OPTIONS,
    LOAD_TYPE_OPTIONS,
} from "./types"
import type { ApiConfigSettings } from "~/core/types"
import { DEFAULT_API_CONFIG } from "~/core/types"
import { mergeSettings } from "~/core/storage"
import "~/style.css"

// ─── Reusable Components ────────────────────────────────────────

interface CityPickerProps {
    label: string
    cities: string[]
    maxCities: number
    onChange: (cities: string[]) => void
    emptyMessage: string
    keyPrefix: string
}

function CityPicker({ label, cities, maxCities, onChange, emptyMessage, keyPrefix }: CityPickerProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [showDropdown, setShowDropdown] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filteredCities = CITIES.filter((c) => {
        if (!searchTerm) return true
        const term = searchTerm.toLowerCase()
        return c.city.toLowerCase().includes(term) || c.state.toLowerCase().includes(term)
    })

    const addCity = (cityString: string) => {
        if (cities.length >= maxCities) return
        if (cityString.trim() && !cities.includes(cityString.trim())) {
            onChange([...cities, cityString.trim()])
        }
        setSearchTerm("")
        setShowDropdown(false)
    }

    return (
        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
                {label}
                <span className="ml-2 text-xs font-normal text-gray-500">
                    ({cities.length}/{maxCities})
                </span>
            </label>
            <div className="flex gap-2 mb-3">
                <div className="flex-1 relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        disabled={cities.length >= maxCities}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            setShowDropdown(true)
                        }}
                        onFocus={() => setShowDropdown(true)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") addCity(searchTerm)
                            else if (e.key === "Escape") setShowDropdown(false)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder={cities.length >= maxCities ? "Max cities reached" : "Search city or type manually..."}
                    />
                    {showDropdown && filteredCities.length > 0 && (
                        <div
                            ref={dropdownRef}
                            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
                        >
                            {filteredCities.map((city) => (
                                <div
                                    key={`${keyPrefix}-${city.city}-${city.state}`}
                                    onClick={() => addCity(`${city.city}, ${city.state}`)}
                                    className="px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {city.city}, {city.state}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => addCity(searchTerm)}
                    disabled={cities.length >= maxCities}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Add
                </button>
            </div>
            <div className="space-y-2">
                {cities.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
                ) : (
                    cities.map((city) => (
                        <div
                            key={`${keyPrefix}-list-${city}`}
                            className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border border-gray-200"
                        >
                            <span className="text-sm text-gray-700">{city}</span>
                            <button
                                onClick={() => onChange(cities.filter((c) => c !== city))}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                                Remove
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

interface CheckboxGroupProps {
    label: string
    options: readonly string[]
    selected: string[]
    onChange: (selected: string[]) => void
}

function CheckboxGroup({ label, options, selected, onChange }: CheckboxGroupProps) {
    const toggle = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter((s) => s !== option))
        } else {
            onChange([...selected, option])
        }
    }

    return (
        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
            <div className="space-y-2">
                {options.map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selected.includes(option)}
                            onChange={() => toggle(option)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{option}</span>
                    </label>
                ))}
            </div>
        </div>
    )
}

interface EquipmentSectionProps {
    equipment: EquipmentSettings
    onChange: (equipment: EquipmentSettings) => void
}

// Power Only and Tractor & Trailer share powerTractorOptions; Box Truck has its own.
const EQUIPMENT_GROUPS: {
    selectedKey: "powerOnly" | "tractorTrailer" | "boxTruck"
    label: string
    optionsKey: "powerTractorOptions" | "boxTruckOptions"
    available: readonly string[]
}[] = [
    { selectedKey: "powerOnly", label: "Power Only", optionsKey: "powerTractorOptions", available: POWER_TRACTOR_OPTIONS },
    { selectedKey: "boxTruck", label: "Box Truck", optionsKey: "boxTruckOptions", available: BOX_TRUCK_OPTIONS },
    { selectedKey: "tractorTrailer", label: "Tractor & Trailer", optionsKey: "powerTractorOptions", available: POWER_TRACTOR_OPTIONS },
]

function EquipmentSection({ equipment, onChange }: EquipmentSectionProps) {
    const toggleParent = (selectedKey: "powerOnly" | "tractorTrailer" | "boxTruck", optionsKey: "powerTractorOptions" | "boxTruckOptions") => {
        const wasSelected = equipment[selectedKey]
        const updated = { ...equipment, [selectedKey]: !wasSelected }
        // When unchecking, clear shared options only if the sibling is also unchecked
        if (wasSelected && optionsKey === "powerTractorOptions") {
            const siblingKey = selectedKey === "powerOnly" ? "tractorTrailer" : "powerOnly"
            if (!equipment[siblingKey]) {
                updated.powerTractorOptions = []
            }
        } else if (wasSelected && optionsKey === "boxTruckOptions") {
            updated.boxTruckOptions = []
        }
        onChange(updated)
    }

    const toggleSubOption = (optionsKey: "powerTractorOptions" | "boxTruckOptions", option: string) => {
        const current = equipment[optionsKey]
        const updated = current.includes(option)
            ? current.filter((o) => o !== option)
            : [...current, option]
        onChange({ ...equipment, [optionsKey]: updated })
    }

    const toggleAll = (optionsKey: "powerTractorOptions" | "boxTruckOptions", available: readonly string[]) => {
        const isAllChecked = equipment[optionsKey].length === available.length
        onChange({ ...equipment, [optionsKey]: isAllChecked ? [] : [...available] })
    }

    // Only show sub-options once per optionsKey (skip if a previous sibling already rendered them)
    const renderedOptionsKeys = new Set<string>()

    return (
        <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Equipment Types</label>
            <div className="space-y-4">
                {EQUIPMENT_GROUPS.map(({ selectedKey, label, optionsKey, available }) => {
                    const isSelected = equipment[selectedKey]
                    const currentOptions = equipment[optionsKey]
                    const isAllChecked = currentOptions.length === available.length

                    // For shared options (powerTractorOptions), show sub-options under
                    // whichever parent is checked first; show under both if both checked
                    const shouldShowOptions = isSelected && !renderedOptionsKeys.has(optionsKey)
                    if (isSelected) renderedOptionsKeys.add(optionsKey)

                    return (
                        <div key={selectedKey} className="border border-gray-200 rounded-md p-3">
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleParent(selectedKey, optionsKey)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-800">{label}</span>
                            </label>
                            {shouldShowOptions && (
                                <div className="mt-2 ml-6 space-y-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isAllChecked}
                                            onChange={() => toggleAll(optionsKey, available)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">All</span>
                                    </label>
                                    {available.map((option) => (
                                        <label key={option} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={currentOptions.includes(option)}
                                                onChange={() => toggleSubOption(optionsKey, option)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── API Test Section ───────────────────────────────────────────

function ApiTestSection() {
    const [result, setResult] = useState<{ endpoint: string; data: unknown } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const testEndpoint = async (type: string, label: string, extra?: Record<string, unknown>) => {
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const response = await chrome.runtime.sendMessage({ type, ...extra })
            setResult({ endpoint: label, data: response })
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }

    const testSendLoads = () => {
        const sampleLoad = {
            trip: {
                origin: { city_state: "Chicago, IL", postal_code: "60481" },
                destination: { city_state: "San Antonio, TX", postal_code: "78218" },
                total_miles: 1170.8,
                stops_count: 2
            },
            equipment: { trailer_type: "53 Reefer", driver_mode: "Team" },
            payout: {
                tour_id: "Tour_test_010",
                estimated_total_payout_usd: 5855.80,
                display_rate_usd_per_mile: 5.15,
                load_financials: [{ load_id: "Load_3b7d065e" }]
            },
            stops: [
                { appointment: { arrival: "02/17 19:10 CST" } },
                { appointment: { arrival: "02/18 20:21 CST" } }
            ]
        }
        testEndpoint("API_SEND_LOADS", "Send Loads", { searchUniqueName: "Chicago to Dallas", loads: [sampleLoad] })
    }

    return (
        <div className="mb-6 space-y-4 p-4 border border-amber-300 rounded-md bg-amber-50">
            <h3 className="text-sm font-bold text-amber-800">API Endpoint Tester</h3>
            <p className="text-xs text-amber-700">
                Uses the API config above. Save settings first, then test.
            </p>
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => testEndpoint("API_GET_ADAPTER", "Get Adapter", { adapterType: "PRIVATE_AMAZON_RELAY_PORTAL" })}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 font-medium disabled:bg-gray-400"
                >
                    Get Adapter
                </button>
                <button
                    onClick={() => testEndpoint("API_GET_CREDENTIALS", "Get Credentials")}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 font-medium disabled:bg-gray-400"
                >
                    Get Credentials
                </button>
                <button
                    onClick={() => testEndpoint("API_GET_2FA_CODE", "Get 2FA Code")}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 font-medium disabled:bg-gray-400"
                >
                    Get 2FA Code
                </button>
                <button
                    onClick={() => testEndpoint("API_GET_SEARCHES", "Get Searches")}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 font-medium disabled:bg-gray-400"
                >
                    Get Searches
                </button>
                <button
                    onClick={testSendLoads}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 font-medium disabled:bg-gray-400"
                >
                    Send Loads
                </button>
                <button
                    onClick={() => testEndpoint("API_GET_LOADS_TO_BOOK", "Loads to Book")}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 font-medium disabled:bg-gray-400"
                >
                    Loads to Book
                </button>
                <button
                    onClick={() => testEndpoint("API_UPDATE_LOAD_STATUS", "Update Status", { loadId: "Tour_test_010", status: "Booked" })}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 font-medium disabled:bg-gray-400"
                >
                    Update Status
                </button>
            </div>
            {loading && <p className="text-xs text-amber-700">Loading...</p>}
            {error && (
                <div className="p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                    Error: {error}
                </div>
            )}
            {result && (
                <div>
                    <p className="text-xs font-bold text-gray-700 mb-1">{result.endpoint} response:</p>
                    <pre className="p-3 bg-gray-900 text-green-400 text-xs rounded-md overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(result.data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    )
}

// ─── Options Page ───────────────────────────────────────────────

export default function OptionsPage() {
    const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS)
    const [apiConfig, setApiConfig] = useState<ApiConfigSettings>(DEFAULT_API_CONFIG)
    const [scrapeOverride, setScrapeOverride] = useState(false)
    const [isSaved, setIsSaved] = useState(false)

    useEffect(() => {
        chrome.storage.sync.get(["settings", "apiConfig"], (result) => {
            setSettings(mergeSettings(result.settings))
            if (result.apiConfig) {
                setApiConfig({ ...DEFAULT_API_CONFIG, ...result.apiConfig })
            }
        })
        chrome.storage.local.get("scrapeOverride", (result) => {
            setScrapeOverride(result.scrapeOverride ?? false)
        })
    }, [])

    const handleSave = () => {
        chrome.storage.sync.set({ settings, apiConfig }, () => {
            setIsSaved(true)
            setTimeout(() => setIsSaved(false), 2000)
        })
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">
                    Neblo Load Automation - Settings
                </h1>

                {/* Scrape Override */}
                <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-700">Force Scraping Override</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            When enabled, scraping runs even if the API says "stop".
                            Scraping always runs when the API says "start", regardless of this setting.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            const next = !scrapeOverride
                            setScrapeOverride(next)
                            chrome.storage.local.set({ scrapeOverride: next })
                        }}
                        className={`
                            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                            ${scrapeOverride ? "bg-green-500" : "bg-gray-300"}
                        `}
                        role="switch"
                        aria-checked={scrapeOverride}
                    >
                        <span
                            className={`
                                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                                transition duration-200 ease-in-out
                                ${scrapeOverride ? "translate-x-5" : "translate-x-0"}
                            `}
                        />
                    </button>
                </div>

                {/* API Configuration */}
                <div className="mb-6 space-y-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-700">API Configuration</h3>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Base URL</label>
                        <input
                            type="text"
                            value={apiConfig.baseUrl}
                            onChange={(e) => setApiConfig({ ...apiConfig, baseUrl: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="https://dev-be.neblo.ai/api/extension"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">API Key</label>
                        <input
                            type="password"
                            value={apiConfig.apiKey}
                            onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                            placeholder="Your API key"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Company Code</label>
                        <input
                            type="text"
                            value={apiConfig.companyCode}
                            onChange={(e) => setApiConfig({ ...apiConfig, companyCode: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                            placeholder="e.g. DITR-MC1062178"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Adapter Code</label>
                        <input
                            type="text"
                            value={apiConfig.adapterCode}
                            onChange={(e) => setApiConfig({ ...apiConfig, adapterCode: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                            placeholder="e.g. AMAZONRELAY_PRIVATE_AMAZON_RELAY_PORTAL_B3D7"
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        These values authenticate all API calls. When all fields are set, the extension uses the real API instead of mock data.
                    </p>
                </div>

                {/* API Endpoint Tester */}
                <ApiTestSection />

                {/* Save Button */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-bold"
                    >
                        Save Settings
                    </button>
                    {isSaved && (
                        <span className="text-sm text-green-600 font-medium">
                            Settings saved!
                        </span>
                    )}
                </div>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <h3 className="text-sm font-bold text-blue-800 mb-2">How to use:</h3>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>Enter your API Key, Company Code, and Adapter Code</li>
                        <li>Click Save Settings</li>
                        <li>Use the API Endpoint Tester to verify connectivity</li>
                        <li>Searches are synced automatically from the API</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
