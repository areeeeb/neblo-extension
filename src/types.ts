// Extension Settings stored in chrome.storage.sync
export interface ExtensionSettings {
  minDollarsPerMile: number;
  minTotalPayout: number;
  originCities: string[];
  destinationCities: string[];
  originRadius: number;
  destinationRadius: number;
  startDateTime: string;
  endDateTime: string;
  apiEndpoint: string;
  groupName: string;
  groupId: string;
}

export const RADIUS_OPTIONS = [5, 10, 25, 50, 75, 100, 150, 200, 250] as const;

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
  | { type: 'LOAD_STARRED'; load: SimulatorLoad }
  | { type: 'ERROR'; error: string }
  | { type: 'API_CREATE_LOAD'; apiEndpoint: string; load: APILoad }
  | { type: 'API_GET_BOOKED_LOADS'; apiEndpoint: string }
  | { type: 'API_MARK_LOAD_COVERED'; apiEndpoint: string; loadId: string };

// Default settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  minDollarsPerMile: 3.0,
  minTotalPayout: 0,
  originCities: [],
  destinationCities: [],
  originRadius: 50,
  destinationRadius: 50,
  startDateTime: '',
  endDateTime: '',
  apiEndpoint: 'http://localhost:3001/api/loads',
  groupName: 'NEBLO EXTENSION BOT',
  groupId: '@-neblo-ext'
};
