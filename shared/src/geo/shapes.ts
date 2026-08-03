/**
 * טיפוסי גיאומטריה בסגנון GeoJSON.
 *
 * הסדר בתוך זוג קואורדינטות הוא [lng, lat] — בהתאם לתקן GeoJSON (RFC 7946),
 * ולא [lat, lng]. הטיפוסים כאן מבטיחים שלא נתבלבל בין השניים.
 */

/** זוג קואורדינטות בפורמט GeoJSON: [קו אורך, קו רוחב]. */
export type Position = readonly [lng: number, lat: number];

/** טבעת סגורה של מצולע. */
export type Ring = readonly Position[];

/** מצולע: הטבעת הראשונה היא המתאר החיצוני, השאר הם חורים. */
export type Polygon = readonly Ring[];

/** אוסף מצולעים. */
export type MultiPolygon = readonly Polygon[];
