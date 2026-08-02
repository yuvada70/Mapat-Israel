/**
 * מפת ישראל האינטראקטיבית.
 *
 * הרכיב משמש בכל המסכים — סימון בזמן משחק, תצוגת סיכום אצל המנהל,
 * וסקירה אישית בסוף. הוא אגנוסטי למפה: מקבל {@link MapDefinition}
 * ולכן יעבוד ללא שינוי גם עם מפות של מדינות אחרות.
 *
 * שיקולי חוויית משתמש מרכזיים:
 *  • ההמרה מלחיצה לקואורדינטה נעשית דרך מטריצת ה-SVG, ולכן היא מדויקת
 *    בכל גודל מסך, בכל יחס תצוגה ובכל זום של הדפדפן.
 *  • במגע, האצבע מסתירה את הנקודה — לכן מוצגת זכוכית מגדלת מעל
 *    האצבע עם צלב כוונת, וניתן לגרור עד לשחרור כדי לדייק.
 *  • המפה נקייה לחלוטין: גבולות, קו חוף, הכנרת וים המלח בלבד.
 */

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { LatLng, MapDefinition } from '@mapat/shared';
import { ISRAEL_MAP, clampToBounds } from '@mapat/shared';

import { prepareMap } from './geometry';
import styles from './IsraelMap.module.css';

/** סמן יחיד על המפה. */
export interface MapMarker {
  readonly id: string;
  readonly position: LatLng;
  /** גוון הסמן (HSL). ברירת מחדל: צבע המותג. */
  readonly hue?: number;
  /** תווית קצרה מתחת לסמן (שם שחקן / מרחק). */
  readonly label?: string;
  /** האם זהו הסמן של המשתמש עצמו — מודגש יותר. */
  readonly emphasized?: boolean;
  /** שקיפות, לאנימציות הופעה. */
  readonly opacity?: number;
}

/** קו המחבר ניחוש למיקום האמיתי. */
export interface MapConnector {
  readonly id: string;
  readonly from: LatLng;
  readonly to: LatLng;
  readonly hue?: number;
}

export interface IsraelMapProps {
  /** הגדרת המפה. ברירת המחדל היא מפת ישראל. */
  readonly definition?: MapDefinition;
  /** האם ניתן לסמן על המפה. */
  readonly interactive?: boolean;
  /** נקרא בכל סימון או גרירה של הנקודה. */
  readonly onPick?: (point: LatLng) => void;
  /** הנקודה שנבחרה על ידי המשתמש. */
  readonly selection?: LatLng | null;
  /** סמנים נוספים (ניחושי שחקנים במסך הסיכום). */
  readonly markers?: readonly MapMarker[];
  /** המיקום האמיתי — מוצג רק בסיכום. */
  readonly truth?: LatLng | null;
  /** קווי מרחק בין ניחושים לאמת. */
  readonly connectors?: readonly MapConnector[];
  /** טקסט עזרה קצר בתחתית המפה. */
  readonly hint?: string;
  readonly className?: string;
  /** תווית נגישות. */
  readonly ariaLabel?: string;
}

/** רדיוס האזור המוצג בזכוכית המגדלת, ביחידות ה-viewBox. */
const LOUPE_RADIUS = 46;

/**
 * מפה אינטראקטיבית של ישראל.
 */
