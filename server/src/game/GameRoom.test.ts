/**
 * בדיקות מנוע המשחק.
 *
 * הבדיקות מריצות משחק שלם עם שעון מדומה, כך שהן דטרמיניסטיות
 * ומהירות ואינן תלויות בזמן אמת.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ISRAEL_CLASSIC_PACK } from '@mapat/shared';

import { GameError, GameRoom, normalizeSettings, type RoomListeners, type Scheduler } from './GameRoom.js';

/** שעון מדומה עם תור טיימרים — מאפשר "לקפוץ" קדימה בזמן. */
class FakeScheduler implements Scheduler {
  private current = 1_700_000_000_000;
  private nextId = 1;
  private readonly timers = new Map<number, { runAt: number; handler: () => void }>();

  now(): number {
    return this.current;
  }

  setTimeout(handler: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, { runAt: this.current + ms, handler });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  /** מקדם את השעון ומריץ את כל הטיימרים שהגיע זמנם, לפי הסדר. */
  advance(ms: number): void {
    const target = this.current + ms;
    for (;;) {
      let nextId: number | null = null;
      let nextRunAt = Number.POSITIVE_INFINITY;

      for (const [id, timer] of this.timers) {
        if (timer.runAt <= target && timer.runAt < nextRunAt) {
          nextRunAt = timer.runAt;
          nextId = id;
        }
      }
      if (nextId === null) break;

      const timer = this.timers.get(nextId)!;
      this.timers.delete(nextId);
      this.current = timer.runAt;
      timer.handler();
    }
    this.current = target;
  }
}

/** מאזין שמתעד את מה שנשלח החוצה, לצורך בדיקות. */
function createRecorder() {
  const stateEvents: unknown[] = [];
  const resultEvents: unknown[] = [];
  const listeners: RoomListeners = {
    onStateChanged: (room) => void stateEvents.push(room.getPublicState()),
    onResults: (_room, results) => void resultEvents.push(results),
    onPlayerStateChanged: () => {},
  };
  return { listeners, stateEvents, resultEvents };
}

function createRoom(overrides: Record<string, unknown> = {}) {
  const scheduler = new FakeScheduler();
  const recorder = createRecorder();
  const room = new GameRoom(
    'TEST1',
    { countdownMs: 1_000, roundDurationMs: 5_000, intermissionMs: 2_000, shuffleQuestions: false, ...overrides },
    recorder.listeners,
    scheduler,
  );
  return { room, scheduler, ...recorder };
}

describe('הצטרפות שחקנים', () => {
  it('מקבל שם תקין ומייצר אווטאר', () => {
    const { room } = createRoom();
    const player = room.addPlayer('  דנה   כהן ', 'socket-1');

    assert.equal(player.name, 'דנה כהן');
    assert.ok(player.avatar.emoji.length > 0);
    assert.equal(room.playerCount, 1);
  });

  it('דוחה שם קצר מדי', () => {
    const { room } = createRoom();
    assert.throws(() => room.addPlayer('א', 'socket-1'), (error: GameError) => error.code === 'INVALID_NAME');
  });

  it('דוחה שם תפוס, ללא תלות ברישיות וברווחים', () => {
    const { room } = createRoom();
    room.addPlayer('דנה', 'socket-1');
    assert.throws(() => room.addPlayer(' דנה ', 'socket-2'), (error: GameError) => error.code === 'NAME_TAKEN');
  });

  it('מנקה תווי כיווניות בלתי נראים', () => {
    const { room } = createRoom();
    const player = room.addPlayer('‮דנה‬', 'socket-1');
    assert.equal(player.name, 'דנה');
  });

  it('שומר ניקוד בעת ניתוק ומחזירו בחיבור מחדש', () => {
    const { room } = createRoom();
    const player = room.addPlayer('דנה', 'socket-1');

    room.markPlayerDisconnected('socket-1');
    assert.equal(room.getPublicState().players[0]?.connected, false);

    room.reattachPlayer(player.id, 'socket-2');
    assert.equal(room.getPublicState().players[0]?.connected, true);
    assert.equal(room.playerCount, 1);
  });
});

