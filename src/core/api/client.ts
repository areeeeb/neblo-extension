/**
 * API client with strategy pattern — mock/real switchable.
 * Runs in background.ts (no CORS issues for real API calls).
 */

import type {
  ApiConfig,
  ApiResponse,
  CredentialsResponse,
  TwoFACodeResponse,
  SavedSearchesResponse,
  ScrapedLoad,
  SendLoadsResponse
} from "./types"
import {
  MOCK_CREDENTIALS,
  MOCK_2FA_CODES,
  MOCK_SAVED_SEARCHES
} from "./mock-data"

// ============================================
// Auth Context
// ============================================

interface AuthContext {
  token: string
  companyCode: string
}

// ============================================
// Strategy Interface
// ============================================

interface ApiStrategy {
  getCredentials(companyName: string): Promise<ApiResponse<CredentialsResponse>>
  get2FACode(companyName: string): Promise<ApiResponse<TwoFACodeResponse>>
  getSearches(): Promise<ApiResponse<SavedSearchesResponse>>
  sendLoads(companyName: string, searchUniqueName: string, loads: ScrapedLoad[]): Promise<ApiResponse<SendLoadsResponse>>
}

// ============================================
// Mock Strategy
// ============================================

class MockApiStrategy implements ApiStrategy {
  constructor(private latency: number) {}

  private async simulateLatency(): Promise<void> {
    if (this.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latency))
    }
  }

  private lookup<T>(store: Record<string, T>, key: string): T {
    return store[key] ?? store["default"]
  }

  async getCredentials(
    companyName: string
  ): Promise<ApiResponse<CredentialsResponse>> {
    console.log("[MockAPI] getCredentials:", companyName)
    await this.simulateLatency()
    return { success: true, data: this.lookup(MOCK_CREDENTIALS, companyName) }
  }

  async get2FACode(
    companyName: string
  ): Promise<ApiResponse<TwoFACodeResponse>> {
    console.log("[MockAPI] get2FACode:", companyName)
    await this.simulateLatency()
    return { success: true, data: this.lookup(MOCK_2FA_CODES, companyName) }
  }

  async getSearches(): Promise<ApiResponse<SavedSearchesResponse>> {
    console.log("[MockAPI] getSearches")
    await this.simulateLatency()
    return { success: true, data: MOCK_SAVED_SEARCHES }
  }

  async sendLoads(
    companyName: string,
    searchUniqueName: string,
    loads: ScrapedLoad[]
  ): Promise<ApiResponse<SendLoadsResponse>> {
    console.log("[MockAPI] sendLoads:", { companyName, searchUniqueName, count: loads.length })
    await this.simulateLatency()
    return { success: true, data: { received: loads.length } }
  }
}

// ============================================
// Real Strategy
// ============================================

class RealApiStrategy implements ApiStrategy {
  constructor(
    private baseUrl: string,
    private auth: AuthContext
  ) {}

  private async post<T>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.auth.token}`
        },
        body: JSON.stringify({ company_code: this.auth.companyCode, ...body })
      })

      if (!response.ok) {
        return {
          success: false,
          error: `${response.status} ${response.statusText}`
        }
      }

      const data = (await response.json()) as T
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async getCredentials(
    companyName: string
  ): Promise<ApiResponse<CredentialsResponse>> {
    return this.post<CredentialsResponse>("/credentials", {
      company_name: companyName
    })
  }

  async get2FACode(
    companyName: string
  ): Promise<ApiResponse<TwoFACodeResponse>> {
    return this.post<TwoFACodeResponse>("/2fa-code", {
      company_name: companyName
    })
  }

  async getSearches(): Promise<ApiResponse<SavedSearchesResponse>> {
    return this.post<SavedSearchesResponse>("/searches", {})
  }

  async sendLoads(
    companyName: string,
    searchUniqueName: string,
    loads: ScrapedLoad[]
  ): Promise<ApiResponse<SendLoadsResponse>> {
    return this.post<SendLoadsResponse>("/loads", {
      company_name: companyName,
      search_unique_name: searchUniqueName,
      loads
    })
  }
}

// ============================================
// API Client
// ============================================

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: "http://localhost:3001/api",
  useMock: true,
  mockLatency: 200
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
    if (this.config.useMock) {
      return new MockApiStrategy(this.config.mockLatency ?? 200)
    }
    if (!this.auth) {
      throw new Error("AuthContext required for real API strategy")
    }
    return new RealApiStrategy(this.config.baseUrl, this.auth)
  }

  reconfigure(config?: Partial<ApiConfig>, auth?: AuthContext): void {
    if (config) this.config = { ...this.config, ...config }
    if (auth) this.auth = auth
    this.strategy = this.buildStrategy()
  }

  getCredentials(
    companyName: string
  ): Promise<ApiResponse<CredentialsResponse>> {
    return this.strategy.getCredentials(companyName)
  }

  get2FACode(companyName: string): Promise<ApiResponse<TwoFACodeResponse>> {
    return this.strategy.get2FACode(companyName)
  }

  getSearches(): Promise<ApiResponse<SavedSearchesResponse>> {
    return this.strategy.getSearches()
  }

  sendLoads(
    companyName: string,
    searchUniqueName: string,
    loads: ScrapedLoad[]
  ): Promise<ApiResponse<SendLoadsResponse>> {
    return this.strategy.sendLoads(companyName, searchUniqueName, loads)
  }
}

// ============================================
// Factory (backward-compatible export)
// ============================================

export function createApiClient(
  config: Partial<ApiConfig> = {},
  auth?: AuthContext
): ApiClient {
  return new ApiClient({ ...DEFAULT_CONFIG, ...config }, auth)
}
