/**
 * יצירת משחק חדש.
 *
 * ברירות המחדל מכוונות ל"התחל ולך" — 15 שאלות, 5 שניות לכל אחת —
 * וכל ההגדרות מקופלות מאחורי מתג אחד, כדי שמנהל שרוצה פשוט להתחיל
 * לא ייתקל בטופס.
 */

import { useState } from 'react';
import { DEFAULT_SETTINGS, listPacks, type GameSettings } from '@mapat/shared';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/misc';
import { useGameStore } from '../../state/gameStore';
import { paths, useRouter } from '../../router';
import styles from './HostSetup.module.css';

/** אפשרויות משך סיבוב, בשניות. */
const DURATION_OPTIONS = [3, 5, 8, 10, 15] as const;

/** אפשרויות מספר שאלות. */
const ROUND_OPTIONS = [5, 10, 15] as const;

export function HostSetup(): JSX.Element {
  const createGame = useGameStore((store) => store.createGame);
  const { navigate } = useRouter();

  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const packs = listPacks();
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const handleCreate = async () => {
    setCreating(true);
    await createGame(settings);
    setCreating(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(paths.landing())}>
          ← חזרה
        </button>
        <h1 className={styles.title}>משחק חדש</h1>
        <p className={styles.subtitle}>הגדירו את המשחק, ואז שתפו את הקוד עם המשתתפים.</p>
      </header>

      <Card className={styles.card}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>קטגוריה</h2>
          <div className={styles.packs}>
            {packs.map((pack) => (
              <button
                key={pack.id}
                className={`${styles.pack} ${settings.packId === pack.id ? styles.packActive : ''}`}
                onClick={() => update('packId', pack.id)}
                aria-pressed={settings.packId === pack.id}
              >
                <span className={styles.packName}>{pack.name}</span>
                <span className={styles.packDescription}>{pack.description}</span>
                <span className={styles.packCount}>{pack.locations.length} מיקומים</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>מספר שאלות</h2>
          <div className={styles.chips}>
            {ROUND_OPTIONS.map((count) => (
              <button
                key={count}
                className={`${styles.chip} ${settings.roundCount === count ? styles.chipActive : ''}`}
                onClick={() => update('roundCount', count)}
                aria-pressed={settings.roundCount === count}
              >
                {count}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>זמן לכל שאלה</h2>
          <div className={styles.chips}>
            {DURATION_OPTIONS.map((seconds) => (
              <button
                key={seconds}
                className={`${styles.chip} ${settings.roundDurationMs === seconds * 1_000 ? styles.chipActive : ''}`}
                onClick={() => update('roundDurationMs', seconds * 1_000)}
                aria-pressed={settings.roundDurationMs === seconds * 1_000}
              >
                {seconds} שנ׳
              </button>
            ))}
          </div>
        </section>

        <button
          className={styles.advancedToggle}
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? '▾' : '◂'} הגדרות מתקדמות
        </button>

        {advancedOpen ? (
          <section className={styles.advanced}>
            <Toggle
              label="ערבוב סדר השאלות"
              description="כל משחק בסדר אחר — מונע יתרון למי שכבר שיחק"
              checked={settings.shuffleQuestions}
              onChange={(value) => update('shuffleQuestions', value)}
            />
            <Toggle
              label="הצגת מיקום בדירוג לשחקנים"
              description="השחקן רואה את מקומו היחסי, בלי לחשוף מרחקים"
              checked={settings.showLiveRank}
              onChange={(value) => update('showLiveRank', value)}
            />
            <Toggle
              label="בונוס מהירות"
              description="עד 10% תוספת למי שמסמן מוקדם — הדיוק עדיין קובע"
              checked={settings.speedBonus}
              onChange={(value) => update('speedBonus', value)}
            />
          </section>
        ) : null}
      </Card>

      <Button size="lg" block loading={creating} onClick={handleCreate} icon="🚀">
        יצירת משחק
      </Button>
    </div>
  );
}

/** מתג הפעלה/כיבוי עם תיאור. */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        className={styles.toggleInput}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.toggleTrack} aria-hidden="true">
        <span className={styles.toggleThumb} />
      </span>
      <span className={styles.toggleText}>
        <span className={styles.toggleLabel}>{label}</span>
        <span className={styles.toggleDescription}>{description}</span>
      </span>
    </label>
  );
}