export function IsraelMap({
  definition = ISRAEL_MAP,
  interactive = false,
  onPick,
  selection = null,
  markers = [],
  truth = null,
  connectors = [],
  hint,
  className,
  ariaLabel = 'מפת ישראל',
}: IsraelMapProps): JSX.Element {
  const prepared = useMemo(() => prepareMap(definition), [definition]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const draggingRef = useRef(false);

  /** ממיר קואורדינטת מסך לקואורדינטת viewBox באמצעות מטריצת ה-SVG. */
  const toLocalPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;

    const matrix = svg.getScreenCTM();
    if (!matrix) return null;

    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }, []);

  /** מתרגם אירוע מצביע לנקודה גיאוגרפית ומדווח החוצה. */
  const handlePointer = useCallback(
    (clientX: number, clientY: number, isTouch: boolean) => {
      const local = toLocalPoint(clientX, clientY);
      if (!local) return;

      const geographic = clampToBounds(prepared.projection.unproject(local), definition.bounds);
      onPick?.(geographic);

      if (isTouch) setLoupe({ ...local, clientX, clientY });
    },
    [definition.bounds, onPick, prepared.projection, toLocalPoint],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive) return;

      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      handlePointer(event.clientX, event.clientY, event.pointerType !== 'mouse');
    },
    [handlePointer, interactive],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive || !draggingRef.current) return;
      handlePointer(event.clientX, event.clientY, event.pointerType !== 'mouse');
    },
    [handlePointer, interactive],
  );

  const endDrag = useCallback(() => {
    draggingRef.current = false;
    setLoupe(null);
  }, []);

  /** מיקום זכוכית המגדלת ביחס למכל, בפיקסלים. */
  const loupeStyle = useMemo(() => {
    if (!loupe) return undefined;

    const container = svgRef.current?.parentElement?.getBoundingClientRect();
    if (!container) return undefined;

    return {
      insetInlineStart: `${loupe.clientX - container.left}px`,
      insetBlockStart: `${loupe.clientY - container.top - 80}px`,
    } satisfies React.CSSProperties;
  }, [loupe]);

  const wrapperClassName = [
    styles.wrapper,
    interactive ? styles.interactive : styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClassName}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${prepared.width} ${prepared.height}`}
        preserveAspectRatio="xMidYMid meet"
        role={interactive ? 'application' : 'img'}
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <MapDefs />
        <MapShapes landPath={prepared.landPath} waterPaths={prepared.waterPaths} />

        {/* קווי מרחק — מתחת לסמנים כדי לא להסתיר אותם. */}
        <g>
          {connectors.map((connector) => {
            const from = prepared.projection.project(connector.from);
            const to = prepared.projection.project(connector.to);
            return (
              <line
                key={connector.id}
                className={styles.connector}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={connector.hue === undefined ? 'var(--color-primary)' : `hsl(${connector.hue} 85% 62%)`}
                strokeWidth={2.5}
              />
            );
          })}
        </g>

        <g>
          {markers.map((marker) => {
            const point = prepared.projection.project(marker.position);
            return <GuessPin key={marker.id} x={point.x} y={point.y} marker={marker} />;
          })}
        </g>

        {truth ? <TruthPin {...prepared.projection.project(truth)} /> : null}

        {selection ? <SelectionPin {...prepared.projection.project(selection)} /> : null}
      </svg>

      {loupe ? (
        <div className={styles.loupe} style={loupeStyle} aria-hidden="true">
          <svg
            viewBox={`${loupe.x - LOUPE_RADIUS} ${loupe.y - LOUPE_RADIUS} ${LOUPE_RADIUS * 2} ${LOUPE_RADIUS * 2}`}
            width="126"
            height="126"
          >
            <MapDefs suffix="-loupe" />
            <MapShapes landPath={prepared.landPath} waterPaths={prepared.waterPaths} suffix="-loupe" />
            <g stroke="var(--color-primary)" strokeWidth={1.6}>
              <line x1={loupe.x - 10} y1={loupe.y} x2={loupe.x + 10} y2={loupe.y} />
              <line x1={loupe.x} y1={loupe.y - 10} x2={loupe.x} y2={loupe.y + 10} />
              <circle cx={loupe.x} cy={loupe.y} r={4} fill="var(--color-primary)" stroke="#fff" strokeWidth={1} />
            </g>
          </svg>
        </div>
      ) : null}

      {hint ? (
        <div className={styles.hint}>
          <span className={styles.hintText}>{hint}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * הגדרות גרפיות משותפות (מעברי צבע וצללים).
 * מקבל סיומת כדי שניתן יהיה לשכפל את המפה בזכוכית המגדלת בלי
 * להתנגש במזהי DOM.
 */
const MapDefs = memo(function MapDefs({ suffix = '' }: { suffix?: string }) {
  return (
    <defs>
      <linearGradient id={`mapat-land-gradient${suffix}`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor="var(--map-land)" />
        <stop offset="100%" stopColor="var(--map-land-shade)" />
      </linearGradient>
      <linearGradient id={`mapat-water-gradient${suffix}`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="var(--map-water-edge)" />
        <stop offset="100%" stopColor="var(--map-water)" />
      </linearGradient>
      <filter id={`mapat-land-shadow${suffix}`} x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#000" floodOpacity="0.45" />
      </filter>
    </defs>
  );
});

/** צורות המפה עצמן — זהות בכל מופע ולכן ממוזכרות. */
const MapShapes = memo(function MapShapes({
  landPath,
  waterPaths,
  suffix = '',
}: {
  landPath: string;
  waterPaths: readonly { id: string; path: string }[];
  suffix?: string;
}) {
  return (
    <g>
      <path
        className={styles.land}
        d={landPath}
        fillRule="evenodd"
        style={{
          fill: `url(#mapat-land-gradient${suffix})`,
          filter: `url(#mapat-land-shadow${suffix})`,
        }}
      />
      {waterPaths.map((water) => (
        <path
          key={water.id}
          className={styles.water}
          d={water.path}
          fillRule="evenodd"
          style={{ fill: `url(#mapat-water-gradient${suffix})` }}
        />
      ))}
    </g>
  );
});

