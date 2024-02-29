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
    }
    role?: {
      admin?: string
      verified?: string
    }
  }
  translateGasUrl?: string
  detectLanguageApiToken?: string
  phrasePlusApiUrl?: string
  googleSearch: {
    gcpKey: string
    cx: string
  }
}

export class Configuration extends ConfigFramework<ConfigInterface> {
  protected validates(): {
    [key: string]: (config: ConfigInterface) => boolean
  } {
    return {
      'discord is required': (config) => !!config.discord,
      'discord.token is required': (config) => !!config.discord.token,
      'discord.token must be a string': (config) =>
        typeof config.discord.token === 'string',
      'discord.channel.greeting must be a string': (config) =>
        config.discord.channel?.greeting === undefined ||
        typeof config.discord.channel.greeting === 'string',
      'discord.role.mailVerified must be a string': (config) =>
        config.discord.role?.verified === undefined ||
        typeof config.discord.role.verified === 'string',
      'translateGasUrl must be a string': (config) =>
        config.translateGasUrl === undefined ||
        typeof config.translateGasUrl === 'string',
      'detectLanguageApiToken must be a string': (config) =>
        config.detectLanguageApiToken === undefined ||
        typeof config.detectLanguageApiToken === 'string',
      'phrasePlusApiUrl must be a string': (config) =>
        config.phrasePlusApiUrl === undefined ||
        typeof config.phrasePlusApiUrl === 'string',
    }
  }
}