describe('מהלך המשחק', () => {
  it('אינו מתחיל ללא שחקנים', () => {
    const { room } = createRoom();
    assert.throws(() => room.start(), (error: GameError) => error.code === 'NOT_ENOUGH_PLAYERS');
  });

  it('עובר ספירה לאחור ואז לסיבוב ראשון', () => {
    const { room, scheduler } = createRoom();
    room.addPlayer('דנה', 'socket-1');
    room.start();

    assert.equal(room.getPublicState().phase, 'countdown');
    assert.equal(room.getPublicState().round, null, 'אין לחשוף את השאלה לפני שהסיבוב נפתח');

    scheduler.advance(1_000);
    const state = room.getPublicState();
    assert.equal(state.phase, 'question');
    assert.equal(state.round?.index, 0);
    assert.equal(state.round?.total, 15);
  });

  it('המצב הציבורי לעולם אינו מכיל את המיקום האמיתי', () => {
    const { room, scheduler } = createRoom();
    room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);

    const serialized = JSON.stringify(room.getPublicState());
    for (const location of ISRAEL_CLASSIC_PACK.locations) {
      assert.ok(!serialized.includes(String(location.position.lat)), `דלף קו רוחב של ${location.name}`);
      assert.ok(!serialized.includes(String(location.position.lng)), `דלף קו אורך של ${location.name}`);
    }
  });

  it('מתקדם אוטומטית לסיבוב הבא בתום הזמן', () => {
    const { room, scheduler } = createRoom();
    room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);

    scheduler.advance(5_000);
    assert.equal(room.getPublicState().phase, 'intermission');
    assert.equal(room.getPublicState().completedRounds, 1);

    scheduler.advance(2_000);
    assert.equal(room.getPublicState().round?.index, 1);
  });

  it('דוחה תשובה לאחר שהזמן הסתיים', () => {
    const { room, scheduler } = createRoom();
    const player = room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);

    room.submitGuess(player.id, 0, { lat: 32, lng: 35 });
    scheduler.advance(5_000);

    assert.throws(
      () => room.submitGuess(player.id, 0, { lat: 31, lng: 35 }),
      (error: GameError) => error.code === 'ROUND_CLOSED',
    );
  });

  it('מאפשר לעדכן את הסימון כל עוד הסיבוב פתוח', () => {
    const { room, scheduler } = createRoom();
    const player = room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);

    room.submitGuess(player.id, 0, { lat: 32, lng: 35 });
    room.submitGuess(player.id, 0, { lat: 31.5, lng: 34.9 });

    const self = room.getPlayerState(player.id)!;
    assert.equal(self.hasAnswered, true);
    assert.deepEqual(self.currentGuess, { lat: 31.5, lng: 34.9 });
    assert.equal(room.getPublicState().answeredCount, 1);
  });

  it('דוחה סימון מחוץ לגבולות המפה', () => {
    const { room, scheduler } = createRoom();
    const player = room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);

    assert.throws(
      () => room.submitGuess(player.id, 0, { lat: 48.8, lng: 2.3 }),
      (error: GameError) => error.code === 'INVALID_INPUT',
    );
  });

  it('משלים משחק שלם ומפיק תוצאות מלאות', () => {
    const { room, scheduler, resultEvents } = createRoom({ roundCount: 3 });
    const dana = room.addPlayer('דנה', 'socket-1');
    const yoni = room.addPlayer('יוני', 'socket-2');

    room.start();
    scheduler.advance(1_000);

    for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
      // דנה מסמנת קרוב יחסית, יוני רחוק — כדי שהדירוג יהיה ודאי.
      const location = ISRAEL_CLASSIC_PACK.locations.find(
        (l) => l.name === room.getPublicState().round?.locationName,
      )!;
      room.submitGuess(dana.id, roundIndex, { lat: location.position.lat + 0.01, lng: location.position.lng });
      room.submitGuess(yoni.id, roundIndex, { lat: 29.6, lng: 34.95 });
      scheduler.advance(5_000);
      scheduler.advance(2_000);
    }

    assert.equal(room.getPublicState().phase, 'finished');
    assert.equal(resultEvents.length, 1);

    const results = room.getResults()!;
    assert.equal(results.rounds.length, 3);
    assert.equal(results.endedEarly, false);
    assert.equal(results.leaderboard.length, 2);
    assert.equal(results.leaderboard[0]!.player.name, 'דנה');
    assert.equal(results.leaderboard[0]!.rank, 1);
    assert.ok(results.leaderboard[0]!.totalPoints > results.leaderboard[1]!.totalPoints);

    // כל סיבוב מכיל את המיקום האמיתי ואת הניחושים של כל השחקנים.
    for (const round of results.rounds) {
      assert.ok(round.location.position.lat > 0);
      assert.equal(round.guesses.length, 2);
    }
  });

  it('מזכה ב-0 נקודות סיבוב שלא נענה', () => {
    const { room, scheduler } = createRoom({ roundCount: 3, intermissionMs: 500 });
    room.addPlayer('דנה', 'socket-1');

    room.start();
    scheduler.advance(1_000);
    // עוברים את שלושת הסיבובים בלי לסמן דבר.
    scheduler.advance(3 * (5_000 + 500));

    const results = room.getResults()!;
    assert.equal(results.leaderboard[0]!.totalPoints, 0);
    assert.equal(results.leaderboard[0]!.answeredRounds, 0);
    for (const round of results.rounds) {
      assert.equal(round.guesses[0]!.guess, null);
      assert.equal(round.guesses[0]!.distanceKm, null);
      assert.equal(round.guesses[0]!.points, 0);
    }
  });
});

