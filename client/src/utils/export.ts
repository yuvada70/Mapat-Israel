/**
 * ייצוא תוצאות המשחק.
 *
 * הייצוא נעשה כולו בדפדפן — הנתונים כבר נמצאים אצל הלקוח בסיום
 * המשחק, ולכן אין צורך בקריאת שרת ואין העברה נוספת של מידע.
 *
 * CSV נכתב עם BOM של UTF-8, אחרת Excel בעברית מציג ג׳יבריש.
 */

import { formatDistance, type GameResults } from '@mapat/shared';

/** מגרש תו בודד לפי כללי CSV (RFC 4180). */
function escapeCsvValue(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** מוריד קובץ שנוצר בדפדפן. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // שחרור הזיכרון לאחר שהדפדפן הספיק להתחיל את ההורדה.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** שם קובץ בטוח הכולל את קוד המשחק ותאריך. */
function buildFileName(results: GameResults, extension: string): string {
  const date = new Date(results.finishedAt);
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  return `mapat-israel-${results.code}-${stamp}.${extension}`;
}

/**
 * מייצא את טבלת הדירוג ואת פירוט הסיבובים לקובץ CSV
 * (נפתח ישירות ב-Excel וב-Google Sheets).
 */
export function exportResultsToCsv(results: GameResults): void {
  const playersById = new Map(results.leaderboard.map((entry) => [entry.player.id, entry.player]));
  const lines: string[] = [];

  lines.push('טבלת דירוג');
  lines.push(['דירוג', 'שחקן', 'ניקוד', 'מרחק ממוצע (ק"מ)', 'בולי פגיעה', 'סיבובים שנענו'].map(escapeCsvValue).join(','));
  for (const entry of results.leaderboard) {
    lines.push(
      [
        entry.rank,
        entry.player.name,
        entry.totalPoints,
        entry.averageDistanceKm === null ? '' : entry.averageDistanceKm.toFixed(2),
        entry.bullseyes,
        entry.answeredRounds,
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  lines.push('');
  lines.push('פירוט סיבובים');
  lines.push(['סיבוב', 'מיקום', 'שחקן', 'מרחק (ק"מ)', 'נקודות', 'זמן תגובה (שניות)'].map(escapeCsvValue).join(','));

  for (const round of results.rounds) {
    for (const guess of round.guesses) {
      lines.push(
        [
          round.index + 1,
          round.location.name,
          playersById.get(guess.playerId)?.name ?? guess.playerId,
          guess.distanceKm === null ? 'לא ענה' : guess.distanceKm.toFixed(2),
          guess.points,
          guess.elapsedMs === null ? '' : (guess.elapsedMs / 1000).toFixed(2),
        ]
          .map(escapeCsvValue)
          .join(','),
      );
    }
  }

  downloadBlob(
    new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' }),
    buildFileName(results, 'csv'),
  );
}

/** מייצא את התוצאות הגולמיות כ-JSON, לשילוב במערכות אחרות. */
export function exportResultsToJson(results: GameResults): void {
  downloadBlob(
    new Blob([JSON.stringify(results, null, 2)], { type: 'application/json;charset=utf-8;' }),
    buildFileName(results, 'json'),
  );
}

/**
 * מכין סיכום טקסטואלי קצר לשיתוף (וואטסאפ, מייל).
 */
export function buildShareText(results: GameResults): string {
  const podium = results.leaderboard.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];

  const lines = [
    `🗺️ מפת ישראל — תוצאות משחק ${results.code}`,
    `${results.rounds.length} שאלות · ${results.leaderboard.length} משתתפים`,
    '',
    ...podium.map(
      (entry, index) =>
        `${medals[index]} ${entry.player.name} — ${entry.totalPoints.toLocaleString('he-IL')} נק׳` +
        (entry.averageDistanceKm !== null ? ` (ממוצע ${formatDistance(entry.averageDistanceKm)})` : ''),
    ),
  ];

  return lines.join('\n');
}

/**
 * משתף את התוצאות דרך ממשק השיתוף של המערכת, ואם אינו זמין —
 * מעתיק ללוח.
 * @returns 'shared' | 'copied' | 'failed'
 */
export async function shareResults(results: GameResults): Promise<'shared' | 'copied' | 'failed'> {
  const text = buildShareText(results);

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'מפת ישראל — תוצאות', text });
      return 'shared';
    } catch {
      // המשתמש ביטל, או שהשיתוף נכשל — ממשיכים להעתקה.
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
