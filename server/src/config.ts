/**
 * תצורת השרת — נקראת ממשתני סביבה עם ערכי ברירת מחדל בטוחים.
 *
 * כל ערך מאומת פעם אחת בעליית התהליך, כדי שכשל תצורה יתגלה מיד
 * ולא באמצע משחק.
 */

/** ממשק התצורה של השרת. */
export interface ServerConfig {
  /** פורט ההאזנה. */
  readonly port: number;
  /** כתובת ההאזנה. */
  readonly host: string;
  /** סביבת ההרצה. */
  readonly nodeEnv: 'development' | 'production' | 'test';
  /**
   * כתובת הבסיס הציבורית שממנה נבנים קישור ההצטרפות וה-QR.
   * כשהיא ריקה, הכתובת נגזרת מכותרות הבקשה — מה שמאפשר לעבוד
   * גם בפיתוח מקומי וגם מאחורי פרוקסי, ללא הגדרה.
   */
  readonly publicBaseUrl: string | null;
  /** מקורות מותרים ל-CORS. '*' מתיר הכול (ברירת מחדל בפיתוח). */
  readonly corsOrigins: string[] | '*';
  /** משך חיים של חדר לא פעיל, במילישניות. */
  readonly roomTtlMs: number;
  /** תדירות ניקוי חדרים שפג תוקפם. */
  readonly cleanupIntervalMs: number;
  /** מספר החדרים הפעילים המרבי בתהליך. */
  readonly maxRooms: number;
  /** האם להגיש את קבצי הלקוח הבנויים. */
  readonly serveClient: boolean;
  /** נתיב לתיקיית הלקוח הבנוי. */
  readonly clientDir: string;
  /** האם לסמוך על כותרות פרוקסי (X-Forwarded-*). */
  readonly trustProxy: boolean;
}

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`משתנה הסביבה ${name} חייב להיות מספר שלם (התקבל "${raw}")`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`משתנה הסביבה ${name} חייב להיות בטווח ${min}–${max} (התקבל ${parsed})`);
  }
  return parsed;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

/** בונה את התצורה ממשתני הסביבה. נקרא פעם אחת בעליית התהליך. */
export function loadConfig(): ServerConfig {
  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as ServerConfig['nodeEnv'];
  const originsRaw = process.env['CORS_ORIGINS']?.trim();

  const publicBaseUrl = process.env['PUBLIC_BASE_URL']?.trim().replace(/\/+$/, '') || null;
  if (publicBaseUrl !== null) {
    try {
      new URL(publicBaseUrl);
    } catch {
      throw new Error(`PUBLIC_BASE_URL אינו כתובת תקינה: "${publicBaseUrl}"`);
    }
  }

  return {
    port: readInt('PORT', 3000, 1, 65535),
    host: process.env['HOST']?.trim() || '0.0.0.0',
    nodeEnv,
    publicBaseUrl,
    corsOrigins: !originsRaw || originsRaw === '*' ? '*' : originsRaw.split(',').map((o) => o.trim()),
    roomTtlMs: readInt('ROOM_TTL_MINUTES', 240, 5, 24 * 60) * 60_000,
    cleanupIntervalMs: 60_000,
    maxRooms: readInt('MAX_ROOMS', 500, 1, 100_000),
    serveClient: readBoolean('SERVE_CLIENT', true),
    clientDir: process.env['CLIENT_DIR']?.trim() || 'client/dist',
    trustProxy: readBoolean('TRUST_PROXY', true),
  };
}
