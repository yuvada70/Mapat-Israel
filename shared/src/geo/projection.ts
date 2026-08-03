/**
 * היטל (Projection) דו-כיווני בין קואורדינטות גיאוגרפיות לקואורדינטות מסך.
 *
 * המערכת משתמשת ב-Web Mercator (EPSG:3857) — אותו היטל של Google Maps —
 * כדי שצורת המפה תיראה מוכרת. ההיטל הפיך במדויק, ולכן אותה פונקציה
 * משמשת גם לציור המפה (גיאוגרפי → מסך) וגם לתרגום לחיצת המשתמש
 * (מסך → גיאוגרפי) ללא איבוד דיוק.
 *
 * ההיטל נבנה פעם אחת לכל מפה מתוך התיבה התוחמת שלה, ולכן הוספת מפה
 * של מדינה אחרת בעתיד אינה דורשת שינוי קוד — רק נתונים.
 */

import type { GeoBounds, LatLng } from './coordinates.js';

/** נקודה במרחב הציור (יחידות viewBox של ה-SVG). */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/** ממדי לוח הציור. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** היטל הפיך בין העולם למסך. */
export interface Projection {
  /** ממדי לוח הציור שההיטל מכויל אליו. */
  readonly viewport: Viewport;
  /** גיאוגרפי → מסך. */
  project(point: LatLng): Point2D;
  /** מסך → גיאוגרפי. */
  unproject(point: Point2D): LatLng;
}

const MAX_MERCATOR_LAT = 85.05112878;

const DEG_TO_RAD = Math.PI / 180;

/**
 * קו אורך → קואורדינטת X של מרקטור.
 *
 * חשוב: שני הצירים חייבים להיות באותן יחידות (רדיאנים), אחרת המפה
 * נמתחת. קו האורך הוא ליניארי בהיטל מרקטור, ולכן ההמרה היא רק
 * שינוי יחידות.
 */
function mercatorX(lng: number): number {
  return lng * DEG_TO_RAD;
}

/** הפעולה ההפוכה ל-{@link mercatorX}. */
function inverseMercatorX(x: number): number {
  return x / DEG_TO_RAD;
}

/** קו רוחב → קואורדינטת Y של מרקטור, באותן יחידות (רדיאנים). */
function mercatorY(lat: number): number {
  const clamped = Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
  const rad = clamped * DEG_TO_RAD;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

/** הפעולה ההפוכה ל-{@link mercatorY}. */
function inverseMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEG_TO_RAD;
}

/**
 * בונה היטל Web Mercator המתאים תיבה תוחמת גיאוגרפית ללוח ציור נתון.
 *
 * המפה תמיד נשמרת ביחס גובה-רוחב מקורי (ללא מתיחה) וממורכזת בלוח,
 * ולכן היא נראית נכון בכל גודל מסך — מובייל, דסקטופ ומקרן.
 *
 * @param bounds  התיבה התוחמת של המפה.
 * @param viewport ממדי לוח הציור.
 * @param padding שוליים פנימיים ביחידות לוח הציור.
 */
export function createMercatorProjection(
  bounds: GeoBounds,
  viewport: Viewport,
  padding = 0,
): Projection {
  const west = mercatorX(bounds.minLng);
  const east = mercatorX(bounds.maxLng);
  const north = mercatorY(bounds.maxLat);
  const south = mercatorY(bounds.minLat);

  const worldWidth = east - west;
  const worldHeight = north - south;

  const usableWidth = Math.max(1, viewport.width - padding * 2);
  const usableHeight = Math.max(1, viewport.height - padding * 2);

  // קנה מידה אחיד לשני הצירים — שומר על יחס הגובה-רוחב האמיתי.
  const scale = Math.min(usableWidth / worldWidth, usableHeight / worldHeight);

  const offsetX = padding + (usableWidth - worldWidth * scale) / 2;
  const offsetY = padding + (usableHeight - worldHeight * scale) / 2;

  return {
    viewport,
    project({ lat, lng }: LatLng): Point2D {
      return {
        x: offsetX + (mercatorX(lng) - west) * scale,
        y: offsetY + (north - mercatorY(lat)) * scale,
      };
    },
    unproject({ x, y }: Point2D): LatLng {
      return {
        lng: inverseMercatorX(west + (x - offsetX) / scale),
        lat: inverseMercatorY(north - (y - offsetY) / scale),
      };
    },
  };
}

/**
 * יחס הרוחב לגובה של תיבה תוחמת במרחב מרקטור.
 * משמש לקביעת ה-viewBox של המפה כך שלא ייווצר עיוות.
 */
export function boundsAspectRatio(bounds: GeoBounds): number {
  const width = mercatorX(bounds.maxLng) - mercatorX(bounds.minLng);
  const height = mercatorY(bounds.maxLat) - mercatorY(bounds.minLat);
  return height === 0 ? 1 : width / height;
}

/**
 * ממיר טבעת קואורדינטות של GeoJSON (מערך של [lng, lat]) לפקודת נתיב SVG.
 * מוחזרת מחרוזת סגורה (Z) כדי לאפשר מילוי.
 */
export function ringToPath(ring: readonly (readonly [number, number])[], projection: Projection): string {
  if (ring.length === 0) return '';

  let path = '';
  for (let i = 0; i < ring.length; i += 1) {
    const coordinate = ring[i];
    if (!coordinate) continue;
    const { x, y } = projection.project({ lng: coordinate[0], lat: coordinate[1] });
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${path}Z`;
}

/** ממיר פוליגון מרובה־טבעות (MultiPolygon של GeoJSON) לנתיב SVG יחיד. */
export function multiPolygonToPath(
  multiPolygon: readonly (readonly (readonly (readonly [number, number])[])[])[],
  projection: Projection,
): string {
  let path = '';
  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      path += ringToPath(ring, projection);
    }
  }
  return path;
}
