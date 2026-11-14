/** Consecutive-day streak ending today (or yesterday, so an unpracticed morning doesn't read as 0). */
export function currentStreak(days: string[], today: string): number {
  const set = new Set(days)
  const dayMs = 86_400_000
  const toStr = (t: number) => new Date(t).toISOString().slice(0, 10)
  let t = Date.parse(today)
  if (!set.has(toStr(t))) t -= dayMs
  let n = 0
  while (set.has(toStr(t))) {
    n++
    t -= dayMs
  }
  return n
}
