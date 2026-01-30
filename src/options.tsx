import { useState, useEffect, useRef } from "react"
import type { ExtensionSettings } from "./types"
import { DEFAULT_SETTINGS, RADIUS_OPTIONS } from "./types"
import "~/style.css"

// City list - same as the simulator
const CITIES = [
    { city: "Milwaukee", state: "WI", zip: "53201" },
    { city: "Chicago", state: "IL", zip: "60601" },
    { city: "Indianapolis", state: "IN", zip: "46201" },
    { city: "Detroit", state: "MI", zip: "48201" },
    { city: "Dallas", state: "TX", zip: "75201" },
    { city: "Atlanta", state: "GA", zip: "30301" },
    { city: "Los Angeles", state: "CA", zip: "90001" },
    { city: "Phoenix", state: "AZ", zip: "85001" },
    { city: "Denver", state: "CO", zip: "80201" },
    { city: "Memphis", state: "TN", zip: "38101" }
]

export default function OptionsPage() {
    const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS)
    const [newOriginCity, setNewOriginCity] = useState("")
    const [newDestCity, setNewDestCity] = useState("")
    const [isSaved, setIsSaved] = useState(false)
    const [showOriginDropdown, setShowOriginDropdown] = useState(false)
    const [showDestDropdown, setShowDestDropdown] = useState(false)
    const originInputRef = useRef<HTMLInputElement>(null)
    const originDropdownRef = useRef<HTMLDivElement>(null)
    const destInputRef = useRef<HTMLInputElement>(null)
    const destDropdownRef = useRef<HTMLDivElement>(null)

    // Load settings on mount (merge with defaults for new fields)
    useEffect(() => {
        chrome.storage.sync.get("settings", (result) => {
            if (result.settings) {
                setSettings({ ...DEFAULT_SETTINGS, ...result.settings })
            }
        })
    }, [])

    // Handle click outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                originDropdownRef.current &&
                !originDropdownRef.current.contains(e.target as Node) &&
                originInputRef.current &&
                !originInputRef.current.contains(e.target as Node)
            ) {
                setShowOriginDropdown(false)
            }
            if (
                destDropdownRef.current &&
                !destDropdownRef.current.contains(e.target as Node) &&
                destInputRef.current &&
                !destInputRef.current.contains(e.target as Node)
            ) {
                setShowDestDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Filter cities based on input for origin
    const filteredOriginCities = CITIES.filter((city) => {
        if (!newOriginCity) return true
        const searchTerm = newOriginCity.toLowerCase()
        return (
            city.city.toLowerCase().includes(searchTerm) ||
            city.state.toLowerCase().includes(searchTerm)
        )
    })

    // Filter cities based on input for destination
    const filteredDestCities = CITIES.filter((city) => {
        if (!newDestCity) return true
        const searchTerm = newDestCity.toLowerCase()
        return (
            city.city.toLowerCase().includes(searchTerm) ||
            city.state.toLowerCase().includes(searchTerm)
        )
    })

    // Save settings
    const handleSave = () => {
        chrome.storage.sync.set({ settings }, () => {
            setIsSaved(true)
            setTimeout(() => setIsSaved(false), 2000)
        })
    }

    const MAX_ORIGIN_CITIES = 5
    const MAX_DEST_CITIES = 3

    // Select origin city from dropdown
    const selectOriginCity = (city: typeof CITIES[0]) => {
        if (settings.originCities.length >= MAX_ORIGIN_CITIES) return
        const cityString = `${city.city}, ${city.state}`
        if (!settings.originCities.includes(cityString)) {
            setSettings({
                ...settings,
                originCities: [...settings.originCities, cityString]
            })
        }
        setNewOriginCity("")
        setShowOriginDropdown(false)
    }

    // Select destination city from dropdown
    const selectDestCity = (city: typeof CITIES[0]) => {
        if (settings.destinationCities.length >= MAX_DEST_CITIES) return
        const cityString = `${city.city}, ${city.state}`
        if (!settings.destinationCities.includes(cityString)) {
            setSettings({
                ...settings,
                destinationCities: [...settings.destinationCities, cityString]
            })
        }
        setNewDestCity("")
        setShowDestDropdown(false)
    }

    // Add origin city manually
    const handleAddOriginCity = () => {
        if (settings.originCities.length >= MAX_ORIGIN_CITIES) return
        if (newOriginCity.trim() && !settings.originCities.includes(newOriginCity.trim())) {
            setSettings({
                ...settings,
                originCities: [...settings.originCities, newOriginCity.trim()]
            })
            setNewOriginCity("")
            setShowOriginDropdown(false)
        }
    }

    // Add destination city manually
    const handleAddDestCity = () => {
        if (settings.destinationCities.length >= MAX_DEST_CITIES) return
        if (newDestCity.trim() && !settings.destinationCities.includes(newDestCity.trim())) {
            setSettings({
                ...settings,
                destinationCities: [...settings.destinationCities, newDestCity.trim()]
            })
            setNewDestCity("")
            setShowDestDropdown(false)
        }
    }

    // Remove origin city from list
    const handleRemoveOriginCity = (city: string) => {
        setSettings({
            ...settings,
            originCities: settings.originCities.filter((c) => c !== city)
        })
    }

    // Remove destination city from list
    const handleRemoveDestCity = (city: string) => {
        setSettings({
            ...settings,
            destinationCities: settings.destinationCities.filter((c) => c !== city)
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
                        <p className="text-xs text-gray-500 mt-1">
                            Min rate per mile
                        </p>
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
                        <p className="text-xs text-gray-500 mt-1">
                            Min total payout ($)
                        </p>
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
                                setSettings({
                                    ...settings,
                                    originRadius: parseInt(e.target.value)
                                })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {RADIUS_OPTIONS.map((radius) => (
                                <option key={radius} value={radius}>
                                    {radius} miles
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Search radius around origin cities
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Destination Radius (miles)
                        </label>
                        <select
                            value={settings.destinationRadius}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    destinationRadius: parseInt(e.target.value)
                                })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {RADIUS_OPTIONS.map((radius) => (
                                <option key={radius} value={radius}>
                                    {radius} miles
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Search radius around destination cities
                        </p>
                    </div>
                </div>

                {/* Origin Cities */}
                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Origin Cities
                        <span className="ml-2 text-xs font-normal text-gray-500">
                            ({settings.originCities.length}/{MAX_ORIGIN_CITIES})
                        </span>
                    </label>
                    <div className="flex gap-2 mb-3">
                        <div className="flex-1 relative">
                            <input
                                ref={originInputRef}
                                type="text"
                                value={newOriginCity}
                                disabled={settings.originCities.length >= MAX_ORIGIN_CITIES}
                                onChange={(e) => {
                                    setNewOriginCity(e.target.value)
                                    setShowOriginDropdown(true)
                                }}
                                onFocus={() => setShowOriginDropdown(true)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleAddOriginCity()
                                    } else if (e.key === "Escape") {
                                        setShowOriginDropdown(false)
                                    }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder={settings.originCities.length >= MAX_ORIGIN_CITIES ? "Max cities reached" : "Search city or type manually..."}
                            />

                            {/* Origin Dropdown */}
                            {showOriginDropdown && filteredOriginCities.length > 0 && (
                                <div
                                    ref={originDropdownRef}
                                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
                                >
                                    {filteredOriginCities.map((city) => (
                                        <div
                                            key={`origin-${city.city}-${city.state}`}
                                            onClick={() => selectOriginCity(city)}
                                            className="px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                        >
                                            <svg
                                                className="w-4 h-4 text-gray-400"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                            </svg>
                                            {city.city}, {city.state}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleAddOriginCity}
                            disabled={settings.originCities.length >= MAX_ORIGIN_CITIES}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            Add
                        </button>
                    </div>

                    {/* Origin City List */}
                    <div className="space-y-2">
                        {settings.originCities.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">
                                No origin cities added yet. (max {MAX_ORIGIN_CITIES})
                            </p>
                        ) : (
                            settings.originCities.map((city) => (
                                <div
                                    key={`origin-list-${city}`}
                                    className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border border-gray-200"
                                >
                                    <span className="text-sm text-gray-700">{city}</span>
                                    <button
                                        onClick={() => handleRemoveOriginCity(city)}
                                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Destination Cities */}
                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Destination Cities
                        <span className="ml-2 text-xs font-normal text-gray-500">
                            ({settings.destinationCities.length}/{MAX_DEST_CITIES})
                        </span>
                    </label>
                    <div className="flex gap-2 mb-3">
                        <div className="flex-1 relative">
                            <input
                                ref={destInputRef}
                                type="text"
                                value={newDestCity}
                                disabled={settings.destinationCities.length >= MAX_DEST_CITIES}
                                onChange={(e) => {
                                    setNewDestCity(e.target.value)
                                    setShowDestDropdown(true)
                                }}
                                onFocus={() => setShowDestDropdown(true)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleAddDestCity()
                                    } else if (e.key === "Escape") {
                                        setShowDestDropdown(false)
                                    }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder={settings.destinationCities.length >= MAX_DEST_CITIES ? "Max cities reached" : "Search city or type manually..."}
                            />

                            {/* Destination Dropdown */}
                            {showDestDropdown && filteredDestCities.length > 0 && (
                                <div
                                    ref={destDropdownRef}
                                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
                                >
                                    {filteredDestCities.map((city) => (
                                        <div
                                            key={`dest-${city.city}-${city.state}`}
                                            onClick={() => selectDestCity(city)}
                                            className="px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                        >
                                            <svg
                                                className="w-4 h-4 text-gray-400"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                            </svg>
                                            {city.city}, {city.state}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleAddDestCity}
                            disabled={settings.destinationCities.length >= MAX_DEST_CITIES}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            Add
                        </button>
                    </div>

                    {/* Destination City List */}
                    <div className="space-y-2">
                        {settings.destinationCities.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">
                                No destination cities added yet. Leave empty for any destination. (max {MAX_DEST_CITIES})
                            </p>
                        ) : (
                            settings.destinationCities.map((city) => (
                                <div
                                    key={`dest-list-${city}`}
                                    className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border border-gray-200"
                                >
                                    <span className="text-sm text-gray-700">{city}</span>
                                    <button
                                        onClick={() => handleRemoveDestCity(city)}
                                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* API Configuration */}
                <div className="mb-6 space-y-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-700">API Configuration</h3>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            API Endpoint
                        </label>
                        <input
                            type="text"
                            value={settings.apiEndpoint}
                            onChange={(e) =>
                                setSettings({ ...settings, apiEndpoint: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="http://localhost:3001/api/loads"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Group Name
                        </label>
                        <input
                            type="text"
                            value={settings.groupName}
                            onChange={(e) =>
                                setSettings({ ...settings, groupName: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="NEBLO EXTENSION BOT"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Group ID
                        </label>
                        <input
                            type="text"
                            value={settings.groupId}
                            onChange={(e) =>
                                setSettings({ ...settings, groupId: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="@-neblo-ext"
                        />
                    </div>

                    <p className="text-xs text-gray-500">
                        These values will be used when creating loads in the API
                    </p>
                </div>

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
                            ✓ Settings saved!
                        </span>
                    )}
                </div>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <h3 className="text-sm font-bold text-blue-800 mb-2">
                        How to use:
                    </h3>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>Set your minimum rate per mile and total payout filters</li>
                        <li>Configure date/time range for pickup windows</li>
                        <li>Set search radius for origin and destination areas</li>
                        <li>Add origin cities to monitor</li>
                        <li>Add destination cities (optional - leave empty for any)</li>
                        <li>Configure the API endpoint</li>
                        <li>Click Save Settings, then use extension icon to start</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}
