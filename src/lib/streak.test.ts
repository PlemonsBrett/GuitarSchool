import { describe, expect, it } from 'vitest'
import { currentStreak } from './streak'

describe('currentStreak', () => {
  it('is 0 with no practice', () => expect(currentStreak([], '2026-11-14')).toBe(0))
  it('counts days ending today', () =>
    expect(currentStreak(['2026-11-12', '2026-11-13', '2026-11-14'], '2026-11-14')).toBe(3))
  it('keeps the streak alive if today is not logged yet', () =>
    expect(currentStreak(['2026-11-12', '2026-11-13'], '2026-11-14')).toBe(2))
  it('breaks on a gap', () =>
    expect(currentStreak(['2026-11-10', '2026-11-14'], '2026-11-14')).toBe(1))
  it('ignores duplicates', () =>
    expect(currentStreak(['2026-11-14', '2026-11-14'], '2026-11-14')).toBe(1))
})
