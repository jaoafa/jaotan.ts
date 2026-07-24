import { getMonthKey, getPreviousMonthKey } from './emoji-ranking'

describe('getMonthKey', () => {
  it('Asia/Tokyo基準の年月キーを返す', () => {
    // UTC 2026-01-31T15:30:00Z は Asia/Tokyo で 2026-02-01T00:30:00+09:00
    const date = new Date('2026-01-31T15:30:00Z')
    expect(getMonthKey(date)).toBe('2026-02')
  })

  it('月が1桁の場合も0埋めで返す', () => {
    const date = new Date('2026-03-15T00:00:00+09:00')
    expect(getMonthKey(date)).toBe('2026-03')
  })
})

describe('getPreviousMonthKey', () => {
  it('通常の月であれば1つ前の月を返す', () => {
    expect(getPreviousMonthKey('2026-07')).toBe('2026-06')
  })

  it('1月の場合は前年の12月を返す', () => {
    expect(getPreviousMonthKey('2026-01')).toBe('2025-12')
  })
})
