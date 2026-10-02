import { TranslationUsageStore } from './translation-usage-store'

export interface AzureTranslatorConfig {
  endpoint: string
  apikey: string
  region?: string
}

const LANGUAGE_ALIASES: Record<string, string> = {
  'zh-cn': 'zh-Hans',
  'zh-tw': 'zh-Hant',
  zh: 'zh-Hans',
  iw: 'he',
  no: 'nb',
  ny: 'nya',
  tl: 'fil',
}

const DISPLAY_LANGUAGE_ALIASES: Record<string, string> = {
  'zh-Hans': 'zh',
  'zh-Hant': 'zh-tw',
  nb: 'no',
  nya: 'ny',
  fil: 'tl',
}

const REQUEST_TIMEOUT_MS = 15_000
const LANGUAGE_CACHE_MS = 60 * 60 * 1000

/** Sends text translation requests to Azure Translator v3. */
export class AzureTranslator {
  private readonly endpoint: URL
  private readonly apikey: string
  private readonly region?: string
  private readonly usageStore: TranslationUsageStore
  private readonly fetcher: typeof fetch
  private supportedLanguages?: Set<string>
  private supportedLanguagesExpiresAt = 0
  private supportedLanguagesPromise?: Promise<Set<string>>

  constructor(
    config: AzureTranslatorConfig,
    usageStore = new TranslationUsageStore(),
    fetcher: typeof fetch = fetch
  ) {
    let endpoint: URL
    try {
      endpoint = new URL(config.endpoint)
    } catch {
      throw new Error('Azure Translator endpoint must be a valid URL')
    }
    if (endpoint.protocol !== 'https:') {
      throw new Error('Azure Translator endpoint must use HTTPS')
    }
    if (!config.apikey) {
      throw new Error('Azure Translator API key is required')
    }

    endpoint.pathname = endpoint.pathname.replace(/\/$/, '')
    endpoint.search = ''
    endpoint.hash = ''
    this.endpoint = endpoint
    this.apikey = config.apikey
    this.region = config.region
    this.usageStore = usageStore
    this.fetcher = fetcher
  }

  /** Gets language codes that the configured Translator endpoint supports. */
  async getSupportedLanguages(): Promise<Set<string>> {
    if (
      this.supportedLanguages &&
      this.supportedLanguagesExpiresAt > Date.now()
    ) {
      return this.supportedLanguages
    }

    if (this.supportedLanguagesPromise) return this.supportedLanguagesPromise

    const promise = this.fetchSupportedLanguages()
    this.supportedLanguagesPromise = promise
    try {
      const languages = await promise
      this.supportedLanguages = languages
      this.supportedLanguagesExpiresAt = Date.now() + LANGUAGE_CACHE_MS
      return languages
    } finally {
      if (this.supportedLanguagesPromise === promise) {
        this.supportedLanguagesPromise = undefined
      }
    }
  }

  private async fetchSupportedLanguages(): Promise<Set<string>> {
    const url = this.getUrl('languages')
    url.searchParams.set('api-version', '3.0')
    url.searchParams.set('scope', 'translation')
    const leaseId = await this.usageStore.reserveAndAcquireRequest(0)
    try {
      const response = await this.fetcher(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error(
          `Azure Translator language list failed: ${response.status}`
        )
      }

      const body: unknown = await response.json()
      return this.parseSupportedLanguages(body)
    } finally {
      await this.usageStore.releaseRequest(leaseId)
    }
  }

  /** Converts an application language code to an Azure-supported code. */
  async toAzureLanguage(language: string): Promise<string | undefined> {
    const supported = await this.getSupportedLanguages()
    const canonical = LANGUAGE_ALIASES[language] ?? language
    return supported.has(canonical) ? canonical : undefined
  }

  /** Converts an Azure language code to an application language code. */
  publicLanguage(language: string): string {
    return DISPLAY_LANGUAGE_ALIASES[language] ?? language
  }

