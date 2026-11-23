/** Vercel Node.js Function: reuse the existing Express routes on the same origin. */
import type { Request, Response } from 'express';
import { createApp, readiness } from '../backend/src/app.js';
import { migrate } from '../backend/src/db/migrations.js';
import { approvePendingDoctorsIfEnabled, provisionClinicDoctor, provisionSuperAdmin } from '../backend/src/services/users.js';
import { seedDemoPatients } from '../backend/src/services/demoPatients.js';
import { hashPassword } from '../backend/src/services/passwords.js';

const app = createApp();
let initialized: Promise<void> | undefined;

async function initialize() {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
    throw new Error('Missing required server-side DATABASE_URL or AUTH_SECRET');
  }
  // The existing migration routine uses a PostgreSQL advisory lock, so
  // concurrent cold starts do not race when updating the database schema.
  await migrate();
  await provisionClinicDoctor(hashPassword);
  await provisionSuperAdmin(hashPassword);
  await approvePendingDoctorsIfEnabled();
  await seedDemoPatients();
  readiness.ready = true;
}

export default async function handler(req: Request, res: Response) {
  // A failed cold start may be retried on the next request.
  initialized ??= initialize().catch((err) => {
    initialized = undefined;
    readiness.ready = false;
    console.error('[api] Database initialization failed:', err);
    throw err;
  });
  try {
    await initialized;
    app(req, res);
  } catch {
    if (!res.headersSent) res.status(503).json({ error: 'Database is unavailable or API setup is incomplete' });
  }
}
