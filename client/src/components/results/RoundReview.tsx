/**
 * סקירת סיבוב בודד במסך הסיכום.
 *
 * הבימוי מדורג בכוונה: קודם השאלה, אחר כך המיקום האמיתי, ורק אז
 * הניחושים מופיעים אחד־אחד עם קווי המרחק. כך הצופים מספיקים לקלוט
 * כל שלב, והרגע שבו מתגלה מי היה הכי קרוב מקבל הדגשה.
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACCURACY_LABELS,
  accuracyTier,
  formatDistance,
  type PlayerPublic,
  type RoundResult,
} from '@mapat/shared';

import { IsraelMap, type MapConnector, type MapMarker } from '../map/IsraelMap';
import { AvatarBadge } from '../ui/misc';
import styles from './RoundReview.module.css';

export interface RoundReviewProps {
  readonly round: RoundResult;
  /** כל השחקנים, לצורך שמות ואווטארים. */
  readonly players: readonly PlayerPublic[];
  readonly highlightPlayerId?: string | null;
  /** מספר השחקנים המרבי שיוצגו ברשימת המרחקים. */
  readonly maxListed?: number;
  /** האם להריץ את הבימוי המדורג. */
  readonly animate?: boolean;
}

/** שלבי הבימוי. */
type Stage = 'question' | 'truth' | 'guesses';

const STAGE_DELAYS: Record<Exclude<Stage, 'question'>, number> = {
  truth: 900,
  guesses: 1_900,
};

export function RoundReview({
  round,
  players,
  highlightPlayerId = null,
  maxListed = 8,
  animate = true,
}: RoundReviewProps): JSX.Element {
  const [stage, setStage] = useState<Stage>(animate ? 'question' : 'guesses');

  // איפוס והרצה מחדש של הבימוי בכל מעבר לסיבוב אחר.
  useEffect(() => {
    if (!animate) {
      setStage('guesses');
      return;
    }

    setStage('question');
    const toTruth = window.setTimeout(() => setStage('truth'), STAGE_DELAYS.truth);
    const toGuesses = window.setTimeout(() => setStage('guesses'), STAGE_DELAYS.guesses);

    return () => {
      window.clearTimeout(toTruth);
      window.clearTimeout(toGuesses);
    };
  }, [animate, round.index]);

  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  /** הניחושים שנענו, ממוינים מהקרוב לרחוק. */
  const answered = useMemo(
    () =>
      round.guesses
        .filter((guess) => guess.guess !== null && guess.distanceKm !== null)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)),
    [round.guesses],
  );

  const markers: MapMarker[] = useMemo(() => {
    if (stage !== 'guesses') return [];

    return answered.map((guess) => {
      const player = playersById.get(guess.playerId);
      return {
        id: guess.playerId,
        position: guess.guess!,
        hue: player?.avatar.hue,
        label: player?.name,
        emphasized: guess.playerId === highlightPlayerId,
      };
    });
  }, [answered, highlightPlayerId, playersById, stage]);

  const connectors: MapConnector[] = useMemo(() => {
    if (stage !== 'guesses') return [];

    return answered.map((guess) => ({
      id: `line-${guess.playerId}`,
      from: guess.guess!,
      to: round.location.position,
      hue: playersById.get(guess.playerId)?.avatar.hue,
    }));
  }, [answered, playersById, round.location.position, stage]);

  const missing = round.guesses.length - answered.length;
  const closest = answered[0];

  return (
    <div className={styles.review}>
      <div className={styles.mapPane}>
        <IsraelMap
          markers={markers}
          truth={stage === 'question' ? null : round.location.position}
          connectors={connectors}
          ariaLabel={`מפה עם התוצאות של ${round.location.name}`}
        />
      </div>

      <div className={styles.infoPane}>
        <motion.div
          key={`title-${round.index}`}
          className={styles.header}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className={styles.roundBadge}>סיבוב {round.index + 1}</span>
          <h2 className={styles.locationName}>{round.location.name}</h2>
          {round.location.fact ? <p className={styles.fact}>{round.location.fact}</p> : null}
        </motion.div>

        <AnimatePresence mode="wait">
          {stage === 'guesses' ? (
            <motion.div
              key={`list-${round.index}`}
              className={styles.list}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {closest ? (
                <motion.div
                  className={styles.closest}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 240, damping: 16 }}
                >
                  <span className={styles.closestLabel}>הכי קרוב</span>
                  <AvatarBadge avatar={playersById.get(closest.playerId)?.avatar ?? { emoji: '🎯', hue: 160 }} size={32} />
                  <span className={styles.closestName}>
                    {playersById.get(closest.playerId)?.name ?? 'שחקן'}
                  </span>
                  <span className={`${styles.closestDistance} tabular`}>
                    {formatDistance(closest.distanceKm!)}
                  </span>
                </motion.div>
              ) : null}

              <ul className={styles.rows}>
                {answered.slice(0, maxListed).map((guess, index) => {
                  const player = playersById.get(guess.playerId);
                  const tier = accuracyTier(guess.distanceKm!);

                  return (
                    <motion.li
                      key={guess.playerId}
                      className={`${styles.row} ${guess.playerId === highlightPlayerId ? styles.rowMe : ''}`}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.08, duration: 0.3 }}
                    >
                      <span className={`${styles.position} tabular`}>{index + 1}</span>
                      {player ? <AvatarBadge avatar={player.avatar} size={26} /> : null}
                      <span className={styles.rowName}>{player?.name ?? 'שחקן'}</span>
                      <span className={`${styles.tier} ${styles[`tier_${tier}`]}`}>{ACCURACY_LABELS[tier]}</span>
                      <span className={`${styles.distance} tabular`}>{formatDistance(guess.distanceKm!)}</span>
                      <span className={`${styles.points} tabular`}>+{guess.points.toLocaleString('he-IL')}</span>
                    </motion.li>
                  );
                })}
              </ul>

              {answered.length > maxListed ? (
                <p className={styles.more}>ועוד {answered.length - maxListed} שחקנים…</p>
              ) : null}

              {missing > 0 ? <p className={styles.missing}>{missing} לא הספיקו לסמן</p> : null}
            </motion.div>
          ) : (
            <motion.p
              key={`waiting-${round.index}`}
              className={styles.waiting}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {stage === 'question' ? 'איפה זה בכלל?' : 'הנה המיקום האמיתי…'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
