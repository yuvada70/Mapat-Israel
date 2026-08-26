/**
 * מסך המשחק של השחקן — הלב של החוויה.
 *
 * עקרונות:
 *  • המפה תופסת את מרב המסך. כל השאר משני.
 *  • סימון בלחיצה אחת, וניתן לגרור לדיוק עד לתום הזמן.
 *  • אין שום חשיפה של המיקום האמיתי או של מרחקים — רק אישור שהסימון נקלט.
 *  • משוב חושי: רטט קל, צליל קצר, ואנימציית סמן — כדי שברור שנקלט.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LatLng } from '@mapat/shared';

import { IsraelMap } from '../../components/map/IsraelMap';
import { TimerRing } from '../../components/ui/TimerRing';
import { useCountdown } from '../../hooks/useCountdown';
import { useSound } from '../../hooks/useSound';
import { selectMe, useGameStore } from '../../state/gameStore';
import styles from './PlayerRound.module.css';

/**
 * מרווח מזערי בין שליחות ניחוש לשרת בזמן גרירה רציפה. הסימון המקומי
 * מתעדכן על כל תזוזה לתגובתיות מיידית — רק שליחת הרשת ממוצעת, כדי
 * שגרירה חלקה לא תציף עשרות בקשות בשנייה.
 */
const GUESS_THROTTLE_MS = 100;

export function PlayerRound(): JSX.Element {
  const room = useGameStore((store) => store.room)!;
  const self = useGameStore((store) => store.self);
  const submitGuess = useGameStore((store) => store.submitGuess);
  const me = useGameStore(selectMe);

  const playSound = useSound();
  const round = room.round;
  const isPaused = room.phase === 'paused';
  const isQuestion = room.phase === 'question' && round !== null;

  const [pending, setPending] = useState<LatLng | null>(null);

  /* מיתון שליחת הניחוש לרשת בזמן גרירה — ר' GUESS_THROTTLE_MS. */
  const lastSentAtRef = useRef(0);
  const latestPointRef = useRef<LatLng | null>(null);
  const pendingSendRef = useRef<number | null>(null);

  const clearPendingSend = useCallback(() => {
    if (pendingSendRef.current !== null) {
      window.clearTimeout(pendingSendRef.current);
      pendingSendRef.current = null;
    }
  }, []);

  /* איפוס הסימון המקומי בכל סיבוב חדש, וביטול שליחה ממתינה מהסיבוב הקודם. */
  useEffect(() => {
    setPending(null);
    return clearPendingSend;
  }, [round?.index, clearPendingSend]);

  const handlePick = useCallback(
    (point: LatLng) => {
      if (!isQuestion || isPaused) return;

      setPending(point);
      latestPointRef.current = point;

      const now = Date.now();
      const elapsed = now - lastSentAtRef.current;

      if (elapsed >= GUESS_THROTTLE_MS) {
        clearPendingSend();
        lastSentAtRef.current = now;
        void submitGuess(point);
        return;
      }

      if (pendingSendRef.current === null) {
        pendingSendRef.current = window.setTimeout(() => {
          pendingSendRef.current = null;
          lastSentAtRef.current = Date.now();
          if (latestPointRef.current) void submitGuess(latestPointRef.current);
        }, GUESS_THROTTLE_MS - elapsed);
      }
    },
    [clearPendingSend, isPaused, isQuestion, submitGuess],
  );

  /* משוב חושי בעת הסימון הראשון בסיבוב. */
  const feedbackRoundRef = useRef<number | null>(null);
  useEffect(() => {
    if (!pending || !round) return;
    if (feedbackRoundRef.current === round.index) return;

    feedbackRoundRef.current = round.index;
    playSound('place');
    navigator.vibrate?.(18);
  }, [pending, playSound, round]);

  /* תקתוק בשלוש השניות האחרונות. */
  useTickingSound(round?.endsAt ?? 0, isQuestion && !isPaused);

  const selection = pending ?? self?.currentGuess ?? null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerSide}>
          <span className={styles.roundLabel}>
            שאלה <span className="tabular">{(round?.index ?? room.completedRounds) + 1}</span>
            <span className={styles.roundTotal}>/{round?.total ?? room.settings.roundCount}</span>
          </span>
        </div>

        {isQuestion && round ? (
          <TimerRing startsAt={round.startsAt} endsAt={round.endsAt} size={62} paused={isPaused} />
        ) : (
          <span className={styles.headerSpacer} />
        )}

        <div className={`${styles.headerSide} ${styles.headerEnd}`}>
          <span className={`${styles.score} tabular`}>{(me?.score ?? 0).toLocaleString('he-IL')}</span>
          <span className={styles.scoreLabel}>נקודות</span>
          {room.settings.showLiveRank && self?.rank ? (
            <span className={styles.rank}>
              מקום {self.rank} מתוך {self.playerCount}
            </span>
          ) : null}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {isQuestion && round ? (
          <motion.h1
            key={`prompt-${round.index}`}
            className={styles.prompt}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {round.locationName}
          </motion.h1>
        ) : (
          <motion.h1
            key="waiting-prompt"
            className={`${styles.prompt} ${styles.promptMuted}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {room.phase === 'countdown' ? 'מתכוננים…' : isPaused ? 'המשחק מושהה' : 'השאלה הבאה בדרך'}
          </motion.h1>
        )}
      </AnimatePresence>

      <div className={styles.mapArea}>
        <IsraelMap
          interactive={isQuestion && !isPaused}
          onPick={handlePick}
          selection={selection}
          ariaLabel={round ? `מפת ישראל — סמנו את המיקום של ${round.locationName}` : 'מפת ישראל'}
        />

        {!isQuestion ? <div className={styles.mapVeil} aria-hidden="true" /> : null}
      </div>

      <footer className={styles.footer}>
        <AnimatePresence mode="wait">
          {selection && isQuestion ? (
            <motion.div
              key="marked"
              className={`${styles.status} ${styles.statusOk}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              ✓ נקלט — אפשר לגרור כדי לדייק
            </motion.div>
          ) : isQuestion ? (
            <motion.div
              key="unmarked"
              className={styles.status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              הקישו על המפה כדי לסמן
            </motion.div>
          ) : (
            <motion.div
              key="between"
              className={styles.status}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              התוצאות יתגלו רק בסוף המשחק 🤫
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </main>
  );
}

/**
 * משמיע תקתוק בכל אחת משלוש השניות האחרונות של הסיבוב.
 * הנפרדות שלו כ-hook שומרת על רכיב המסך קריא.
 */
function useTickingSound(endsAt: number, active: boolean): void {
  const playSound = useSound();
  const { remainingMs } = useCountdown(endsAt - 5_000, endsAt, !active);
  const lastSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      lastSecondRef.current = null;
      return;
    }

    const second = Math.ceil(remainingMs / 1_000);
    if (second > 3 || second <= 0) return;
    if (lastSecondRef.current === second) return;

    lastSecondRef.current = second;
    playSound('tick');
  }, [active, playSound, remainingMs]);
}
