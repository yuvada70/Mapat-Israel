import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { haversineDistanceKm } from '../geo/coordinates.js';
import { ISRAEL_CLASSIC_PACK } from '../content/packs/index.js';
import { ISRAEL_MAP } from '../content/maps/index.js';
import { isWithinBounds } from '../geo/coordinates.js';
import { createMercatorProjection } from '../geo/projection.js';
import { DEFAULT_SCORING, NO_ANSWER_SCORE, accuracyTier, scoreGuess } from './scoring.js';
import { buildLeaderboard } from './leaderboard.js';
import type { PlayerPublic, RoundResult } from './types.js';

describe('haversineDistanceKm', () => {
  it('מחזיר 0 לאותה נקודה', () => {
    const point = { lat: 32.0853, lng: 34.7818 };
    assert.equal(haversineDistanceKm(point, point), 0);
  });

  it('מחשב נכון את המרחק תל אביב–ירושלים (~54 ק"מ)', () => {
    const distance = haversineDistanceKm(
      { lat: 32.0853, lng: 34.7818 },
      { lat: 31.7683, lng: 35.2137 },
    );
    assert.ok(distance > 52 && distance < 56, `התקבל ${distance}`);
  });

  it('מחשב נכון את המרחק מטולה–אילת (~470 ק"מ)', () => {
    const distance = haversineDistanceKm(
      { lat: 33.2789, lng: 35.5786 },
      { lat: 29.5577, lng: 34.9519 },
    );
    assert.ok(distance > 405 && distance < 425, `התקבל ${distance}`);
  });
});

describe('scoreGuess', () => {
  const target = { lat: 32.0853, lng: 34.7818 };

  it('מעניק ניקוד מלא בתוך רדיוס בול פגיעה', () => {
    const result = scoreGuess(target, target);
    assert.equal(result.points, DEFAULT_SCORING.maxScore);
    assert.equal(result.isBullseye, true);
  });

  it('הניקוד יורד באופן מונוטוני עם המרחק', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const offset of [0, 0.05, 0.1, 0.25, 0.5, 1, 2]) {
      const { points } = scoreGuess({ lat: target.lat + offset, lng: target.lng }, target);
      assert.ok(points <= previous, `ניקוד עלה במקום לרדת במרחק ${offset}`);
      previous = points;
    }
  });

  it('הניקוד רציף ואינו בינארי', () => {
    const near = scoreGuess({ lat: target.lat + 0.05, lng: target.lng }, target).points;
    const far = scoreGuess({ lat: target.lat + 0.2, lng: target.lng }, target).points;
    assert.ok(near > far);
    assert.ok(far > 0, 'גם ניחוש בינוני צריך לזכות בנקודות');
  });

  it('לעולם אינו שלילי ואינו עולה על המקסימום', () => {
    const antipode = scoreGuess({ lat: -32, lng: -145 }, target);
    assert.ok(antipode.points >= 0);
    assert.ok(antipode.points <= DEFAULT_SCORING.maxScore);
  });

  it('בונוס מהירות מנוטרל כברירת מחדל ומופעל בהגדרה', () => {
    const withoutBonus = scoreGuess(target, target, { elapsedMs: 100, roundDurationMs: 5000 });
    assert.equal(withoutBonus.speedBonus, 0);

    const withBonus = scoreGuess(target, target, {
      elapsedMs: 0,
      roundDurationMs: 5000,
      config: { ...DEFAULT_SCORING, speedBonusRatio: 0.1 },
    });
    assert.equal(withBonus.speedBonus, 100);
    assert.equal(withBonus.points, 1100);
  });

  it('מסווג רמות דיוק', () => {
    assert.equal(accuracyTier(0.5), 'bullseye');
    assert.equal(accuracyTier(8), 'excellent');
    assert.equal(accuracyTier(20), 'good');
    assert.equal(accuracyTier(45), 'fair');
    assert.equal(accuracyTier(300), 'far');
    assert.equal(accuracyTier(NO_ANSWER_SCORE.distanceKm), 'none');
  });
});

describe('חבילת התוכן', () => {
  it('כוללת 15 שאלות — 12 ערים ו-3 אתרים', () => {
    const { locations } = ISRAEL_CLASSIC_PACK;
    assert.equal(locations.length, 15);
    assert.equal(locations.filter((l) => l.kind === 'city').length, 12);
    assert.equal(locations.filter((l) => l.kind === 'landmark').length, 3);
  });

  it('לכל מיקום מזהה ייחודי ושם ייחודי', () => {
    const ids = new Set(ISRAEL_CLASSIC_PACK.locations.map((l) => l.id));
    const names = new Set(ISRAEL_CLASSIC_PACK.locations.map((l) => l.name));
    assert.equal(ids.size, 15);
    assert.equal(names.size, 15);
  });

  it('כל המיקומים נופלים בתוך גבולות המפה', () => {
    for (const location of ISRAEL_CLASSIC_PACK.locations) {
      assert.ok(
        isWithinBounds(location.position, ISRAEL_MAP.bounds),
        `${location.name} מחוץ לגבולות המפה`,
      );
    }
  });
});

