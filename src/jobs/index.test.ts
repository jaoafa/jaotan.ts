import { BaseDiscordJob } from '@/jobs/index'
import { Discord } from '@/discord'

class ExampleJob extends BaseDiscordJob {
  readonly schedule = '*/5 * * * *'
  execute = jest.fn().mockResolvedValue(undefined)
}

describe('BaseDiscordJob', () => {
  it('registers the schedule in the Tokyo timezone and runs the callback', async () => {
    const schedule = jest.fn()
    const job = new ExampleJob({} as Discord)

    job.register({ schedule } as never)
    const [, callback] = schedule.mock.calls.at(0) as unknown as [
      string,
      () => Promise<void>,
      { timezone: string },
    ]
    await callback()

    expect(schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function), {
      timezone: 'Asia/Tokyo',
    })
    expect(job.execute).toHaveBeenCalled()
  })
})
