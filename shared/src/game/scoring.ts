/**
 * מנגנון הניקוד.
 *
 * הניקוד רציף (ולא בינארי): הוא נגזר ישירות מהמרחק בקילומטרים בין
 * הנקודה שסימן המשתתף למיקום האמיתי, בעקומת דעיכה אקספוננציאלית.
 *
 *   score(d) = MAX · e^(−max(0, d − perfectRadius) / decay)
 *
 * למה אקספוננציאלי ולא ליניארי:
 *  • הפרש של 5 ק"מ בסימון מדויק צריך "לכאוב" הרבה יותר מהפרש של 5 ק"מ
 *    בסימון גרוע ממילא — עקומה אקספוננציאלית מתגמלת דיוק אמיתי.
 *  • אין ניקוד שלילי ואין "קיר" שממנו כולם מקבלים 0, כך שגם ניחוש
 *    בינוני עדיין שווה משהו והמשחק נשאר מעניין עד הסוף.
 *
 * טווח אופייני (בהגדרות ברירת המחדל):
 *   0 ק"מ → 1000 | 5 ק"מ → 890 | 10 ק"מ → 754 | 25 ק"מ → 462
 *   50 ק"מ → 203 | 100 ק"מ → 37 | 200 ק"מ → 1
 */

import { haversineDistanceKm, type LatLng } from '../geo/coordinates.js';

/** פרמטרים הניתנים לכוונון ללא שינוי קוד קורא. */
export interface ScoringConfig {
  /** הניקוד המרבי לסיבוב. */
  readonly maxScore: number;
  /** רדיוס "בול פגיעה" (ק"מ) שבתוכו מקבלים ניקוד מלא. */
  readonly perfectRadiusKm: number;
  /** קבוע הדעיכה (ק"מ). ככל שהוא קטן יותר — הענישה על שגיאה חדה יותר. */
  readonly decayKm: number;
  /**
   * בונוס מהירות מרבי, כאחוז מהניקוד שהושג (0 = מנוטרל).
   * ניתן להפעלה על ידי המנהל; ברירת המחדל היא מנוטרל, כדי שהניקוד
   * ייקבע אך ורק לפי דיוק גיאוגרפי.
   */
  readonly speedBonusRatio: number;
}

/** הגדרות הניקוד המכוילות למפת ישראל. */
export const DEFAULT_SCORING: ScoringConfig = {
  maxScore: 1000,
  perfectRadiusKm: 1.5,
  decayKm: 30,
  speedBonusRatio: 0,
};

/** תוצאת חישוב ניקוד לסיבוב בודד. */
export interface RoundScore {
  /** המרחק מהמיקום האמיתי בקילומטרים. */
  readonly distanceKm: number;
  /** הניקוד הסופי (מעוגל). */
  readonly points: number;
  /** הניקוד לפני בונוס המהירות. */
  readonly basePoints: number;
  /** תוספת בונוס המהירות (0 כשהבונוס מנוטרל). */
  readonly speedBonus: number;
  /** האם הסימון נפל בתוך רדיוס "בול פגיעה". */
  readonly isBullseye: boolean;
}

/** ניקוד סיבוב שבו המשתתף לא סימן דבר. */
export const NO_ANSWER_SCORE: RoundScore = {
  distanceKm: Number.POSITIVE_INFINITY,
  points: 0,
  basePoints: 0,
  speedBonus: 0,
  isBullseye: false,
};

/**
 * מחשב את הניקוד עבור ניחוש בודד.
 *
 * @param guess     הנקודה שסימן המשתתף.
 * @param target    המיקום האמיתי.
 * @param options   נתוני זמן לבונוס מהירות (אופציונלי) והגדרות ניקוד.
 */
export function scoreGuess(
  guess: LatLng,
  target: LatLng,
  options: {
    /** הזמן שחלף מתחילת הסיבוב ועד הסימון, במילישניות. */
    readonly elapsedMs?: number;
    /** משך הסיבוב במילישניות. */
    readonly roundDurationMs?: number;
    readonly config?: ScoringConfig;
  } = {},
): RoundScore {
  const config = options.config ?? DEFAULT_SCORING;
  const distanceKm = haversineDistanceKm(guess, target);

  const excessKm = Math.max(0, distanceKm - config.perfectRadiusKm);
  const basePoints = Math.round(config.maxScore * Math.exp(-excessKm / config.decayKm));

  let speedBonus = 0;
  if (
    config.speedBonusRatio > 0 &&
    typeof options.elapsedMs === 'number' &&
    typeof options.roundDurationMs === 'number' &&
    options.roundDurationMs > 0
  ) {
    // ככל שהתשובה מוקדמת יותר בתוך הסיבוב — הבונוס גדול יותר, ליניארית.
    const remaining = 1 - Math.min(1, Math.max(0, options.elapsedMs / options.roundDurationMs));
    speedBonus = Math.round(basePoints * config.speedBonusRatio * remaining);
  }

  return {
    distanceKm,
    basePoints,
    speedBonus,
    points: basePoints + speedBonus,
    isBullseye: distanceKm <= config.perfectRadiusKm,
  };
}

/** ניסוח ידידותי של מרחק בעברית (למסך הסיכום בלבד). */
export function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) return 'ללא תשובה';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} מ׳`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} ק״מ`;
  return `${Math.round(distanceKm)} ק״מ`;
}

/** תווית איכות לניחוש — משמשת לצבע ולמשוב במסך הסיכום. */
export type AccuracyTier = 'bullseye' | 'excellent' | 'good' | 'fair' | 'far' | 'none';

/** מסווג ניחוש לרמת דיוק, לפי המרחק בקילומטרים. */
export function accuracyTier(distanceKm: number, config: ScoringConfig = DEFAULT_SCORING): AccuracyTier {
  if (!Number.isFinite(distanceKm)) return 'none';
  if (distanceKm <= config.perfectRadiusKm) return 'bullseye';
  if (distanceKm <= 10) return 'excellent';
  if (distanceKm <= 25) return 'good';
  if (distanceKm <= 60) return 'fair';
  return 'far';
}

/** תיאור מילולי של רמת הדיוק. */
export const ACCURACY_LABELS: Readonly<Record<AccuracyTier, string>> = {
  bullseye: 'בול פגיעה!',
  excellent: 'מצוין',
  good: 'יפה מאוד',
  fair: 'בערך שם',
  far: 'רחוק',
  none: 'ללא תשובה',
};