/** סמן הבחירה הפעילה של השחקן. */
function SelectionPin({ x, y }: { x: number; y: number }): JSX.Element {
  return (
    <g pointerEvents="none">
      <circle className={styles.pinPulse} cx={x} cy={y} r={12} stroke="var(--color-primary)" />
      <circle cx={x} cy={y} r={13} fill="var(--color-primary)" fillOpacity={0.28} />
      <circle cx={x} cy={y} r={8} fill="var(--color-primary)" stroke="#fff" strokeWidth={2.5} />
      <g stroke="#fff" strokeWidth={2} opacity={0.9}>
        <line x1={x - 22} y1={y} x2={x - 13} y2={y} />
        <line x1={x + 13} y1={y} x2={x + 22} y2={y} />
        <line x1={x} y1={y - 22} x2={x} y2={y - 13} />
        <line x1={x} y1={y + 13} x2={x} y2={y + 22} />
      </g>
    </g>
  );
}

/** סמן המיקום האמיתי — מוצג רק לאחר סיום המשחק. */
function TruthPin({ x, y }: { x: number; y: number }): JSX.Element {
  return (
    <g pointerEvents="none">
      <circle className={styles.truthRing} cx={x} cy={y} r={26} />
      <circle cx={x} cy={y} r={11} fill="var(--color-accent)" stroke="#fff" strokeWidth={3} />
      <circle cx={x} cy={y} r={4} fill="var(--color-text-inverse)" />
    </g>
  );
}

/** סמן ניחוש של שחקן. */
function GuessPin({ x, y, marker }: { x: number; y: number; marker: MapMarker }): JSX.Element {
  const color = marker.hue === undefined ? 'var(--color-primary)' : `hsl(${marker.hue} 85% 62%)`;
  const radius = marker.emphasized ? 10 : 7;

  return (
    <g pointerEvents="none" opacity={marker.opacity ?? 1}>
      <ellipse className={styles.pinShadow} cx={x} cy={y + radius + 3} rx={radius} ry={radius / 2.6} />
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={color}
        stroke={marker.emphasized ? '#fff' : 'rgb(255 255 255 / 70%)'}
        strokeWidth={marker.emphasized ? 3 : 2}
      />
      {marker.label ? (
        <text className={styles.pinLabel} x={x} y={y - radius - 9} fontSize={marker.emphasized ? 21 : 17}>
          {marker.label}
        </text>
      ) : null}
    </g>
  );
}
