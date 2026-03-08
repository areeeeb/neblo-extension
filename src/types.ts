// Equipment types
export interface EquipmentSettings {
  powerOnly: boolean;
  tractorTrailer: boolean;
  powerTractorOptions: string[];   // shared sub-options for Power Only & Tractor & Trailer
  boxTruck: boolean;
  boxTruckOptions: string[];
}

// Extension Settings stored in chrome.storage.sync
export interface ExtensionSettings {
  minDollarsPerMile: number;
  minTotalPayout: number;
  originCities: string[];
  destinationCities: string[];
  excludedCities: string[];
  originRadius: number;
  destinationRadius: number;
  startDateTime: string;
  endDateTime: string;
  equipment: EquipmentSettings;
  workTypes: string[];
  driverTypes: string[];
  loadTypes: string[];
  apiEndpoint: string;
  groupName: string;
  groupId: string;
}

// City list shared between options page city pickers
export const CITIES = [
  { city: "Milwaukee", state: "WI", zip: "53201" },
  { city: "Chicago", state: "IL", zip: "60601" },
  { city: "Indianapolis", state: "IN", zip: "46201" },
  { city: "Detroit", state: "MI", zip: "48201" },
  { city: "Dallas", state: "TX", zip: "75201" },
  { city: "Atlanta", state: "GA", zip: "30301" },
  { city: "Los Angeles", state: "CA", zip: "90001" },
  { city: "Phoenix", state: "AZ", zip: "85001" },
  { city: "Denver", state: "CO", zip: "80201" },
  { city: "Memphis", state: "TN", zip: "38101" },
] as const;

export const RADIUS_OPTIONS = [5, 10, 25, 50, 75, 100, 150, 200, 250] as const;

// Trailer/container options shared by Power Only and Tractor & Trailer
export const POWER_TRACTOR_OPTIONS = [
  "53' Trailer",
  "53' Container",
  "53' Reefer",
  "26' Reefer",
  "45' Container",
  "40' Container",
  "20' Container",
  "45' HC Container",
  "40' HC Container",
  "48' Reefer",
  "48' Trailer",
] as const;

export const BOX_TRUCK_OPTIONS = [
  "26' Box Truck",
  "16'",
] as const;

export const WORK_TYPE_OPTIONS = [
  "Block",
  "Hostler/Shuttle",
  "One-Way/Round Trip",
] as const;

export const DRIVER_TYPE_OPTIONS = [
  "Solo",
  "Team",
] as const;

export const LOAD_TYPE_OPTIONS = [
  "Live",
  "Drop and hook",
] as const;

export const DEFAULT_EQUIPMENT: EquipmentSettings = {
  powerOnly: false,
  tractorTrailer: false,
  powerTractorOptions: [],
  boxTruck: false,
  boxTruckOptions: [],
};

// Load data structure matching the simulator
export interface SimulatorLoad {
  id: string;
  origin: {
    city: string;
    state: string;
    zip: string;
    time: string;
  };
  destination: {
    city: string;
    state: string;
    zip: string;
    time: string;
  };
  distance: number;
  payout: number;
  ratePerMile: number;
  equipmentType: string;
  stops: number;
  workType: string;
  driverType: string;
}

// API Load schema
export interface APILoad {
  id: string;
  group: string;
  groupId: string;
  origin: {
    location: string;
    time: string;
  };
  destination: {
    location: string;
    time: string;
  };
  distance: number;
  payout: number;
  ratePerMile: number;
  equipmentType: string;
  stops: number;
  workType: string;
  driverType: string;
  type?: string;
  status?: string;
  podName?: string;
  timestamp: string;
  channel?: string;
}

// API Response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Messages exchanged between background and content scripts
export type ExtensionMessage =
  | { type: 'START_AUTOMATION'; city: string; settings: ExtensionSettings }
  | { type: 'STOP_AUTOMATION' }
  | { type: 'TAKE_TURN'; search: import("~/core/types").SavedSearch; isFirstTime: boolean }
  | { type: 'TURN_COMPLETE'; kind: 'setup_done' | 'monitoring_done' }
  | { type: 'LOAD_STARRED'; load: SimulatorLoad }
  | { type: 'ERROR'; error: string }
  | { type: 'API_CREATE_LOAD'; apiEndpoint: string; load: APILoad }
  | { type: 'API_GET_BOOKED_LOADS'; apiEndpoint: string }
  | { type: 'API_MARK_LOAD_COVERED'; apiEndpoint: string; loadId: string }
  | { type: 'API_GET_CREDENTIALS'; companyName: string }
  | { type: 'API_GET_2FA_CODE'; companyName: string }
  | { type: 'API_GET_SEARCHES' }
  | { type: 'API_SEND_LOADS'; companyName: string; searchUniqueName: string; loads: import("~/core/api/types").ScrapedLoad[] };

// Default settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  minDollarsPerMile: 3.0,
  minTotalPayout: 0,
  originCities: [],
  destinationCities: [],
  excludedCities: [],
  originRadius: 50,
  destinationRadius: 50,
  startDateTime: '',
  endDateTime: '',
  equipment: DEFAULT_EQUIPMENT,
  workTypes: [],
  driverTypes: [],
  loadTypes: [],
  apiEndpoint: 'http://localhost:3001/api/loads',
  groupName: 'NEBLO EXTENSION BOT',
  groupId: '@-neblo-ext'
};
