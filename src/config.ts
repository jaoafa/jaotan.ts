import { ConfigFramework } from '@book000/node-utils'

export interface ConfigInterface {
  discord: {
    token: string
  }
}

export class Configuration extends ConfigFramework<ConfigInterface> {
  protected validates(): { [key: string]: (config: ConfigInterface) => boolean } {
    return {
      'discord is required': (config) => !!config.discord,
      'discord.token is required': (config) => !!config.discord.token,
      'discord.token must be a string': (config) =>
        typeof config.discord.token === 'string',
    }
  }
}
