/**
 * מסך הפתיחה.
 *
 * שתי דרכי כניסה בלבד — לארח או להצטרף — כי כל בחירה נוספת בשלב
 * הזה רק מאטה את המשתמש. הזנת קוד ידנית זמינה למי שאין לו QR.
 */

import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { GAME_CODE_LENGTH, isValidGameCode, normalizeGameCode } from '@mapat/shared';

import { Button } from '../components/ui/Button';
import { IsraelMap } from '../components/map/IsraelMap';
import { paths, useRouter } from '../router';
import styles from './Landing.module.css';

export function Landing(): JSX.Element {
  const { navigate } = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitCode = (event: FormEvent) => {
    event.preventDefault();

    const normalized = normalizeGameCode(code);
    if (!isValidGameCode(normalized)) {
      setError(`קוד המשחק מורכב מ-${GAME_CODE_LENGTH} תווים`);
      return;
    }

    navigate(paths.join(normalized));
  };

  return (
    <main className={styles.page}>
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.content}>
          <span className={styles.eyebrow}>משחק ניחוש מיקומים</span>
          <h1 className={styles.title}>
            כמה טוב אתם מכירים
            <br />
            <span className={styles.titleAccent}>את מפת ישראל?</span>
          </h1>
          <p className={styles.subtitle}>
            מקבלים שם של עיר או אתר, מסמנים על המפה תוך 5 שניות, וצוברים נקודות לפי המרחק
            מהמיקום האמיתי. ככל שקרוב יותר — כך יותר נקודות.
          </p>

          <div className={styles.actions}>
            <Button size="lg" icon="🎬" onClick={() => navigate(paths.host())}>
              יצירת משחק חדש
            </Button>
          </div>

          <form className={styles.joinForm} onSubmit={submitCode}>
            <label className={styles.joinLabel} htmlFor="game-code">
              יש לכם קוד משחק?
            </label>
            <div className={styles.joinRow}>
              <input
                id="game-code"
                className={`${styles.codeInput} tabular`}
                value={code}
                onChange={(event) => {
                  setCode(normalizeGameCode(event.target.value));
                  setError(null);
                }}
                placeholder="ABCDE"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={GAME_CODE_LENGTH}
                dir="ltr"
                aria-invalid={error !== null}
              />
              <Button type="submit" variant="secondary" size="lg">
                הצטרפות
              </Button>
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>

        <div className={styles.mapPreview} aria-hidden="true">
          <IsraelMap ariaLabel="תצוגה מקדימה של מפת ישראל" />
        </div>
      </motion.div>

      <section className={styles.features}>
        {[
          { icon: '📱', title: 'הצטרפות בסריקה', text: 'סורקים QR, מזינים שם, ומשחקים. בלי התקנה ובלי הרשמה.' },
          { icon: '🎯', title: 'ניקוד לפי דיוק', text: 'הניקוד רציף — כל קילומטר קובע, ואין תשובה "נכונה" יחידה.' },
          { icon: '🏆', title: 'סיכום מלא', text: 'בסוף המשחק: כל הניחושים על המפה, טבלת דירוג ופודיום.' },
        ].map((feature) => (
          <div key={feature.title} className={styles.feature}>
            <span className={styles.featureIcon} aria-hidden="true">
              {feature.icon}
            </span>
            <h2 className={styles.featureTitle}>{feature.title}</h2>
            <p className={styles.featureText}>{feature.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
