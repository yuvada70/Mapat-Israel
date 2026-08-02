/**
 * מסך הסיום של השחקן.
 *
 * בניגוד למסך המנהל, כאן הסיפור אישי: איפה סיימתי, כמה צברתי,
 * ואיפה סימנתי בכל שאלה לעומת המיקום האמיתי. הפודיום מוצג גם כאן,
 * כדי שכולם יחגגו יחד גם אם הם מסתכלים בטלפון ולא במסך הגדול.
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ACCURACY_LABELS, accuracyTier, formatDistance, medalFor } from '@mapat/shared';

import { Confetti } from '../../components/ui/Confetti';
import { IsraelMap, type MapConnector, type MapMarker } from '../../components/map/IsraelMap';
import { Leaderboard } from '../../components/results/Leaderboard';
import { Podium } from '../../components/results/Podium';
import { Button } from '../../components/ui/Button';
import { Card, Stat } from '../../components/ui/misc';
import { useGameStore } from '../../state/gameStore';
import { shareResults } from '../../utils/export';
import styles from './PlayerResults.module.css';

/** לשוניות המסך. */
type Tab = 'me' | 'board';

export function PlayerResults(): JSX.Element {
  const results = useGameStore((store) => store.results);
  const playerId = useGameStore((store) => store.playerId);
  const leaveGame = useGameStore((store) => store.leaveGame);
  const pushToast = useGameStore((store) => store.pushToast);

  const [tab, setTab] = useState<Tab>('me');
  const [roundIndex, setRoundIndex] = useState(0);

  const myEntry = useMemo(
    () => results?.leaderboard.find((entry) => entry.player.id === playerId) ?? null,
    [playerId, results],
  );

  const myGuesses = useMemo(() => {
    if (!results || !playerId) return [];
    return results.rounds.map((round) => ({
      round,
      guess: round.guesses.find((candidate) => candidate.playerId === playerId) ?? null,
    }));
  }, [playerId, results]);

  if (!results) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>מחשבים תוצאות…</p>
      </main>
    );
  }

  const selected = myGuesses[roundIndex];
  const markers: MapMarker[] =
    selected?.guess?.guess !== null && selected?.guess?.guess !== undefined
      ? [
          {
            id: 'mine',
            position: selected.guess.guess,
            hue: myEntry?.player.avatar.hue,
            emphasized: true,
          },
        ]
      : [];

  const connectors: MapConnector[] =
    selected?.guess?.guess !== null && selected?.guess?.guess !== undefined
      ? [
          {
            id: 'mine-line',
            from: selected.guess.guess,
            to: selected.round.location.position,
            hue: myEntry?.player.avatar.hue,
          },
        ]
      : [];

  const medal = myEntry ? medalFor(myEntry.rank) : null;
  const isPodium = (myEntry?.rank ?? 99) <= 3;

  return (
    <main className={styles.page}>
      <Confetti active={isPodium} durationMs={3_500} count={90} />

      <motion.header
        className={styles.hero}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <span className={styles.heroMedal} aria-hidden="true">
          {medal ?? '🎯'}
        </span>
        <h1 className={styles.heroTitle}>
          {myEntry ? `מקום ${myEntry.rank} מתוך ${results.leaderboard.length}` : 'המשחק הסתיים'}
        </h1>

        {myEntry ? (
          <div className={styles.heroStats}>
            <Stat label="נקודות" value={myEntry.totalPoints.toLocaleString('he-IL')} tone="primary" />
            <Stat
              label="מרחק ממוצע"
              value={myEntry.averageDistanceKm === null ? '—' : formatDistance(myEntry.averageDistanceKm)}
            />
            <Stat label="בולי פגיעה" value={myEntry.bullseyes} tone="accent" />
          </div>
        ) : null}
      </motion.header>

      <div className={styles.tabs} role="tablist">
        <button
          className={`${styles.tab} ${tab === 'me' ? styles.tabActive : ''}`}
          onClick={() => setTab('me')}
          role="tab"
          aria-selected={tab === 'me'}
        >
          הסימונים שלי
        </button>
        <button
          className={`${styles.tab} ${tab === 'board' ? styles.tabActive : ''}`}
          onClick={() => setTab('board')}
          role="tab"
          aria-selected={tab === 'board'}
        >
          דירוג ופודיום
        </button>
      </div>

      {tab === 'me' ? (
        <section className={styles.panel}>
          <div className={styles.mapArea}>
            <IsraelMap
              markers={markers}
              truth={selected?.round.location.position ?? null}
              connectors={connectors}
              ariaLabel={`הסימון שלך עבור ${selected?.round.location.name ?? ''}`}
            />
          </div>

          <Card className={styles.roundCard}>
            <div className={styles.roundHead}>
              <h2 className={styles.roundName}>{selected?.round.location.name}</h2>
              {selected?.guess?.distanceKm != null ? (
                <span className={`${styles.tier} ${styles[`tier_${accuracyTier(selected.guess.distanceKm)}`]}`}>
                  {ACCURACY_LABELS[accuracyTier(selected.guess.distanceKm)]}
                </span>
              ) : (
                <span className={`${styles.tier} ${styles.tier_none}`}>לא סימנת</span>
              )}
            </div>

            <div className={styles.roundStats}>
              <Stat
                label="מרחק"
                value={selected?.guess?.distanceKm == null ? '—' : formatDistance(selected.guess.distanceKm)}
              />
              <Stat label="נקודות" value={`+${(selected?.guess?.points ?? 0).toLocaleString('he-IL')}`} tone="primary" />
            </div>

            {selected?.round.location.fact ? (
              <p className={styles.fact}>{selected.round.location.fact}</p>
            ) : null}
          </Card>

          <nav className={styles.roundNav} aria-label="מעבר בין שאלות">
            {myGuesses.map((item, index) => (
              <button
                key={item.round.index}
                className={`${styles.roundDot} ${index === roundIndex ? styles.roundDotActive : ''}`}
                onClick={() => setRoundIndex(index)}
                aria-label={`שאלה ${index + 1}: ${item.round.location.name}`}
                aria-current={index === roundIndex}
              >
                {index + 1}
              </button>
            ))}
          </nav>
        </section>
      ) : (
        <section className={styles.panel}>
          <Podium entries={results.leaderboard.slice(0, 3)} highlightPlayerId={playerId} />
          <Leaderboard entries={results.leaderboard} highlightPlayerId={playerId} />
        </section>
      )}

      <footer className={styles.footer}>
        <Button
          variant="secondary"
          icon="🔗"
          onClick={async () => {
            const outcome = await shareResults(results);
            if (outcome === 'copied') pushToast('success', 'הסיכום הועתק ללוח');
            if (outcome === 'failed') pushToast('warn', 'השיתוף לא נתמך בדפדפן הזה');
          }}
        >
          שיתוף התוצאות
        </Button>
        <Button variant="ghost" onClick={() => void leaveGame()}>
          יציאה
        </Button>
      </footer>

      <p className={styles.waitNote}>אם המנהל יתחיל משחק חדש — תצורפו אליו אוטומטית.</p>
    </main>
  );
}
