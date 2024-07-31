import { BaseDiscordTask } from '.'
import { Nitrotan } from '@/features/nitrotan'

/**
 * Nitrotanの整理処理
 */
export class NitrotanOptimizeTask extends BaseDiscordTask {
  get interval(): number {
    // 3時間毎
    return 3 * 60 * 60
  }

  async execute(): Promise<void> {
    const nitrotan = await Nitrotan.of(this.discord)
    await nitrotan.optimize()
  }
}
