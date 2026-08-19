// Encouragement: XP, streaks, and the words the learner actually reads.
//
// Guiding rule from the product spec: NEVER punish mistakes. A wrong answer is
// information for the teaching engine, not a failure. So there is no "Wrong",
// no score-shaming, and effort earns XP even when the answer did not land.
//
// XP is deliberately generous and non-competitive. It marks progress for the
// child, it is not a ranking.

import { db, now } from "./db";
import { humanizeSkill } from "./display";

export const XP = {
  /** Finished a lesson and attempted the check. */
  attempt: 5,
  /** Improved on the previous attempt, even without passing. */
  improved: 10,
  /** Mastered the skill. */
  mastered: 25,
  /** Mastered it after having missed it before: persistence deserves more. */
  comeback: 35,
  /** Kept a mastered skill fresh through a scheduled review. */
  review: 15,
};

export interface Reward {
  xp: number;
  /** Short reason shown next to the XP, e.g. "Skill mastered". */
  reason: string;
  /** Headline for the results screen. */
  headline: string;
  /** Warm supporting line. */
  message: string;
  emoji: string;
  /** True when this was a mastered-after-struggling moment. */
  comeback: boolean;
}

/**
 * Decide the reward and the words for one completed attempt.
 *
 * `attemptNumber` is 1-based; `previousBest` is the best score on this skill
 * before this attempt, used to detect genuine improvement and comebacks.
 */
export function rewardFor(input: {
  passed: boolean;
  score: number;
  previousBest?: number;
  attemptNumber: number;
  isReview?: boolean;
  skill: string;
}): Reward {
  const { passed, score, previousBest, attemptNumber, isReview } = input;
  // The child reads this, so never show an internal tag like "multi_digit_addition".
  const skill = humanizeSkill(input.skill).toLowerCase();
  const improved = previousBest !== undefined && score > previousBest;
  const struggled = attemptNumber > 1 || (previousBest !== undefined && previousBest < 70);

  if (passed && isReview) {
    return {
      xp: XP.review,
      reason: "Review kept sharp",
      headline: "Still got it!",
      message: `You remembered ${skill}. That is what makes learning stick.`,
      emoji: "🧠",
      comeback: false,
    };
  }

  if (passed && struggled) {
    return {
      xp: XP.comeback,
      reason: "Comeback",
      headline: "Great comeback!",
      message: `You did not get ${skill} at first, you stuck with it, and now you have it. That is the hard part of learning, and you just did it.`,
      emoji: "🔥",
      comeback: true,
    };
  }

  if (passed) {
    return {
      xp: XP.mastered,
      reason: "Skill mastered",
      headline: "You got it!",
      message: `You just mastered ${skill}.`,
      emoji: "🎉",
      comeback: false,
    };
  }

  if (improved) {
    return {
      xp: XP.improved,
      reason: "Getting closer",
      headline: "You are getting closer!",
      message: `You did better than last time on ${skill}. I found what tripped you up, so let's fix that next.`,
      emoji: "📈",
      comeback: false,
    };
  }

  return {
    xp: XP.attempt,
    reason: "Nice effort",
    headline: "Almost!",
    message: `I found exactly what tripped you up on ${skill}. Let's fix it together.`,
    emoji: "💪",
    comeback: false,
  };
}

// ---- XP + streak persistence -----------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (ts: number) => Math.floor(ts / DAY_MS);

export interface Progress {
  xp: number;
  streak: number;
  /** True when this call is what extended the streak (worth celebrating). */
  streakExtended: boolean;
}

/**
 * Award XP and update the daily streak. The streak counts consecutive DAYS with
 * activity: same day keeps it, next day extends it, a longer gap restarts it.
 */
export function awardXp(studentId: string, amount: number): Progress {
  const conn = db();
  const row = conn
    .prepare(`SELECT xp, streak, last_active_at FROM students WHERE id = ?`)
    .get(studentId) as { xp: number | null; streak: number | null; last_active_at: number | null } | undefined;
  if (!row) return { xp: 0, streak: 0, streakExtended: false };

  const today = dayNumber(now());
  const lastDay = row.last_active_at ? dayNumber(row.last_active_at) : null;

  let streak = row.streak ?? 0;
  let streakExtended = false;
  if (lastDay === null || today - lastDay > 1) {
    streak = 1;
    streakExtended = true;
  } else if (today - lastDay === 1) {
    streak += 1;
    streakExtended = true;
  } else if (streak === 0) {
    streak = 1;
    streakExtended = true;
  }

  const xp = (row.xp ?? 0) + Math.max(0, Math.round(amount));
  conn
    .prepare(`UPDATE students SET xp = ?, streak = ?, last_active_at = ? WHERE id = ?`)
    .run(xp, streak, now(), studentId);
  return { xp, streak, streakExtended };
}

export function getProgress(studentId: string): Progress {
  const row = db().prepare(`SELECT xp, streak FROM students WHERE id = ?`).get(studentId) as
    | { xp: number | null; streak: number | null }
    | undefined;
  return { xp: row?.xp ?? 0, streak: row?.streak ?? 0, streakExtended: false };
}
