// src/lib/sm2.ts
// SM-2 spaced repetition algorithm for intelligent resurfacing
// Based on the original SuperMemo SM-2 algorithm by Piotr Wozniak

export interface SM2State {
  easeFactor: number      // E-Factor, starts at 2.5
  interval: number        // days until next review
  repetitions: number     // number of successful reviews
  nextReviewAt: Date
  lastReviewedAt?: Date
}

/**
 * Run one SM-2 review cycle.
 * quality: 0-5 where:
 *   5 = perfect recall
 *   4 = correct after a hesitation
 *   3 = correct with serious difficulty
 *   2 = incorrect; but easy to recall
 *   1 = incorrect; remembered answer on seeing it
 *   0 = blackout
 */
export function sm2Review(state: SM2State, quality: 0 | 1 | 2 | 3 | 4 | 5): SM2State {
  let { easeFactor, interval, repetitions } = state

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  } else {
    // Incorrect — reset
    repetitions = 0
    interval = 1
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easeFactor < 1.3) easeFactor = 1.3

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + interval)

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewAt,
    lastReviewedAt: new Date(),
  }
}

/**
 * Create a fresh SM-2 state for a newly saved signal.
 * First review in 1 day.
 */
export function initialSM2State(): SM2State {
  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + 1)
  return {
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReviewAt,
  }
}

/**
 * Check if a signal is due for resurfacing based on SM-2 schedule.
 */
export function isDueForReview(state?: SM2State | null): boolean {
  if (!state) return false
  return new Date() >= new Date(state.nextReviewAt)
}

/**
 * Estimate recall quality based on viewing behavior:
 *   - Viewed quickly after save → quality 4
 *   - Viewed after long gap → quality 3 (good for resurfacing)
 *   - Never viewed → quality 2
 */
export function estimateQuality(
  viewCount: number,
  daysSinceCreated: number,
  daysSinceLastView?: number
): 0 | 1 | 2 | 3 | 4 | 5 {
  if (viewCount === 0) return 2
  if (!daysSinceLastView || daysSinceLastView < 1) return 4
  if (daysSinceLastView < 7) return 4
  if (daysSinceLastView < 30) return 3
  return 2
}
