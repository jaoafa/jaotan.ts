/**
 * 日付から Asia/Tokyo 基準の年月キー (YYYY-MM) を取得する
 *
 * @param date 対象の日時
 * @returns 年月キー (例: "2026-06")
 */
export function getMonthKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  if (!year || !month) {
    throw new Error(
      `Failed to resolve month key from date: ${date.toISOString()}`
    )
  }
  return `${year}-${month}`
}

/**
 * 年月キーから、その前月の年月キーを取得する
 *
 * @param monthKey 基準となる年月キー (例: "2026-01")
 * @returns 前月の年月キー (例: "2025-12")
 */
export function getPreviousMonthKey(monthKey: string): string {
  const [yearString, monthString] = monthKey.split('-')
  const year = Number(yearString)
  const month = Number(monthString)
  if (month === 1) {
    return `${year - 1}-12`
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`
}