  /** Detects a source language with Azure Translator. */
  async detectLanguage(text: string): Promise<string> {
    const leaseId = await this.usageStore.reserveAndAcquireRequest(0)
    try {
      const url = this.getUrl('detect')
      url.searchParams.set('api-version', '3.0')
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify([{ text }]),
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error(`Azure Translator detection failed: ${response.status}`)
      }

      const body: unknown = await response.json()
      if (
        !Array.isArray(body) ||
        !this.isRecord(body[0]) ||
        typeof body[0].language !== 'string' ||
        body[0].language.length === 0
      ) {
        throw new Error('Azure Translator returned an invalid detection result')
      }
      const language = this.publicLanguage(body[0].language)
      if (!(await this.toAzureLanguage(language))) {
        throw new Error(
          'Detected language is not supported by Azure Translator'
        )
      }
      return language
    } finally {
      await this.usageStore.releaseRequest(leaseId)
    }
  }

  /** Translates one sequential step and reserves usage before each network attempt. */
  async translate(
    beforeLanguage: string,
    afterLanguage: string,
    text: string
  ): Promise<string> {
    const [from, to] = await Promise.all([
      this.toAzureLanguage(beforeLanguage),
      this.toAzureLanguage(afterLanguage),
    ])
    if (!from) throw new Error('Unsupported source language')
    if (!to) throw new Error('Unsupported target language')

    const url = this.getUrl('translate')
    url.searchParams.set('api-version', '3.0')
    url.searchParams.set('from', from)
    url.searchParams.set('to', to)

    for (let attempt = 0; attempt < 2; attempt++) {
      const leaseId = await this.usageStore.reserveAndAcquireRequest(
        text.length
      )
      let response: Response
      try {
        response = await this.fetcher(url, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify([{ text }]),
          redirect: 'error',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } finally {
        await this.usageStore.releaseRequest(leaseId)
      }

      if (response.ok) {
        const body: unknown = await response.json()
        return this.parseTranslation(body, to)
      }

      const retryable = this.isRetryableStatus(response.status)
      const retryAfter = response.headers.get('Retry-After')
      await response.body?.cancel()
      if (attempt === 0 && retryable) {
        await this.waitBeforeRetry(retryAfter)
        continue
      }
      throw new Error(`Azure Translator translation failed: ${response.status}`)
    }

    throw new Error('Azure Translator translation failed')
  }

  private getUrl(path: string): URL {
    const endpoint = new URL(this.endpoint)
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${path}`
    return endpoint
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=UTF-8',
      'Ocp-Apim-Subscription-Key': this.apikey,
    }
    if (this.region) headers['Ocp-Apim-Subscription-Region'] = this.region
    return headers
  }

  private parseSupportedLanguages(body: unknown): Set<string> {
    if (!this.isRecord(body) || !this.isRecord(body.translation)) {
      throw new Error('Azure Translator returned an invalid language list')
    }
    const entries = Object.entries(body.translation)
    if (
      entries.length === 0 ||
      entries.some(
        ([code, language]) =>
          !/^[A-Za-z0-9-]+$/.test(code) ||
          !this.isRecord(language) ||
          typeof language.name !== 'string'
      )
    ) {
      throw new Error('Azure Translator returned an invalid language list')
    }
    return new Set(entries.map(([code]) => code))
  }

  private parseTranslation(body: unknown, targetLanguage: string): string {
    if (
      !Array.isArray(body) ||
      !this.isRecord(body[0]) ||
      !Array.isArray(body[0].translations) ||
      !this.isRecord(body[0].translations[0]) ||
      typeof body[0].translations[0].text !== 'string' ||
      body[0].translations[0].to !== targetLanguage
    ) {
      throw new Error('Azure Translator returned an invalid translation')
    }
    return body[0].translations[0].text
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || (status >= 500 && status <= 599)
  }

  private async waitBeforeRetry(
    retryAfterHeader: string | null
  ): Promise<void> {
    const retryAfter = Number(retryAfterHeader)
    const delay = Number.isFinite(retryAfter)
      ? Math.min(Math.max(retryAfter * 1000, 0), 5000)
      : 500
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
