/**
 * מרשם חבילות התוכן (קטגוריות המשחק).
 *
 * חבילה = רשימת מיקומים המשויכת למפה. הוספת קטגוריה חדשה ("הרים",
 * "שמורות טבע", "ערי אירופה") היא הוספת רשומה כאן בלבד.
 */

import type { LatLng } from '../../geo/coordinates.js';

/** סוג המיקום — משמש לאייקון ולסינון עתידי לפי קטגוריות משנה. */
export type LocationKind = 'city' | 'landmark';

/** מיקום שניתן לשאול עליו. */
export interface GameLocation {
  /** מזהה יציב; משמש גם לשמירת תוצאות היסטוריות. */
  readonly id: string;
  /** שם התצוגה שמוצג לשחקנים. */
  readonly name: string;
  readonly kind: LocationKind;
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
 * החבילה הראשית: 16 ערים ויישובים ו-3 אתרים בישראל.
 * הקואורדינטות הן מרכז העיר / מוקד האתר לפי WGS84.
 */
export const ISRAEL_CLASSIC_PACK: QuestionPack = {
  id: 'israel-classic',
  name: 'ערים ואתרים בישראל',
  description: '16 ערים ויישובים ו-3 אתרים מוכרים — החבילה הקלאסית',
  mapId: 'israel',
  locations: [
    {
      id: 'jerusalem',
      name: 'ירושלים',
      kind: 'city',
      position: { lat: 31.7683, lng: 35.2137 },
      fact: 'העיר הגדולה בישראל בשטח ובאוכלוסייה, ויושבת על קו פרשת המים ההררי.',
    },
    {
      id: 'tel-aviv',
      name: 'תל אביב',
      kind: 'city',
      position: { lat: 32.0853, lng: 34.7818 },
      fact: 'נוסדה ב-1909 כשכונה צפונית ליפו, והיום מרכז כלכלי על חוף הים התיכון.',
    },
    {
      id: 'haifa',
      name: 'חיפה',
      kind: 'city',
      position: { lat: 32.794, lng: 34.9896 },
      fact: 'נבנתה על מדרונות הכרמל, ובה נמל הים הגדול בישראל.',
    },
    {
      id: 'beer-sheva',
      name: 'באר שבע',
      kind: 'city',
      position: { lat: 31.253, lng: 34.7915 },
      fact: 'בירת הנגב, בצומת הדרכים המרכזי של דרום הארץ.',
    },
    {
      id: 'eilat',
      name: 'אילת',
      kind: 'city',
      position: { lat: 29.5577, lng: 34.9519 },
      fact: 'העיר הדרומית ביותר בישראל, על חופו של ים סוף.',
    },
    {
      id: 'ashdod',
      name: 'אשדוד',
      kind: 'city',
      position: { lat: 31.8014, lng: 34.6553 },
      fact: 'עיר נמל על חוף הים התיכון, כ-30 ק"מ דרומית לתל אביב.',
    },
    {
      id: 'netanya',
      name: 'נתניה',
      kind: 'city',
      position: { lat: 32.3215, lng: 34.8532 },
      fact: 'שוכנת במרכז מישור החוף, על מצוק הכורכר שמעל הים.',
    },
    {
      id: 'modiin',
      name: 'מודיעין',
      kind: 'city',
      position: { lat: 31.8928, lng: 35.0104 },
      fact: 'עיר מתוכננת בשפלה, בדיוק באמצע הדרך בין תל אביב לירושלים.',
    },
    {
      id: 'afula',
      name: 'עפולה',
      kind: 'city',
      position: { lat: 32.6078, lng: 35.2897 },
      fact: 'ליבו של עמק יזרעאל, ומכונה "בירת העמק".',
    },
    {
      id: 'tiberias',
      name: 'טבריה',
      kind: 'city',
      position: { lat: 32.7922, lng: 35.5312 },
      fact: 'יושבת על חופה המערבי של הכנרת, כ-200 מטר מתחת לפני הים.',
    },
    {
      id: 'safed',
      name: 'צפת',
      kind: 'city',
      position: { lat: 32.965, lng: 35.4951 },
      fact: 'העיר הגבוהה בישראל, בהרי הגליל העליון.',
    },
    {
      id: 'dimona',
      name: 'דימונה',
      kind: 'city',
      position: { lat: 31.0703, lng: 35.0333 },
      fact: 'עיר פיתוח בנגב המזרחי, בדרך לים המלח.',
    },
    {
      id: 'eli',
      name: 'עלי',
      kind: 'city',
      position: { lat: 32.07139, lng: 35.26528 },
      fact: 'יישוב קהילתי בהרי בנימין, על כביש 60 בין שילה לצומת תפוח.',
    },
    {
      id: 'hebron',
      name: 'חברון',
      kind: 'city',
      position: { lat: 31.52528, lng: 35.10833 },
      fact: 'העיר הגדולה בהרי חברון, ובה מערת המכפלה — מהאתרים המקודשים בעולם היהודי.',
    },
    {
      id: 'sde-yitzhak',
      name: 'שדה יצחק',
      kind: 'city',
      position: { lat: 32.40389, lng: 34.99444 },
      fact: 'מושב בעמק חפר, מדרום-מזרח לחדרה.',
    },
    {
      id: 'netiv-haasara',
      name: 'נתיב העשרה',
      kind: 'city',
      position: { lat: 31.57083, lng: 34.53944 },
      fact: 'מושב חופי על גבול רצועת עזה, הידוע גם בקיר הציורים הצבעוני לאורך הגדר.',
    },
    {
      id: 'ben-gurion-airport',
      name: 'נמל התעופה בן-גוריון',
      kind: 'landmark',
      position: { lat: 32.0055, lng: 34.8854 },
      fact: 'שדה התעופה הבינלאומי הראשי של ישראל, סמוך ללוד.',
    },
    {
      id: 'masada',
      name: 'מצדה',
      kind: 'landmark',
      position: { lat: 31.3156, lng: 35.3536 },
      fact: 'מבצר הרודיאני על צוק במדבר יהודה, מעל חופו המערבי של ים המלח.',
    },
    {
      id: 'mount-hermon',
      name: 'החרמון',
      kind: 'landmark',
      position: { lat: 33.305, lng: 35.785 },
      fact: 'הנקודה הגבוהה בשליטת ישראל, בקצה הצפוני של הארץ.',
    },
  ],
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
