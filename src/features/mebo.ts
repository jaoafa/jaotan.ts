
interface MeboOptions {
  utterance: string
  uid: string
}

interface MeboBestResponse {
  utterance: string
  score: number
  options: string[]
  topic: string
  imageUrl?: string
  url?: string
  isAutoResponse: boolean
  extensions: any
}

interface MeboResponse {
  utterance: string
  bestResponse: MeboBestResponse
}

export class Mebo {
  private readonly apiUrl = 'https://api-mebo.dev/api'
  private readonly apiKey: string
  private readonly agentId: string

  constructor(apiKey: string, agentId: string) {
    this.apiKey = apiKey
    this.agentId = agentId
  }

  async chat(options: MeboOptions): Promise<MeboResponse | null> {
    const utterance = options.utterance
    const uid = options.uid

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          agent_id: this.agentId,
          utterance,
          uid: `jaotan-reply-${uid}`,
        }),
      })
      if (!res.ok) {
        return null
      }
      return (await res.json()) as MeboResponse
    } catch {
      return null
    }
  }
}
