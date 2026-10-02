import { ConfigFramework } from '@book000/node-utils'

export interface ConfigInterface {
  discord: {
    token: string
    guildId?: string
    channel?: {
      general?: string
      greeting?: string
      meetingVote?: string
      vcSpeechLog?: string
      discussion?: string
      other?: string
    }
    role?: {
      admin?: string
      verified?: string
      nitrotan?: string
    }
  }
  azure: {
    translator: {
      endpoint: string
      apikey: string
      region?: string
    }
  }
  phrasePlusApiUrl?: string
  googleSearch: {
    gcpKey: string
    cx: string
  }
  mebo: {
    apiKey: string
    agentId: string
  }
}

export class Configuration extends ConfigFramework<ConfigInterface> {
  protected validates(): Record<string, (config: ConfigInterface) => boolean> {
    const getAzureTranslator = (config: ConfigInterface) =>
      (
        config as unknown as {
          azure?: {
            translator?: Partial<ConfigInterface['azure']['translator']>
          }
        }
      ).azure?.translator

    return {
      'discord is required': (config) => !!config.discord,
      'discord.token is required': (config) => !!config.discord.token,
      'discord.token must be a string': (config) =>
        typeof config.discord.token === 'string',
      'azure.translator is required': (config) => !!getAzureTranslator(config),
      'azure.translator.endpoint must be a valid HTTPS URL': (config) => {
        const endpoint = getAzureTranslator(config)?.endpoint
        if (typeof endpoint !== 'string') return false
        try {
          return new URL(endpoint).protocol === 'https:'
        } catch {
          return false
        }
      },
      'azure.translator.apikey must be a string': (config) => {
        const apikey = getAzureTranslator(config)?.apikey
        return typeof apikey === 'string' && apikey.length > 0
      },
      'azure.translator.region must be a string': (config) =>
        getAzureTranslator(config)?.region === undefined ||
        typeof getAzureTranslator(config)?.region === 'string',
      'discord.channel.greeting must be a string': (config) =>
        config.discord.channel?.greeting === undefined ||
        typeof config.discord.channel.greeting === 'string',
      'discord.role.mailVerified must be a string': (config) =>
        config.discord.role?.verified === undefined ||
        typeof config.discord.role.verified === 'string',
      'phrasePlusApiUrl must be a string': (config) =>
        config.phrasePlusApiUrl === undefined ||
        typeof config.phrasePlusApiUrl === 'string',
    }
  }
}
