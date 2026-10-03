const mockSetInterval = jest.fn()

jest.mock('node:timers/promises', () => ({
  setInterval: (...args: [number]) => {
    mockSetInterval(...args)
    return {
      async *[Symbol.asyncIterator]() {
        await Promise.resolve()
        yield undefined
      },
    }
  },
}))

import { BaseDiscordTask } from '@/tasks/index'
import { Discord } from '@/discord'

class ExampleTask extends BaseDiscordTask {
  readonly intervalValue = 30

  get interval() {
    return this.intervalValue
  }

  execute = jest.fn().mockResolvedValue(undefined)
}

describe('BaseDiscordTask', () => {
  it('converts the configured seconds to milliseconds and runs each tick', async () => {
    const task = new ExampleTask({} as Discord)

    await task.register()

    expect(mockSetInterval).toHaveBeenCalledWith(30_000)
    expect(task.execute).toHaveBeenCalledTimes(1)
  })
})
