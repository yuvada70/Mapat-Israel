/**
 * הכנת הגיאומטריה לציור המפה.
 *
 * החישוב כבד יחסית (מאות נקודות) ולכן הוא נעשה פעם אחת לכל מפה
 * ומאוחסן במטמון. הפלט הוא מחרוזות נתיב SVG מוכנות, כך שהרכיב
 * עצמו רק מצייר.
 */

import {
  createMercatorProjection,
  multiPolygonToPath,
  type MapDefinition,
  type Projection,
} from '@mapat/shared';

/** רזולוציית העבודה הפנימית של ה-SVG. הצגה בפועל מתבצעת ב-viewBox. */
const CANVAS_HEIGHT = 1000;

/** שוליים פנימיים ביחידות ה-viewBox, כדי שקו החוף לא ייגע בקצה. */
const CANVAS_PADDING = 16;

/** גיאומטריה מוכנה לציור. */
export interface PreparedMap {
  readonly width: number;
  readonly height: number;
  readonly projection: Projection;
  /** נתיב גוש היבשה. */
  readonly landPath: string;
  /** נתיבי גופי המים, לפי סדר הציור. */
  readonly waterPaths: readonly { readonly id: string; readonly path: string }[];
}

const cache = new Map<string, PreparedMap>();

/**
 * מכינה (ומאחסנת במטמון) את נתיבי ה-SVG של מפה.
 *
 * @param definition הגדרת המפה מהחבילה המשותפת.
 */
export function prepareMap(definition: MapDefinition): PreparedMap {
  const cached = cache.get(definition.id);
  if (cached) return cached;

  const width = Math.round(CANVAS_HEIGHT * definition.aspectRatio);
  const height = CANVAS_HEIGHT;
  const projection = createMercatorProjection(
    definition.bounds,
    { width, height },
    CANVAS_PADDING,
  );

  const prepared: PreparedMap = {
    width,
    height,
    projection,
    landPath: multiPolygonToPath(definition.land, projection),
    waterPaths: definition.water.map((body) => ({
      id: body.id,
      path: multiPolygonToPath(body.shape, projection),
    })),
  };

  cache.set(definition.id, prepared);
  return prepared;
}