describe('שליטת המנהל', () => {
  it('הקפאה עוצרת את הטיימר וחידוש ממשיך מאותה נקודה', () => {
    const { room, scheduler } = createRoom();
    const player = room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);

    scheduler.advance(2_000);
    room.pause();
    assert.equal(room.getPublicState().phase, 'paused');

    // גם אם עובר הרבה זמן בהקפאה, הסיבוב לא נסגר.
    scheduler.advance(60_000);
    assert.equal(room.getPublicState().phase, 'paused');
    assert.equal(room.getPublicState().completedRounds, 0);

    room.resume();
    assert.equal(room.getPublicState().phase, 'question');

    // נותרו בדיוק 3 שניות.
    room.submitGuess(player.id, 0, { lat: 32, lng: 35 });
    scheduler.advance(2_900);
    assert.equal(room.getPublicState().phase, 'question');
    scheduler.advance(200);
    assert.equal(room.getPublicState().completedRounds, 1);
  });

  it('דילוג סוגר את הסיבוב הנוכחי ופותח את הבא', () => {
    const { room, scheduler } = createRoom();
    room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);

    room.skip();
    assert.equal(room.getPublicState().completedRounds, 1);
    scheduler.advance(2_000);
    assert.equal(room.getPublicState().round?.index, 1);
  });

  it('עצירה מסיימת מיד ושומרת את התשובות שכבר נקלטו', () => {
    const { room, scheduler } = createRoom();
    const player = room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);
    room.submitGuess(player.id, 0, { lat: 32, lng: 35 });

    room.stop();

    const results = room.getResults()!;
    assert.equal(room.getPublicState().phase, 'finished');
    assert.equal(results.endedEarly, true);
    assert.equal(results.rounds.length, 1);
    assert.ok(results.rounds[0]!.guesses[0]!.guess !== null);
  });

  it('משחק חדש מאפס ניקוד ושומר את השחקנים', () => {
    const { room, scheduler } = createRoom({ roundCount: 3 });
    const player = room.addPlayer('דנה', 'socket-1');
    room.start();
    scheduler.advance(1_000);
    room.submitGuess(player.id, 0, { lat: 32, lng: 35 });
    scheduler.advance(3 * (5_000 + 2_000));
    assert.equal(room.getPublicState().phase, 'finished');
    assert.ok(room.getPublicState().players[0]!.score > 0);

    room.restart();
    const state = room.getPublicState();
    assert.equal(state.phase, 'lobby');
    assert.equal(state.players.length, 1);
    assert.equal(state.players[0]!.score, 0);
    assert.equal(room.getResults(), null);
  });

  it('אימות אסימון המנהל', () => {
    const { room } = createRoom();
    assert.equal(room.verifyHostToken(room.hostToken), true);
    assert.equal(room.verifyHostToken('לא-נכון'), false);
    assert.equal(room.verifyHostToken(''), false);
  });
});

describe('normalizeSettings', () => {
  it('משלים ברירות מחדל', () => {
    const settings = normalizeSettings({});
    assert.equal(settings.roundCount, 15);
    assert.equal(settings.roundDurationMs, 5_000);
    assert.equal(settings.packId, 'israel-classic');
  });

  it('מגביל ערכים חורגים לטווח המותר', () => {
    // המקסימום נגזר ממספר המיקומים בחבילה (19), לא מ-SETTINGS_LIMITS.max (30).
    assert.equal(normalizeSettings({ roundCount: 9_999 }).roundCount, 19);
    assert.equal(normalizeSettings({ roundCount: -5 }).roundCount, 3);
    assert.equal(normalizeSettings({ roundDurationMs: 1 }).roundDurationMs, 3_000);
    assert.equal(normalizeSettings({ roundDurationMs: 10 ** 9 }).roundDurationMs, 30_000);
  });

  it('מתעלם מחבילת תוכן לא מוכרת', () => {
    assert.equal(normalizeSettings({ packId: '../../etc/passwd' }).packId, 'israel-classic');
  });

  it('עמיד בפני קלט שאינו מספר', () => {
    const settings = normalizeSettings({ roundCount: 'הרבה' as unknown as number });
    assert.equal(settings.roundCount, 15);
  });
});
