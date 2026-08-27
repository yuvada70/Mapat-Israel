/**
 * טיפוסי הליבה של המשחק — שפה משותפת לשרת וללקוח.
 *
 * עיקרון מנחה: מה שנשלח ללקוח במהלך המשחק לעולם אינו מכיל את המיקום
 * האמיתי, מרחקים או ניחושים של שחקנים אחרים. המידע הזה נחשף אך ורק
 * במבנה {@link GameResults}, שנשלח רק בסיום המשחק.
 */

import type { LatLng } from '../geo/coordinates.js';
import type { ContentCategory, Difficulty, GameLocation, LocationCategory } from '../content/packs/index.js';

/** שלבי מכונת המצבים של המשחק. */
export type GamePhase =
  /** ממתינים לשחקנים; המנהל טרם התחיל. */
  | 'lobby'
  /** ספירה לאחור לפני הסיבוב הראשון. */
  | 'countdown'
  /** סיבוב פעיל — הטיימר רץ והשחקנים מסמנים. */
  | 'question'
  /** הפוגה קצרה בין סיבובים. */
  | 'intermission'
  /** המשחק הופסק זמנית על ידי המנהל. */
  | 'paused'
  /** המשחק הסתיים — התוצאות זמינות. */
  | 'finished';

/** הגדרות משחק הנקבעות על ידי המנהל ביצירה. */
export interface GameSettings {
  /** מזהה חבילת התוכן. */
  readonly packId: string;
  /** קטגוריית התוכן: ישובים, אתרים, או מעורב. */
  readonly category: ContentCategory;
  /** דרגת הקושי — קובעת מאיזה מאגר נשלפים המיקומים, אינה משפיעה על הניקוד. */
  readonly difficulty: Difficulty;
  /** מספר הסיבובים במשחק. */
  readonly roundCount: number;
  /** משך סיבוב במילישניות. */
  readonly roundDurationMs: number;
  /** משך ההפוגה בין סיבובים במילישניות. */
  readonly intermissionMs: number;
  /** משך הספירה לאחור לפני הסיבוב הראשון במילישניות. */
  readonly countdownMs: number;
  /** האם לערבב את סדר השאלות. */
  readonly shuffleQuestions: boolean;
  /** האם להציג לשחקן את מיקומו היחסי בדירוג במהלך המשחק. */
  readonly showLiveRank: boolean;
  /** האם להפעיל בונוס מהירות בנוסף לניקוד המרחק. */
  readonly speedBonus: boolean;
}

/**
 * ערכי ברירת המחדל למשחק חדש — ישובים בדרגת קושי בינונית, 5 שניות
 * לכל שאלה. שדה roundCount כאן הוא ערך גיבוי בלבד; בפועל השרת (ר'
 * normalizeSettings) וממסך יצירת המשחק קובעים ברירת מחדל דינמית
 * השווה למספר כל המיקומים במאגר שנבחר (חבילה × קטגוריה × קושי), כדי
 * שהמשחק תמיד ישחק בכל התוכן הזמין כברירת מחדל.
 */
export const DEFAULT_SETTINGS: GameSettings = {
  packId: 'israel-classic',
  category: 'settlement',
  difficulty: 'medium',
  roundCount: 15,
  roundDurationMs: 5_000,
  intermissionMs: 2_000,
  countdownMs: 3_000,
  shuffleQuestions: true,
  showLiveRank: true,
  speedBonus: false,
};

/** גבולות תקינות להגדרות — נאכפים בשרת. */
export const SETTINGS_LIMITS = {
  roundCount: { min: 3, max: 30 },
  roundDurationMs: { min: 3_000, max: 30_000 },
  intermissionMs: { min: 500, max: 10_000 },
  countdownMs: { min: 0, max: 10_000 },
} as const;

/** אווטאר שנגזר דטרמיניסטית ממזהה השחקן. */
export interface Avatar {
  readonly emoji: string;
  /** גוון בסיס במעלות (HSL) לצביעת הכרטיס והסמן במפה. */
  readonly hue: number;
}

/** ייצוג ציבורי של שחקן — נשלח לכל המשתתפים. */
export interface PlayerPublic {
  readonly id: string;
  readonly name: string;
  readonly avatar: Avatar;
  /** האם החיבור פעיל כרגע. */
  readonly connected: boolean;
  /** ניקוד מצטבר. */
  readonly score: number;
  readonly joinedAt: number;
}

