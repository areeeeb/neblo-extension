/**
 * API client with strategy pattern.
 * Runs in background.ts (no CORS issues for real API calls).
 *
 * Auth: every POST body includes { apiKey, company_code, adapter_code }.
 * Response envelope: { error, status_code, data } — unwrapped into ApiResponse.
 *
 * When API config is not set, all methods return a "not configured" error.
 */

import type {
  ApiConfig,
  ApiResponse,
  ApiEnvelope,
  AuthContext,
  CredentialsResponse,
  TwoFACodeResponse,
  SavedSearchesResponse,
  LoadPayload,
  SendLoadsResponse,
  GetAdapterResponse,
  LoadsToBookResponse,
  LoadStatus,
  UpdateLoadStatusResponse
} from "./types"

// ============================================
// Strategy Interface
// ============================================

interface ApiStrategy {
  getAdapter(adapterType: string): Promise<ApiResponse<GetAdapterResponse>>
  getCredentials(): Promise<ApiResponse<CredentialsResponse>>
  get2FACode(): Promise<ApiResponse<TwoFACodeResponse>>
  getSearches(): Promise<ApiResponse<SavedSearchesResponse>>
  sendLoads(searchUniqueName: string, loads: LoadPayload[]): Promise<ApiResponse<SendLoadsResponse>>
  getLoadsToBook(): Promise<ApiResponse<LoadsToBookResponse>>
  updateLoadStatus(loadId: string, status: LoadStatus): Promise<ApiResponse<UpdateLoadStatusResponse>>
}

// ============================================
// Unconfigured Strategy (returns errors)
// ============================================

const NOT_CONFIGURED_ERROR =
  "API not configured — set API Key, Company Code, and Adapter Code in extension options"

class UnconfiguredStrategy implements ApiStrategy {
  private fail<T>(): Promise<ApiResponse<T>> {
    return Promise.resolve({ success: false, error: NOT_CONFIGURED_ERROR })
  }

  getAdapter() { return this.fail<GetAdapterResponse>() }
  getCredentials() { return this.fail<CredentialsResponse>() }
  get2FACode() { return this.fail<TwoFACodeResponse>() }
  getSearches() { return this.fail<SavedSearchesResponse>() }
  sendLoads() { return this.fail<SendLoadsResponse>() }
  getLoadsToBook() { return this.fail<LoadsToBookResponse>() }
  updateLoadStatus() { return this.fail<UpdateLoadStatusResponse>() }
}

// ============================================
// Real Strategy
// ============================================

class RealApiStrategy implements ApiStrategy {
  constructor(
    private baseUrl: string,
    private auth: AuthContext
  ) {}

  /**
   * Common POST helper. Includes auth fields in the body and
   * unwraps the backend's { error, status_code, data } envelope.
   */
  private async post<T>(
    endpoint: string,
    body: Record<string, unknown> = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: this.auth.apiKey,
          company_code: this.auth.companyCode,
          adapter_code: this.auth.adapterCode,
          ...body
        })
      })

      const envelope = (await response.json()) as ApiEnvelope<T>

      if (envelope.error || !response.ok) {
        return {
          success: false,
          error: envelope.error ?? `${response.status} ${response.statusText}`
        }
      }

      return { success: true, data: envelope.data ?? undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async getAdapter(
    adapterType: string
  ): Promise<ApiResponse<GetAdapterResponse>> {
    // get_adapter uses a different body shape (camelCase, no adapter_code)
    try {
      const response = await fetch(`${this.baseUrl}/get_adapter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: this.auth.apiKey,
          adapterType,
          companyCode: this.auth.companyCode
        })
      })

      const envelope = (await response.json()) as ApiEnvelope<GetAdapterResponse>

      if (envelope.error || !response.ok) {
        return {
          success: false,
          error: envelope.error ?? `${response.status} ${response.statusText}`
        }
      }

      return { success: true, data: envelope.data ?? undefined }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async getCredentials(): Promise<ApiResponse<CredentialsResponse>> {
    return this.post<CredentialsResponse>("/credentials")
  }

  async get2FACode(): Promise<ApiResponse<TwoFACodeResponse>> {
    return this.post<TwoFACodeResponse>("/2fa-code")
  }

  async getSearches(): Promise<ApiResponse<SavedSearchesResponse>> {
    return this.post<SavedSearchesResponse>("/searches")
  }

  async sendLoads(
    searchUniqueName: string,
    loads: LoadPayload[]
  ): Promise<ApiResponse<SendLoadsResponse>> {
    return this.post<SendLoadsResponse>("/loads", {
      search_unique_name: searchUniqueName,
      loads
    })
  }

  async getLoadsToBook(): Promise<ApiResponse<LoadsToBookResponse>> {
    return this.post<LoadsToBookResponse>("/loads-to-book")
  }

  async updateLoadStatus(
    loadId: string,
    status: LoadStatus
  ): Promise<ApiResponse<UpdateLoadStatusResponse>> {
    return this.post<UpdateLoadStatusResponse>("/update-status", {
      load_id: loadId,
      status
    })
  }
}

// ============================================
// API Client
// ============================================

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: "https://dev-be.neblo.ai/api/extension"
}

export class ApiClient {
  private strategy: ApiStrategy

  constructor(
    private config: ApiConfig,
    private auth?: AuthContext
  ) {
    this.strategy = this.buildStrategy()
  }

  private buildStrategy(): ApiStrategy {
    if (!this.auth) {
      return new UnconfiguredStrategy()
    }
    return new RealApiStrategy(this.config.baseUrl, this.auth)
  }

  reconfigure(config?: Partial<ApiConfig>, auth?: AuthContext): void {
    if (config) this.config = { ...this.config, ...config }
    if (auth) this.auth = auth
    this.strategy = this.buildStrategy()
  }

  getAdapter(
    adapterType: string
  ): Promise<ApiResponse<GetAdapterResponse>> {
    return this.strategy.getAdapter(adapterType)
  }

  getCredentials(): Promise<ApiResponse<CredentialsResponse>> {
    return this.strategy.getCredentials()
  }

  get2FACode(): Promise<ApiResponse<TwoFACodeResponse>> {
    return this.strategy.get2FACode()
  }

  getSearches(): Promise<ApiResponse<SavedSearchesResponse>> {
    return this.strategy.getSearches()
  }

  sendLoads(
    searchUniqueName: string,
    loads: LoadPayload[]
  ): Promise<ApiResponse<SendLoadsResponse>> {
    return this.strategy.sendLoads(searchUniqueName, loads)
  }

  getLoadsToBook(): Promise<ApiResponse<LoadsToBookResponse>> {
    return this.strategy.getLoadsToBook()
  }

  updateLoadStatus(
    loadId: string,
    status: LoadStatus
  ): Promise<ApiResponse<UpdateLoadStatusResponse>> {
    return this.strategy.updateLoadStatus(loadId, status)
  }
}

// ============================================
// Factory
// ============================================

export function createApiClient(
  config: Partial<ApiConfig> = {},
  auth?: AuthContext
): ApiClient {
  return new ApiClient({ ...DEFAULT_CONFIG, ...config }, auth)
}

export type { AuthContext }
