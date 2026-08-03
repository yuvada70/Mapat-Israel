/**
 * מסך המנהל במהלך המשחק.
 *
 * זהו המסך שמוקרן לקהל, ולכן הוא מציג רק את מה שמותר לחשוף:
 * שם המקום, מספר הסיבוב, הטיימר, כמה כבר סימנו, וטבלת ניקוד מצטבר.
 * המיקום האמיתי, המרחקים והניחושים אינם מגיעים כלל לדפדפן בשלב הזה.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from '../../components/ui/Button';
import { TimerRing } from '../../components/ui/TimerRing';
import { AvatarBadge } from '../../components/ui/misc';
import { useCountdown } from '../../hooks/useCountdown';
import { useSound } from '../../hooks/useSound';
import { useGameStore } from '../../state/gameStore';
import styles from './HostRound.module.css';

export function HostRound(): JSX.Element {
  const room = useGameStore((store) => store.room)!;
  const pauseGame = useGameStore((store) => store.pauseGame);
  const resumeGame = useGameStore((store) => store.resumeGame);
  const skipRound = useGameStore((store) => store.skipRound);
  const stopGame = useGameStore((store) => store.stopGame);

  const playSound = useSound();
  const [confirmingStop, setConfirmingStop] = useState(false);

  const round = room.round;
  const isPaused = room.phase === 'paused';
  const answered = room.answeredCount;
  const total = room.players.length;

  /* צליל בתחילת כל סיבוב חדש. */
  const lastRoundRef = useRef<number | null>(null);
  useEffect(() => {
    if (!round || room.phase !== 'question') return;
    if (lastRoundRef.current === round.index) return;

    lastRoundRef.current = round.index;
    playSound('roundStart');
  }, [playSound, room.phase, round]);

  /** דירוג לפי ניקוד מצטבר — מותר להצגה במהלך המשחק. */
  const ranked = useMemo(
    () => [...room.players].sort((a, b) => b.score - a.score).slice(0, 10),
    [room.players],
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.progress}>
          <span className={styles.progressLabel}>סיבוב</span>
          <span className={`${styles.progressValue} tabular`}>
            {(round?.index ?? room.completedRounds) + 1}
            <span className={styles.progressTotal}>/{round?.total ?? room.settings.roundCount}</span>
          </span>
        </div>

        <div className={styles.controls}>
          <Button variant="ghost" size="sm" onClick={() => void skipRound()} icon="⏭">
            דילוג
          </Button>
          {isPaused ? (
            <Button variant="secondary" size="sm" onClick={() => void resumeGame()} icon="▶">
              המשך
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => void pauseGame()} icon="⏸">
              עצירה זמנית
            </Button>
          )}
          {confirmingStop ? (
            <div className={styles.confirm}>
              <span className={styles.confirmText}>לסיים ולעבור לתוצאות?</span>
              <Button variant="danger" size="sm" onClick={() => void stopGame()}>
                כן, סיים
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingStop(false)}>
                ביטול
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmingStop(true)} icon="⏹">
              סיום משחק
            </Button>
          )}
        </div>
      </header>

      <main className={styles.stage}>
        <AnimatePresence mode="wait">
          {room.phase === 'countdown' ? (
            <Countdown key="countdown" endsAt={room.phaseEndsAt ?? 0} />
          ) : round ? (
            <motion.div
              key={`round-${round.index}`}
              className={styles.question}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.prompt}>איפה נמצאת/נמצא</span>
              <h1 className={styles.locationName}>{round.locationName}</h1>

              <TimerRing
                startsAt={round.startsAt}
                endsAt={round.endsAt}
                size={168}
                paused={isPaused}
                label={isPaused ? 'מוקפא' : 'שניות'}
              />

              <div className={styles.answered}>
                <div className={styles.answeredBar}>
                  <motion.div
                    className={styles.answeredFill}
                    animate={{ width: total > 0 ? `${(answered / total) * 100}%` : '0%' }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className={`${styles.answeredText} tabular`}>
                  {answered} מתוך {total} סימנו
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="intermission"
              className={styles.intermission}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className={styles.intermissionIcon}>⏳</span>
              <p className={styles.intermissionText}>מתכוננים לשאלה הבאה…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <aside className={styles.scoreboard}>
        <h2 className={styles.scoreboardTitle}>ניקוד מצטבר</h2>
        <ul className={styles.scoreList}>
          {ranked.map((player, index) => (
            <motion.li key={player.id} className={styles.scoreRow} layout transition={{ duration: 0.4 }}>
              <span className={`${styles.scoreRank} tabular`}>{index + 1}</span>
              <AvatarBadge avatar={player.avatar} size={28} dimmed={!player.connected} />
              <span className={styles.scoreName}>{player.name}</span>
              <span className={`${styles.scoreValue} tabular`}>{player.score.toLocaleString('he-IL')}</span>
            </motion.li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/** ספירה לאחור גדולה לפני הסיבוב הראשון. */
function Countdown({ endsAt }: { endsAt: number }): JSX.Element {
  const { remainingMs } = useCountdown(endsAt - 3_000, endsAt);
  const seconds = Math.max(1, Math.ceil(remainingMs / 1_000));

  return (
    <motion.div
      className={styles.countdown}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
    >
      <span className={styles.countdownLabel}>מתחילים בעוד</span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={seconds}
          className={`${styles.countdownNumber} tabular`}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {seconds}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