describe('היטל המפה', () => {
  const projection = createMercatorProjection(ISRAEL_MAP.bounds, { width: 1000, height: 1400 }, 24);

  it('הפיך — project ואחריו unproject מחזירים את הנקודה המקורית', () => {
    for (const location of ISRAEL_CLASSIC_PACK.locations) {
      const roundTrip = projection.unproject(projection.project(location.position));
      assert.ok(Math.abs(roundTrip.lat - location.position.lat) < 1e-9);
      assert.ok(Math.abs(roundTrip.lng - location.position.lng) < 1e-9);
    }
  });

  it('קנה המידה זהה בשני הצירים — המפה לא נמתחת', () => {
    // מודדים כמה פיקסלים "שווה" קילומטר, פעם בציר צפון-דרום ופעם
    // במזרח-מערב. אם היחידות של שני הצירים אינן זהות, ההפרש יזנק.
    const center = { lat: 31.5, lng: 35.0 };
    const north = { lat: 32.4, lng: 35.0 };
    const east = { lat: 31.5, lng: 35.85 };

    const pixelsPerKm = (a: typeof center, b: typeof center) => {
      const pa = projection.project(a);
      const pb = projection.project(b);
      return Math.hypot(pb.x - pa.x, pb.y - pa.y) / haversineDistanceKm(a, b);
    };

    const vertical = pixelsPerKm(center, north);
    const horizontal = pixelsPerKm(center, east);
    const ratio = horizontal / vertical;

    assert.ok(ratio > 0.98 && ratio < 1.02, `יחס קנה מידה מעוות: ${ratio.toFixed(3)}`);
  });

  it('יחס הגובה-רוחב של ישראל הגיוני (מדינה צרה וארוכה)', () => {
    assert.ok(
      ISRAEL_MAP.aspectRatio > 0.25 && ISRAEL_MAP.aspectRatio < 0.55,
      `יחס לא סביר: ${ISRAEL_MAP.aspectRatio}`,
    );
  });

  it('שומר על סדר גיאוגרפי: צפון למעלה, מזרח מימין', () => {
    const north = projection.project({ lat: 33, lng: 35 });
    const south = projection.project({ lat: 30, lng: 35 });
    const east = projection.project({ lat: 32, lng: 35.5 });
    const west = projection.project({ lat: 32, lng: 34.5 });
    assert.ok(north.y < south.y);
    assert.ok(east.x > west.x);
  });
});

describe('buildLeaderboard', () => {
  const player = (id: string, name: string): PlayerPublic => ({
    id,
    name,
    avatar: { emoji: '🦊', hue: 12 },
    connected: true,
    score: 0,
    joinedAt: 0,
  });
  const players = [player('a', 'אבי'), player('b', 'בני'), player('c', 'גדי')];

  const rounds: RoundResult[] = [
    {
      index: 0,
      location: ISRAEL_CLASSIC_PACK.locations[0]!,
      guesses: [
        { playerId: 'a', guess: { lat: 31.77, lng: 35.21 }, distanceKm: 0.4, points: 1000, elapsedMs: 900 },
        { playerId: 'b', guess: { lat: 32.0, lng: 35.0 }, distanceKm: 33, points: 360, elapsedMs: 2200 },
        { playerId: 'c', guess: null, distanceKm: null, points: 0, elapsedMs: null },
      ],
    },
    {
      index: 1,
      location: ISRAEL_CLASSIC_PACK.locations[1]!,
      guesses: [
        { playerId: 'a', guess: { lat: 32.1, lng: 34.8 }, distanceKm: 2.4, points: 970, elapsedMs: 1500 },
        { playerId: 'b', guess: { lat: 32.09, lng: 34.78 }, distanceKm: 0.6, points: 1000, elapsedMs: 800 },
        { playerId: 'c', guess: null, distanceKm: null, points: 0, elapsedMs: null },
      ],
    },
  ];

  it('ממיין לפי ניקוד יורד ומדרג מ-1', () => {
    const board = buildLeaderboard(players, rounds, 1.5);
    assert.deepEqual(board.map((e) => e.player.id), ['a', 'b', 'c']);
    assert.deepEqual(board.map((e) => e.rank), [1, 2, 3]);
    assert.equal(board[0]!.totalPoints, 1970);
  });

  it('סופר בולי פגיעה וסיבובים שנענו', () => {
    const board = buildLeaderboard(players, rounds, 1.5);
    assert.equal(board[0]!.bullseyes, 1);
    assert.equal(board[1]!.bullseyes, 1);
    assert.equal(board[2]!.answeredRounds, 0);
    assert.equal(board[2]!.averageDistanceKm, null);
  });

  it('מעניק אותו דירוג לשוויון ניקוד', () => {
    const tie: RoundResult[] = [
      {
        index: 0,
        location: ISRAEL_CLASSIC_PACK.locations[0]!,
        guesses: [
          { playerId: 'a', guess: { lat: 31.77, lng: 35.21 }, distanceKm: 5, points: 500, elapsedMs: 1 },
          { playerId: 'b', guess: { lat: 31.77, lng: 35.21 }, distanceKm: 9, points: 500, elapsedMs: 1 },
        ],
      },
    ];
    const board = buildLeaderboard(players.slice(0, 2), tie, 1.5);
    assert.deepEqual(board.map((e) => e.rank), [1, 1]);
    // שובר השוויון: מרחק ממוצע קטן יותר עולה למעלה.
    assert.equal(board[0]!.player.id, 'a');
  });
});
