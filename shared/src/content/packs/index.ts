/**
 * מרשם חבילות התוכן (קטגוריות המשחק).
 *
 * חבילה = רשימת מיקומים המשויכת למפה. הוספת קטגוריה חדשה ("הרים",
 * "שמורות טבע", "ערי אירופה") היא הוספת רשומה כאן בלבד.
 *
 * בתוך חבילה, כל מיקום מתויג גם בסוג (ישוב/אתר) וגם בדרגת קושי
 * (קל/בינוני/מקצוענים). המנהל בוחר בעת יצירת המשחק אילו מיקומים
 * ישתתפו — סינון לפי הצירוף הזה, ר' {@link selectLocationPool}.
 */

import type { LatLng } from '../../geo/coordinates.js';
import { ISRAEL_LOCATIONS } from './israel-locations.js';

/** סוג המיקום: ישוב (עיר/עיירה/מושב/קיבוץ) או אתר לאומי/מוכר. */
export type LocationCategory = 'settlement' | 'landmark';

/**
 * קטגוריית התוכן שהמנהל בוחר — סוג מיקום ספציפי, או "מעורב" ששולף
 * משני הסוגים גם יחד.
 */
export type ContentCategory = LocationCategory | 'mixed';

/** דרגת קושי — קובעת מאיזה מאגר נשלף המיקום, ואינה משפיעה על הניקוד. */
export type Difficulty = 'easy' | 'medium' | 'pro';

/** כל קטגוריות התוכן האפשריות, לבדיקת תקינות ולבניית בוררים. */
export const CONTENT_CATEGORIES: readonly ContentCategory[] = ['settlement', 'landmark', 'mixed'];

/** כל דרגות הקושי האפשריות, לבדיקת תקינות ולבניית בוררים. */
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'pro'];

/** תוויות תצוגה בעברית לקטגוריית תוכן. */
export const CATEGORY_LABELS: Readonly<Record<ContentCategory, string>> = {
  settlement: 'ישובים',
  landmark: 'אתרים לאומיים ומוכרים',
  mixed: 'מעורב',
};

/** תוויות תצוגה בעברית לדרגת קושי. */
export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'קל',
  medium: 'בינוני',
  pro: 'מקצוענים',
};

/** מיקום שניתן לשאול עליו. */
export interface GameLocation {
  /** מזהה יציב; משמש גם לשמירת תוצאות היסטוריות. */
  readonly id: string;
  /** שם התצוגה שמוצג לשחקנים. */
  readonly name: string;
  readonly category: LocationCategory;
  /** דרגת הקושי שבה המיקום נכלל במאגר. */
  readonly difficulty: Difficulty;
  /** המיקום האמיתי (WGS84). */
  readonly position: LatLng;
  /** עובדה קצרה המוצגת במסך הסיכום — מוסיפה ערך חינוכי. */
  readonly fact?: string;
}

/** חבילת תוכן = קטגוריית משחק. */
export interface QuestionPack {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** המפה שעליה משחקים בחבילה זו. */
  readonly mapId: string;
  readonly locations: readonly GameLocation[];
}

/**
 * החבילה הראשית: ישובים ואתרים לאומיים בישראל, בשלוש דרגות קושי.
 * הקואורדינטות הן מרכז העיר / מוקד האתר לפי WGS84.
 */
export const ISRAEL_CLASSIC_PACK: QuestionPack = {
  id: 'israel-classic',
  name: 'ערים ואתרים בישראל',
  description: 'ישובים ואתרים לאומיים ברחבי הארץ, בשלוש דרגות קושי',
  mapId: 'israel',
  locations: ISRAEL_LOCATIONS,
};

/** כל חבילות התוכן הזמינות, לפי מזהה. */
export const PACKS: Readonly<Record<string, QuestionPack>> = {
  [ISRAEL_CLASSIC_PACK.id]: ISRAEL_CLASSIC_PACK,
};

/** חבילת ברירת המחדל למשחק חדש. */
export const DEFAULT_PACK_ID = ISRAEL_CLASSIC_PACK.id;

/** מאתר חבילה לפי מזהה; זורק שגיאה מפורשת אם המזהה אינו מוכר. */
export function getPack(packId: string): QuestionPack {
  const pack = PACKS[packId];
  if (!pack) {
    throw new Error(`חבילת תוכן לא מוכרת: "${packId}"`);
  }
  return pack;
}

/** רשימת החבילות לתצוגה במסך יצירת המשחק. */
export function listPacks(): readonly QuestionPack[] {
  return Object.values(PACKS);
}

/**
 * מסנן את מיקומי החבילה לפי קטגוריית תוכן ודרגת קושי — זהו מאגר
 * השאלות שממנו נבחר המשחק בפועל. "מעורב" מחזיר גם ישובים וגם אתרים
 * מאותה דרגת קושי.
 */
export function selectLocationPool(
  pack: QuestionPack,
  category: ContentCategory,
  difficulty: Difficulty,
): readonly GameLocation[] {
  return pack.locations.filter(
    (location) =>
      location.difficulty === difficulty && (category === 'mixed' || location.category === category),
  );
}