/** תיאור הסיבוב הפעיל — ללא כל רמז למיקום האמיתי. */
export interface RoundPrompt {
  /** אינדקס מבוסס-0. */
  readonly index: number;
  /** מספר הסיבובים הכולל. */
  readonly total: number;
  /** שם המקום שיש לאתר. */
  readonly locationName: string;
  readonly category: LocationCategory;
  /** חותמת זמן שרת שבה הסיבוב נפתח. */
  readonly startsAt: number;
  /** חותמת זמן שרת שבה הסיבוב נסגר. */
  readonly endsAt: number;
}

/**
 * תמונת מצב ציבורית של החדר.
 * זהו המבנה היחיד שמשודר במהלך המשחק, ולכן הוא לא מכיל מידע רגיש.
 */
export interface PublicGameState {
  readonly code: string;
  readonly phase: GamePhase;
  readonly settings: GameSettings;
  readonly mapId: string;
  /** שם חבילת התוכן, לתצוגה. */
  readonly packName: string;
  /** הסיבוב הפעיל, או null בלובי/בסיום. */
  readonly round: RoundPrompt | null;
  readonly players: readonly PlayerPublic[];
  /** כמה שחקנים כבר סימנו בסיבוב הנוכחי (ללא חשיפת מה סימנו). */
  readonly answeredCount: number;
  /** מספר הסיבובים שהושלמו. */
  readonly completedRounds: number;
  /** חותמת זמן שבה תסתיים הספירה לאחור / ההפוגה הנוכחית. */
  readonly phaseEndsAt: number | null;
  /** האם המנהל מחובר כרגע. */
  readonly hostConnected: boolean;
}

/** תוצאת ניחוש בודד — נחשף רק בסיום המשחק. */
export interface PlayerGuessResult {
  readonly playerId: string;
  /** הנקודה שסומנה, או null אם לא נענה. */
  readonly guess: LatLng | null;
  /** המרחק בק"מ, או null אם לא נענה. */
  readonly distanceKm: number | null;
  readonly points: number;
  /** הזמן שחלף מתחילת הסיבוב ועד הסימון (מ"ש), או null. */
  readonly elapsedMs: number | null;
}

/** סיכום מלא של סיבוב — כולל האמת והניחושים. */
export interface RoundResult {
  readonly index: number;
  readonly location: GameLocation;
  readonly guesses: readonly PlayerGuessResult[];
}

/** שורה בטבלת הדירוג הסופית. */
export interface LeaderboardEntry {
  /** דירוג מבוסס-1; שוויון מקבל את אותו דירוג. */
  readonly rank: number;
  readonly player: PlayerPublic;
  readonly totalPoints: number;
  /** מרחק ממוצע על פני הסיבובים שנענו, או null. */
  readonly averageDistanceKm: number | null;
  /** מספר הסיבובים שבהם נפל הסימון ברדיוס "בול פגיעה". */
  readonly bullseyes: number;
  /** מספר הסיבובים שנענו. */
  readonly answeredRounds: number;
  /** הסיבוב המוצלח ביותר (אינדקס), אם קיים. */
  readonly bestRoundIndex: number | null;
}

/** התוצאות המלאות — נשלח רק כשהמשחק מסתיים. */
export interface GameResults {
  readonly code: string;
  readonly finishedAt: number;
  readonly settings: GameSettings;
  readonly mapId: string;
  readonly packName: string;
  readonly rounds: readonly RoundResult[];
  readonly leaderboard: readonly LeaderboardEntry[];
  /** האם המשחק הופסק לפני סיום כל הסיבובים. */
  readonly endedEarly: boolean;
}

/** מצב פרטי המוחזר לשחקן בלבד. */
export interface PlayerPrivateState {
  readonly playerId: string;
  /** ניקוד מצטבר. */
  readonly score: number;
  /** דירוג נוכחי (1 = ראשון), או null אם ההגדרה כבויה. */
  readonly rank: number | null;
  /** מספר השחקנים, להצגת "מקום 3 מתוך 12". */
  readonly playerCount: number;
  /** האם כבר סומנה נקודה בסיבוב הנוכחי. */
  readonly hasAnswered: boolean;
  /** הנקודה שסומנה בסיבוב הנוכחי (המידע של השחקן עצמו בלבד). */
  readonly currentGuess: LatLng | null;
}
