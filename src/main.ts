import { Logger } from '@book000/node-utils'
import { Config } from './config'
import { Discord } from './discord'

function main() {
  const logger = Logger.configure('main')
  const config = new Config('data/config.json')
  config.load()
  if (!config.validate()) {
    logger.error('❌ Configuration is invalid')
    logger.error(
      `💡 Missing check(s): ${config.getValidateFailures().join(', ')}`
    )
    return
  }

  logger.info('🤖 Starting jaotan.ts')
  const discord = new Discord(config)
  process.once('SIGINT', () => {
    logger.info('👋 SIGINT signal received.')
    ;(async () => {
      try {
        await discord.close()
        logger.info('👋 Discord client closed.')
      } catch (error: unknown) {
        logger.error('❌ Discord client close failed.', error as Error)
      } finally {
        process.exit(0)
      }
    })()
  })
}

main()
