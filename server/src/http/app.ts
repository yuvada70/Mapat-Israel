/**
 * שכבת ה-HTTP: הגשת אפליקציית הלקוח, בדיקות תקינות ומדדים.
 *
 * השרת מגיש גם את הלקוח וגם את ה-WebSocket מאותו מקור. זו החלטה
 * מכוונת: אין בעיות CORS, קישור ההצטרפות תמיד תקף, והפריסה היא
 * שירות אחד במקום שניים.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import compression from 'compression';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';

import type { ServerConfig } from '../config.js';
import { logger } from '../logger.js';

/** מידע שהשרת חושף לצורך ניטור. */
export interface HealthProvider {
  activeRooms(): number;
}

/** בונה את אפליקציית ה-Express. */
export function createApp(config: ServerConfig, health: HealthProvider): Express {
  const app = express();

  if (config.trustProxy) app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // הלקוח נבנה עם Vite ומזריק סגנונות בזמן ריצה (אנימציות).
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'"],
          // WebSocket לאותו מקור.
          connectSrc: ["'self'", 'ws:', 'wss:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      // נדרש כדי לאפשר הורדת קובץ התוצאות מהדפדפן.
      crossOriginResourcePolicy: { policy: 'same-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  /** בדיקת תקינות לשירותי תשתית (load balancer, Kubernetes). */
  app.get('/healthz', (_request: Request, response: Response) => {
    response.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      activeRooms: health.activeRooms(),
      version: process.env['npm_package_version'] ?? '1.0.0',
    });
  });

  if (config.serveClient) {
    const clientDir = path.resolve(process.cwd(), config.clientDir);

    if (!existsSync(clientDir)) {
      logger.warn('client.dist_missing', {
        clientDir,
        hint: 'הריצו npm run build כדי לבנות את הלקוח, או הגדירו SERVE_CLIENT=false בפיתוח',
      });
    } else {
      // קבצי הנכסים מקבלים שם ייחודי (hash) מ-Vite ולכן ניתן לשמור אותם לנצח.
      app.use(
        '/assets',
        express.static(path.join(clientDir, 'assets'), {
          immutable: true,
          maxAge: '1y',
        }),
      );
      app.use(express.static(clientDir, { index: false, maxAge: '1h' }));

      // כל נתיב אחר מוגש כ-SPA: /host, /join/ABCDE וכן הלאה.
      app.get('*', (_request: Request, response: Response) => {
        response.sendFile(path.join(clientDir, 'index.html'));
      });
    }
  }

  return app;
}
