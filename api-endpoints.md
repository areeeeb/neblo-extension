# Neblo API Endpoints

Base URL: `{BASE_URL}/api`

All endpoints use **POST** with `Content-Type: application/json`. All requests include an `Authorization: Bearer <token>` header and a `company_code` field in the request body.

---

## Authentication Note

Every request includes:
- **Header:** `Authorization: Bearer <token>`
- **Body field:** `company_code` (string) — identifies the company making the request

---

## 1. Get Credentials

Returns the loadboard login credentials for a given company.

**Endpoint:** `POST /credentials`

**Request Body:**
```json
{
  "company_code": "acme-123",
  "company_name": "acme-logistics"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `company_code` | string | Company identifier (from auth) |
| `company_name` | string | Slug-style company name |

**Response Body:**
```json
{
  "email": "driver@acme-logistics.com",
  "password": "acme-pass-456"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | Login email for the loadboard |
| `password` | string | Login password for the loadboard |

---

## 2. Get 2FA Code

Returns the current two-factor authentication code for the loadboard login.

**Endpoint:** `POST /2fa-code`

**Request Body:**
```json
{
  "company_code": "acme-123",
  "company_name": "acme-logistics"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `company_code` | string | Company identifier (from auth) |
| `company_name` | string | Slug-style company name |

**Response Body:**
```json
{
  "code": "654321"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Current 2FA/OTP code |

---

## 3. Get Saved Searches

Returns the list of saved search configurations and the current scrape directive. The extension polls this endpoint periodically — the `scrape_status` field tells it whether to start or stop scraping.

**Endpoint:** `POST /searches`

**Request Body:**
```json
{
  "company_code": "acme-123"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `company_code` | string | Company identifier (from auth) |

**Response Body:**
```json
{
  "scrape_status": "start",
  "searches": [
    {
      "uniqueName": "Chicago to Dallas",
      "version": 1,
      "isUpdated": false,
      "loadboardId": "relay",
      "preferences": {
        "originCities": ["Chicago, IL 60601"],
        "destinationCities": ["Dallas, TX 75201"],
        "originRadius": 50,
        "destinationRadius": 100,
        "minDollarsPerMile": 3.0,
        "minTotalPayout": 500,
        "excludedCities": [],
        "startDateTime": "",
        "endDateTime": "",
        "equipment": {
          "powerOnly": false,
          "tractorTrailer": true,
          "powerTractorOptions": ["53' Trailer"],
          "boxTruck": false,
          "boxTruckOptions": []
        },
        "workTypes": ["One-Way/Round Trip"],
        "driverTypes": ["Solo"],
        "loadTypes": ["Live", "Drop and hook"]
      }
    }
  ]
}
```

### Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `scrape_status` | `"start"` \| `"stop"` | Whether the extension should be actively scraping or idle |
| `searches` | SavedSearch[] | Array of saved search configurations |

### SavedSearch object

| Field | Type | Description |
|-------|------|-------------|
| `uniqueName` | string | Unique identifier for this search |
| `version` | number | Version number, incremented on updates |
| `isUpdated` | boolean | Whether this search has been updated since last sync |
| `loadboardId` | string | Which loadboard this search targets (e.g. `"relay"`) |
| `preferences` | SearchPreferences | The search filter configuration |

### SearchPreferences object

| Field | Type | Description |
|-------|------|-------------|
| `originCities` | string[] | Origin city strings (e.g. `"Chicago, IL 60601"`) |
| `destinationCities` | string[] | Destination city strings (empty = any) |
| `originRadius` | number | Search radius in miles around origin |
| `destinationRadius` | number | Search radius in miles around destination |
| `minDollarsPerMile` | number | Minimum $/mile filter |
| `minTotalPayout` | number | Minimum total payout in USD |
| `excludedCities` | string[] | Cities to skip |
| `startDateTime` | string | Earliest pickup window (ISO or empty) |
| `endDateTime` | string | Latest pickup window (ISO or empty) |
| `equipment` | EquipmentPreferences | Equipment filter config |
| `workTypes` | string[] | e.g. `["Block", "One-Way/Round Trip"]` |
| `driverTypes` | string[] | e.g. `["Solo", "Team"]` |
| `loadTypes` | string[] | e.g. `["Live", "Drop and hook"]` |

### EquipmentPreferences object

| Field | Type | Description |
|-------|------|-------------|
| `powerOnly` | boolean | Power Only equipment selected |
| `tractorTrailer` | boolean | Tractor & Trailer selected |
| `powerTractorOptions` | string[] | Sub-options for Power Only / Tractor & Trailer (e.g. `["53' Trailer", "53' Container"]`) |
| `boxTruck` | boolean | Box Truck selected |
| `boxTruckOptions` | string[] | Sub-options for Box Truck (e.g. `["26' Box Truck"]`) |

---

## 4. Send Loads

Submits scraped load data from a specific search to the backend for processing/storage.

**Endpoint:** `POST /loads`

**Request Body:**
```json
{
  "company_code": "acme-123",
  "company_name": "acme-logistics",
  "search_unique_name": "Chicago to Dallas",
  "loads": [ <ScrapedLoad>, ... ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `company_code` | string | Company identifier (from auth) |
| `company_name` | string | Slug-style company name |
| `search_unique_name` | string | Matches `uniqueName` from a SavedSearch |
| `loads` | ScrapedLoad[] | Array of scraped load objects |

**Response Body:**
```json
{
  "received": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `received` | number | Number of loads successfully received |

### ScrapedLoad object

Full example:

```json
{
  "trip": {
    "type": "one-way",
    "deadhead_miles": 32.95,
    "stops_count": 2,
    "total_miles": 1170.8,
    "estimated_trip_duration": "1d 1h",
    "origin": {
      "stop_number": 1,
      "site_code": "HMW1",
      "city_state": "Wilmington, IL",
      "postal_code": "60481",
      "scheduled_time": "Tue Feb 17 19:10 CST"
    },
    "destination": {
      "stop_number": 2,
      "site_code": "UTX8",
      "city_state": "San Antonio, TX",
      "postal_code": "78218",
      "scheduled_time": "Wed Feb 18 21:01 CST"
    },
    "requirements": {
      "trailer": {
        "type": "53' Reefer",
        "provided_or_required": "required",
        "bring_your_own_trailer": true
      },
      "team_load": true,
      "requirements_title": "53' Reefer Trip Requirements",
      "reefer_settings": {
        "pre_cool_to_f": 33,
        "mode": "continuous",
        "start_stop_acceptable_for_frozen_below_f": 1
      },
      "other_requirements": [
        "Trailer must be food grade, clean, dry, odor-free, and empty",
        "Bring sufficient reefer fuel",
        "Check in with guard shack or office on site",
        "PPE including safety vest, closed toe shoes",
        "Please provide 2 load bars"
      ]
    }
  },
  "equipment": {
    "trailer_type": "53' Reefer",
    "provided": false,
    "required": true,
    "driver_mode": "Team"
  },
  "payout": {
    "estimated_total_payout_usd": 4855.80,
    "display_rate_usd_per_mile": 4.15,
    "base_rate_usd_per_mile": 3.71,
    "tour_id": "Tour...da1fe5f0",
    "load_financials": [
      {
        "load_id": "Load...3b7d065e",
        "base_rate_usd": 4343.45,
        "fuel_surcharge_usd": 468.32,
        "toll_charge_usd": 44.03,
        "total_usd": 4855.80
      }
    ]
  },
  "stops": [
    {
      "stop_number": 1,
      "site_code": "HMW1",
      "address_line_1": "30260 S Graaskamp Blvd, Wilmington, IL 60481",
      "address_line_2": null,
      "city_state": "Wilmington, IL",
      "equipment": {
        "trailer_type": "53' Reefer",
        "status": "Live",
        "temperature_readings": [
          { "value_f": 33, "detail": "Unknown" },
          { "value_f": 73, "detail": "Unknown" }
        ]
      },
      "appointment": {
        "arrival": "02/17 19:10 CST",
        "departure": "02/17 20:40"
      },
      "instructions_sections_present": ["Pick-up instructions"]
    },
    {
      "stop_number": 2,
      "site_code": "UTX8",
      "address_line_1": "4825 Eisenhauer Rd Bldg 7",
      "address_line_2": null,
      "city_state": "San Antonio, TX",
      "equipment": {
        "trailer_type": "53' Reefer",
        "status": "Live",
        "temperature_readings": [
          { "value_f": 33, "detail": "Unknown" },
          { "value_f": 73, "detail": "Unknown" }
        ]
      },
      "appointment": {
        "arrival": "02/18 20:21 CST",
        "departure": "02/18 21:01"
      },
      "instructions_sections_present": ["Drop-off instructions"]
    }
  ],
  "legs": [
    {
      "from_stop_number": 1,
      "from_site_code": "HMW1",
      "to_stop_number": 2,
      "to_site_code": "UTX8",
      "distance_miles": 1170.8,
      "estimated_drive_time": "1d 1h"
    }
  ],
  "ui_actions_present": {
    "book_button_present": true,
    "confirm_booking_modal_present": true,
    "confirm_buttons": ["No", "Yes, confirm booking"]
  },
  "raw_strings_detected": {
    "header_rate_per_mile": "$4.15/mi",
    "deadhead": "32.95 mi deadhead",
    "details_distance": "1,170.8 mi",
    "details_duration": "1d 1h"
  }
}
```

### ScrapedLoad field reference

#### `trip`

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Trip type (e.g. `"one-way"`) |
| `deadhead_miles` | number | Empty miles to reach pickup |
| `stops_count` | number | Total number of stops |
| `total_miles` | number | Total loaded miles |
| `estimated_trip_duration` | string | Human-readable duration (e.g. `"1d 1h"`) |
| `origin` | object | Origin stop summary (stop_number, site_code, city_state, postal_code, scheduled_time) |
| `destination` | object | Destination stop summary (same shape as origin) |
| `requirements` | object | Trip requirements — see below |

#### `trip.requirements`

| Field | Type | Description |
|-------|------|-------------|
| `trailer.type` | string | Required trailer type |
| `trailer.provided_or_required` | string | `"provided"` or `"required"` |
| `trailer.bring_your_own_trailer` | boolean | Whether carrier must supply trailer |
| `team_load` | boolean | Whether the load requires a team |
| `requirements_title` | string | Display title for requirements section |
| `reefer_settings` | object \| undefined | Present only for reefer loads — `pre_cool_to_f`, `mode`, `start_stop_acceptable_for_frozen_below_f` |
| `other_requirements` | string[] | Free-text requirement lines |

#### `equipment`

| Field | Type | Description |
|-------|------|-------------|
| `trailer_type` | string | Trailer type string |
| `provided` | boolean | Whether trailer is provided |
| `required` | boolean | Whether trailer is required |
| `driver_mode` | string | `"Solo"` or `"Team"` |

#### `payout`

| Field | Type | Description |
|-------|------|-------------|
| `estimated_total_payout_usd` | number | Total estimated payout |
| `display_rate_usd_per_mile` | number | Rate shown in UI (includes surcharges) |
| `base_rate_usd_per_mile` | number | Base rate before surcharges |
| `tour_id` | string | Tour identifier |
| `load_financials` | array | Per-load financial breakdown — each has `load_id`, `base_rate_usd`, `fuel_surcharge_usd`, `toll_charge_usd`, `total_usd` |

#### `stops[]`

| Field | Type | Description |
|-------|------|-------------|
| `stop_number` | number | Sequential stop number |
| `site_code` | string | Facility code |
| `address_line_1` | string | Street address |
| `address_line_2` | string \| null | Additional address info |
| `city_state` | string | City and state |
| `equipment.trailer_type` | string | Trailer type at this stop |
| `equipment.status` | string | `"Live"` or `"Drop"` |
| `equipment.temperature_readings` | array | Each has `value_f` (number) and `detail` (string) |
| `appointment.arrival` | string | Arrival time string |
| `appointment.departure` | string | Departure time string |
| `instructions_sections_present` | string[] | Which instruction sections exist (e.g. `"Pick-up instructions"`) |

#### `legs[]`

| Field | Type | Description |
|-------|------|-------------|
| `from_stop_number` | number | Starting stop |
| `from_site_code` | string | Starting facility code |
| `to_stop_number` | number | Ending stop |
| `to_site_code` | string | Ending facility code |
| `distance_miles` | number | Leg distance |
| `estimated_drive_time` | string | Human-readable drive time |

#### `ui_actions_present`

| Field | Type | Description |
|-------|------|-------------|
| `book_button_present` | boolean | Whether the book button was visible |
| `confirm_booking_modal_present` | boolean | Whether the confirm modal was detected |
| `confirm_buttons` | string[] | Button labels in the confirm modal |

#### `raw_strings_detected`

| Field | Type | Description |
|-------|------|-------------|
| `header_rate_per_mile` | string | Raw rate string from the UI header |
| `deadhead` | string | Raw deadhead string |
| `details_distance` | string | Raw distance string |
| `details_duration` | string | Raw duration string |

---

## Error Handling

All endpoints should return standard HTTP status codes. The extension client wraps responses as:

```json
{
  "success": true,
  "data": { ... }
}
```

On failure:

```json
{
  "success": false,
  "error": "401 Unauthorized"
}
```

The extension handles this wrapping — the backend just needs to return the documented response body shapes with appropriate HTTP status codes (200 for success, 4xx/5xx for errors).
