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
    const [companyName, setCompanyName] = useState("acme-logistics")
    const [result, setResult] = useState<{ endpoint: string; data: unknown } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const testEndpoint = async (type: string, label: string, extra?: Record<string, unknown>) => {
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const message: Record<string, unknown> = { type, ...extra }
            if (type !== "API_GET_SEARCHES") {
                message.companyName = companyName
            }
            const response = await chrome.runtime.sendMessage(message)
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
                type: "one-way", deadhead_miles: 32.95, stops_count: 2, total_miles: 1170.8,
                estimated_trip_duration: "1d 1h",
                origin: { stop_number: 1, site_code: "HMW1", city_state: "Wilmington, IL", postal_code: "60481", scheduled_time: "Tue Feb 17 19:10 CST" },
                destination: { stop_number: 2, site_code: "UTX8", city_state: "San Antonio, TX", postal_code: "78218", scheduled_time: "Wed Feb 18 21:01 CST" },
                requirements: {
                    trailer: { type: "53' Reefer", provided_or_required: "required", bring_your_own_trailer: true },
                    team_load: true, requirements_title: "53' Reefer Trip Requirements",
                    reefer_settings: { pre_cool_to_f: 33, mode: "continuous", start_stop_acceptable_for_frozen_below_f: 1 },
                    other_requirements: ["Trailer must be food grade"]
                }
            },
            equipment: { trailer_type: "53' Reefer", provided: false, required: true, driver_mode: "Team" },
            payout: {
                estimated_total_payout_usd: 4855.8, display_rate_usd_per_mile: 4.15, base_rate_usd_per_mile: 3.71, tour_id: "Tour...da1fe5f0",
                load_financials: [{ load_id: "Load...3b7d065e", base_rate_usd: 4343.45, fuel_surcharge_usd: 468.32, toll_charge_usd: 44.03, total_usd: 4855.8 }]
            },
            stops: [
                { stop_number: 1, site_code: "HMW1", address_line_1: "30260 S Graaskamp Blvd, Wilmington, IL 60481", address_line_2: null, city_state: "Wilmington, IL",
                  equipment: { trailer_type: "53' Reefer", status: "Live", temperature_readings: [{ value_f: 33, detail: "Unknown" }] },
                  appointment: { arrival: "02/17 19:10 CST", departure: "02/17 20:40" }, instructions_sections_present: ["Pick-up instructions"] },
                { stop_number: 2, site_code: "UTX8", address_line_1: "4825 Eisenhauer Rd Bldg 7", address_line_2: null, city_state: "San Antonio, TX",
                  equipment: { trailer_type: "53' Reefer", status: "Live", temperature_readings: [{ value_f: 33, detail: "Unknown" }] },
                  appointment: { arrival: "02/18 20:21 CST", departure: "02/18 21:01" }, instructions_sections_present: ["Drop-off instructions"] }
            ],
            legs: [{ from_stop_number: 1, from_site_code: "HMW1", to_stop_number: 2, to_site_code: "UTX8", distance_miles: 1170.8, estimated_drive_time: "1d 1h" }],
            ui_actions_present: { book_button_present: true, confirm_booking_modal_present: true, confirm_buttons: ["No", "Yes, confirm booking"] },
            raw_strings_detected: { header_rate_per_mile: "$4.15/mi", deadhead: "32.95 mi deadhead", details_distance: "1,170.8 mi", details_duration: "1d 1h" }
        }
        testEndpoint("API_SEND_LOADS", "Send Loads", { searchUniqueName: "Chicago to Dallas", loads: [sampleLoad] })
    }

    return (
        <div className="mb-6 space-y-4 p-4 border border-amber-300 rounded-md bg-amber-50">
            <h3 className="text-sm font-bold text-amber-800">API Endpoint Tester</h3>
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Company Name</label>
                <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    placeholder="e.g. acme-logistics"
                />
            </div>
            <div className="flex gap-2 flex-wrap">
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
                    Send Loads (sample)
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
    const [isSaved, setIsSaved] = useState(false)

    useEffect(() => {
        chrome.storage.sync.get("settings", (result) => {
            setSettings(mergeSettings(result.settings))
        })
    }, [])

    const handleSave = () => {
        chrome.storage.sync.set({ settings }, () => {
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

                {/* Rate Filters */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Minimum Dollars Per Mile
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={settings.minDollarsPerMile || ""}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    minDollarsPerMile: parseFloat(e.target.value) || 0
                                })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. 3.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">Min rate per mile</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Minimum Total Payout
                        </label>
                        <input
                            type="number"
                            step="1"
                            min="0"
                            value={settings.minTotalPayout || ""}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    minTotalPayout: parseFloat(e.target.value) || 0
                                })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. 500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Min total payout ($)</p>
                    </div>
                </div>

                {/* Date/Time Filters */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Start Date/Time
                        </label>
                        <input
                            type="datetime-local"
                            value={settings.startDateTime}
                            onChange={(e) =>
                                setSettings({ ...settings, startDateTime: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Earliest pickup window</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            End Date/Time
                        </label>
                        <input
                            type="datetime-local"
                            value={settings.endDateTime}
                            onChange={(e) =>
                                setSettings({ ...settings, endDateTime: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Latest pickup window</p>
                    </div>
                </div>

                {/* Radius Settings */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Origin Radius (miles)
                        </label>
                        <select
                            value={settings.originRadius}
                            onChange={(e) =>
                                setSettings({ ...settings, originRadius: parseInt(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {RADIUS_OPTIONS.map((radius) => (
                                <option key={radius} value={radius}>{radius} miles</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Search radius around origin cities</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Destination Radius (miles)
                        </label>
                        <select
                            value={settings.destinationRadius}
                            onChange={(e) =>
                                setSettings({ ...settings, destinationRadius: parseInt(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {RADIUS_OPTIONS.map((radius) => (
                                <option key={radius} value={radius}>{radius} miles</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Search radius around destination cities</p>
                    </div>
                </div>

                {/* Origin Cities */}
                <CityPicker
                    label="Origin Cities"
                    cities={settings.originCities}
                    maxCities={5}
                    onChange={(originCities) => setSettings({ ...settings, originCities })}
                    emptyMessage="No origin cities added yet. (max 5)"
                    keyPrefix="origin"
                />

                {/* Destination Cities */}
                <CityPicker
                    label="Destination Cities"
                    cities={settings.destinationCities}
                    maxCities={3}
                    onChange={(destinationCities) => setSettings({ ...settings, destinationCities })}
                    emptyMessage="No destination cities added yet. Leave empty for any destination. (max 3)"
                    keyPrefix="dest"
                />

                {/* Excluded Cities */}
                <CityPicker
                    label="Excluded Cities"
                    cities={settings.excludedCities}
                    maxCities={10}
                    onChange={(excludedCities) => setSettings({ ...settings, excludedCities })}
                    emptyMessage="No excluded cities. (max 10)"
                    keyPrefix="excluded"
                />

                {/* Equipment Types */}
                <EquipmentSection
                    equipment={settings.equipment}
                    onChange={(equipment) => setSettings({ ...settings, equipment })}
                />

                {/* Work Types */}
                <CheckboxGroup
                    label="Work Types"
                    options={WORK_TYPE_OPTIONS}
                    selected={settings.workTypes}
                    onChange={(workTypes) => setSettings({ ...settings, workTypes })}
                />

                {/* Driver Types */}
                <CheckboxGroup
                    label="Driver Types"
                    options={DRIVER_TYPE_OPTIONS}
                    selected={settings.driverTypes}
                    onChange={(driverTypes) => setSettings({ ...settings, driverTypes })}
                />

                {/* Load Types */}
                <CheckboxGroup
                    label="Load Types"
                    options={LOAD_TYPE_OPTIONS}
                    selected={settings.loadTypes}
                    onChange={(loadTypes) => setSettings({ ...settings, loadTypes })}
                />

                {/* API Configuration */}
                <div className="mb-6 space-y-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-700">API Configuration</h3>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">API Endpoint</label>
                        <input
                            type="text"
                            value={settings.apiEndpoint}
                            onChange={(e) => setSettings({ ...settings, apiEndpoint: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="http://localhost:3001/api/loads"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Group Name</label>
                        <input
                            type="text"
                            value={settings.groupName}
                            onChange={(e) => setSettings({ ...settings, groupName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="NEBLO EXTENSION BOT"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Group ID</label>
                        <input
                            type="text"
                            value={settings.groupId}
                            onChange={(e) => setSettings({ ...settings, groupId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="@-neblo-ext"
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        These values will be used when creating loads in the API
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
                        <li>Set your minimum rate per mile and total payout filters</li>
                        <li>Configure date/time range for pickup windows</li>
                        <li>Set search radius for origin and destination areas</li>
                        <li>Add origin cities to monitor</li>
                        <li>Add destination cities (optional - leave empty for any)</li>
                        <li>Add excluded cities to skip specific destinations</li>
                        <li>Select equipment types, work types, driver types, and load types</li>
                        <li>Configure the API endpoint</li>
                        <li>Click Save Settings, then use extension icon to start</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
