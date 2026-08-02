/**
 * בדיקת קצה-לקצה של שכבת הזמן-אמת.
 *
 * מריצה שרת אמיתי, מחברת אליו מנהל ושני שחקנים דרך Socket.IO,
 * ומשחקת משחק שלם. זו הבדיקה שמוודאת שכל החוליות מחוברות:
 * פרוטוקול, הרשאות, תזמון, ניקוד ושידור התוצאות.
 */

import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';

import { io as createClient, type Socket } from 'socket.io-client';
import type { Ack, GameResults, PublicGameState } from '@mapat/shared';

import { loadConfig } from '../config.js';
import { createGateway } from './gateway.js';

/** עוטף emit בהבטחה, לקריאוּת הבדיקות. */
function emit<T>(socket: Socket, event: string, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`פסק זמן באירוע ${event}`)), 5_000);
    socket.emit(event, ...args, (response: Ack<T>) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

/** ממתין לאירוע מהשרת שעונה על תנאי. */
function waitFor<T>(socket: Socket, event: string, predicate: (payload: T) => boolean, timeoutMs = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`פסק זמן בהמתנה ל-${event}`));
    }, timeoutMs);

    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

/** מוודא שהתשובה הצליחה ומחזיר את גופה. */
function unwrap<T>(response: Ack<T>): T {
  assert.equal(response.ok, true, response.ok ? '' : `${response.error}: ${response.message}`);
  return (response as { ok: true; data: T }).data;
}

