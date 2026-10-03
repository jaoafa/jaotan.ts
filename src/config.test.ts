import { ConfigInterface, Configuration } from '@/config'
import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

describe('Configuration validation', () => {
  let configPath: string
  let configDirectory: string

  beforeEach(() => {
    configDirectory = path.join(tmpdir(), `config-test-${randomUUID()}`)
    fs.mkdirSync(configDirectory, { recursive: true })
    configPath = path.join(configDirectory, 'config.json')
    fs.writeFileSync(configPath, '{}')
  })

  afterEach(() => {
    fs.rmSync(configDirectory, { recursive: true, force: true })
  })

  const validators = () =>
    (
      new Configuration(configPath) as unknown as {
        validates: () => Record<string, (config: ConfigInterface) => boolean>
      }
    ).validates()

  const validConfig = (): ConfigInterface => ({
    discord: { token: 'token' },
    azure: {
      translator: {
        endpoint: 'https://translator.example.com',
        apikey: 'key',
      },
    },
    googleSearch: { gcpKey: 'key', cx: 'engine' },
    mebo: { apiKey: 'key', agentId: 'agent' },
  })

  it('accepts a valid HTTPS translator endpoint and API key', () => {
    const config = validConfig()
    const checks = validators()

    expect(
      checks['azure.translator.endpoint must be a valid HTTPS URL'](config)
    ).toBe(true)
    expect(checks['azure.translator.apikey must be a string'](config)).toBe(
      true
    )
  })

  it('rejects an invalid translator URL and missing API key', () => {
    const config = validConfig()
    config.azure.translator.endpoint = 'ftp://translator.example.com'
    config.azure.translator.apikey = ''
    const checks = validators()

    expect(
      checks['azure.translator.endpoint must be a valid HTTPS URL'](config)
    ).toBe(false)
    expect(checks['azure.translator.apikey must be a string'](config)).toBe(
      false
    )
  })
})
