/**
 * מרשם המפות של המערכת.
 *
 * כל מפה היא נתונים בלבד — גיאומטריה + תיבה תוחמת. כדי להוסיף בעתיד מפה
 * של מדינה אחרת מספיק להוסיף כאן רשומה חדשה; אין צורך לגעת בקוד המשחק,
 * ברכיב המפה או בשרת.
 */

import type { GeoBounds } from '../../geo/coordinates.js';
import { boundsAspectRatio } from '../../geo/projection.js';
import type { MultiPolygon } from '../../geo/shapes.js';
import { DEAD_SEA, ISRAEL_BOUNDS, ISRAEL_LAND, SEA_OF_GALILEE } from './israel.geo.js';

/** גוף מים המצויר בתוך המפה (ימה, אגם, נהר רחב). */
export interface WaterBody {
  readonly id: string;
  readonly name: string;
  readonly shape: MultiPolygon;
}

/** הגדרת מפה שלמה. */
export interface MapDefinition {
  readonly id: string;
  /** שם תצוגה. */
  readonly name: string;
  /** התיבה התוחמת של כלל הגיאומטריה. */
  readonly bounds: GeoBounds;
  /** יחס רוחב/גובה במרחב מרקטור — קובע את ה-viewBox. */
  readonly aspectRatio: number;
  /** גוש היבשה, כולל קו החוף וגבולות המדינה. */
  readonly land: MultiPolygon;
  /** גופי המים המצוירים על המפה. */
  readonly water: readonly WaterBody[];
}

/** מפת ישראל: גבולות, קו חוף, הכנרת וים המלח — ללא כיתובים, כבישים או סימונים. */
export const ISRAEL_MAP: MapDefinition = {
  id: 'israel',
  name: 'ישראל',
  bounds: ISRAEL_BOUNDS,
  aspectRatio: boundsAspectRatio(ISRAEL_BOUNDS),
  land: ISRAEL_LAND,
  water: [
    { id: 'sea-of-galilee', name: 'הכנרת', shape: SEA_OF_GALILEE },
    { id: 'dead-sea', name: 'ים המלח', shape: DEAD_SEA },
  ],
};

/** כל המפות הזמינות, לפי מזהה. */
export const MAPS: Readonly<Record<string, MapDefinition>> = {
  [ISRAEL_MAP.id]: ISRAEL_MAP,
};

/** מאתר מפה לפי מזהה; זורק שגיאה מפורשת אם המזהה אינו מוכר. */
export function getMap(mapId: string): MapDefinition {
  const definition = MAPS[mapId];
  if (!definition) {
    throw new Error(`מפה לא מוכרת: "${mapId}"`);
  }
  return definition;
}