describe('שרת המשחק — קצה לקצה', () => {
  let httpServer: HttpServer;
  let gateway: ReturnType<typeof createGateway>;
  let baseUrl: string;
  const clients: Socket[] = [];

  const connect = (): Socket => {
    const socket = createClient(baseUrl, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    return socket;
  };

  before(async () => {
    process.env['SERVE_CLIENT'] = 'false';
    const config = { ...loadConfig(), serveClient: false, port: 0 };

    httpServer = createServer();
    gateway = createGateway(httpServer, config);

    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  after(async () => {
    for (const client of clients) client.disconnect();
    await gateway.shutdown();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('משחק מלא: יצירה, הצטרפות, סיבובים ותוצאות', async () => {
    const host = connect();

    const created = unwrap(
      await emit<{ code: string; hostToken: string; joinUrl: string; state: PublicGameState }>(
        host,
        'host:create',
        { settings: { roundCount: 3, roundDurationMs: 400, intermissionMs: 100, countdownMs: 0, shuffleQuestions: false } },
      ),
    );

    assert.match(created.code, /^[A-Z0-9]{5}$/);
    assert.ok(created.joinUrl.endsWith(`/join/${created.code}`));
    assert.equal(created.state.phase, 'lobby');

    // שני שחקנים מצטרפים.
    const alice = connect();
    const bob = connect();

    const aliceJoin = unwrap(
      await emit<{ playerId: string; playerToken: string }>(alice, 'player:join', {
        code: created.code,
        name: 'אליס',
      }),
    );
    unwrap(await emit(bob, 'player:join', { code: created.code, name: 'בוב' }));

    // שם תפוס נדחה.
    const duplicate = await emit(connect(), 'player:join', { code: created.code, name: 'אליס' });
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.ok === false && duplicate.error, 'NAME_TAKEN');

    // המנהל רואה את שני השחקנים.
    const lobbyState = await waitFor<PublicGameState>(host, 'room:state', (state) => state.players.length === 2);
    assert.deepEqual(
      lobbyState.players.map((player) => player.name).sort(),
      ['אליס', 'בוב'],
    );

    // אסור לשחקן להריץ פקודות מנהל.
    const forbidden = await emit(alice, 'host:start');
    assert.equal(forbidden.ok, false);
    assert.equal(forbidden.ok === false && forbidden.error, 'NOT_AUTHORIZED');

    // התחלה, ואז סימון בכל סיבוב.
    const resultsPromise = waitFor<GameResults>(host, 'game:results', () => true);
    unwrap(await emit(host, 'host:start'));

    for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
      await waitFor<PublicGameState>(
        alice,
        'room:state',
        (state) => state.phase === 'question' && state.round?.index === roundIndex,
      );

      unwrap(await emit(alice, 'player:guess', { roundIndex, point: { lat: 32.08, lng: 34.78 } }));
      unwrap(await emit(bob, 'player:guess', { roundIndex, point: { lat: 29.6, lng: 34.95 } }));
    }

    const results = await resultsPromise;

    assert.equal(results.code, created.code);
    assert.equal(results.rounds.length, 3);
    assert.equal(results.endedEarly, false);
    assert.equal(results.leaderboard.length, 2);

    // כל סיבוב מכיל מיקום אמיתי ושני ניחושים עם מרחקים.
    for (const round of results.rounds) {
      assert.ok(Number.isFinite(round.location.position.lat));
      assert.equal(round.guesses.length, 2);
      for (const guess of round.guesses) {
        assert.ok(guess.guess !== null);
        assert.ok(typeof guess.distanceKm === 'number');
        assert.ok(guess.points >= 0);
      }
    }

    // הדירוג עקבי עם הניקוד.
    assert.ok(results.leaderboard[0]!.totalPoints >= results.leaderboard[1]!.totalPoints);
    assert.equal(results.leaderboard[0]!.rank, 1);

    // חיבור מחדש משחזר את הזהות ואת התוצאות.
    const reconnected = connect();
    const restored = unwrap(
      await emit<{ playerId: string; results: GameResults | null }>(reconnected, 'player:attach', {
        code: created.code,
        playerToken: aliceJoin.playerToken,
      }),
    );
    assert.equal(restored.playerId, aliceJoin.playerId);
    assert.ok(restored.results !== null);
  });

  it('דוחה קוד משחק שאינו קיים', async () => {
    const response = await emit(connect(), 'player:join', { code: 'ZZZZZ', name: 'דנה' });
    assert.equal(response.ok, false);
    assert.equal(response.ok === false && response.error, 'ROOM_NOT_FOUND');
  });

  it('דוחה אסימון מנהל שגוי', async () => {
    const host = connect();
    const created = unwrap(await emit<{ code: string }>(host, 'host:create', { settings: {} }));

    const response = await emit(connect(), 'host:attach', { code: created.code, hostToken: 'טוקן-מזויף' });
    assert.equal(response.ok, false);
    assert.equal(response.ok === false && response.error, 'NOT_AUTHORIZED');
  });

  it('עצירה על ידי המנהל מסיימת את המשחק מיד', async () => {
    const host = connect();
    const created = unwrap(
      await emit<{ code: string }>(host, 'host:create', {
        settings: { roundCount: 10, roundDurationMs: 5_000, countdownMs: 0 },
      }),
    );

    const player = connect();
    unwrap(await emit(player, 'player:join', { code: created.code, name: 'גל' }));

    const resultsPromise = waitFor<GameResults>(host, 'game:results', () => true);
    unwrap(await emit(host, 'host:start'));
    await waitFor<PublicGameState>(host, 'room:state', (state) => state.phase === 'question');
    unwrap(await emit(host, 'host:stop'));

    const results = await resultsPromise;
    assert.equal(results.endedEarly, true);
    assert.equal(results.rounds.length, 1);
  });

  it('משחק חדש מאפס ניקוד ומחזיר את השחקנים ללובי', async () => {
    const host = connect();
    const created = unwrap(
      await emit<{ code: string }>(host, 'host:create', {
        settings: { roundCount: 3, roundDurationMs: 200, intermissionMs: 50, countdownMs: 0 },
      }),
    );

    const player = connect();
    unwrap(await emit(player, 'player:join', { code: created.code, name: 'נועה' }));

    const finished = waitFor<GameResults>(player, 'game:results', () => true);
    unwrap(await emit(host, 'host:start'));
    await finished;

    unwrap(await emit(host, 'host:restart'));
    const lobby = await waitFor<PublicGameState>(player, 'room:state', (state) => state.phase === 'lobby');
    assert.equal(lobby.players[0]!.score, 0);
  });

  it('סנכרון שעונים מחזיר את זמן השרת', async () => {
    const socket = connect();
    const serverTime = await new Promise<number>((resolve) => {
      socket.emit('time:sync', Date.now(), resolve);
    });

    assert.ok(Math.abs(serverTime - Date.now()) < 5_000);
  });
});
