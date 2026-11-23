import type { PoolClient } from 'pg';
import { pool } from './pool.js';

interface Migration {
  id: number;
  name: string;
  sql: string;
}

// append only. each migration runs once, inside a transaction, and is recorded in schema_migrations
export const migrations: Migration[] = [
  {
    id: 1,
    name: 'baseline',
    // matches the schema the app had before versioned migrations, so existing
    // databases and fresh ones end up in the same place
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        clerk_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        age INTEGER,
        experience TEXT,
        goal TEXT,
        role TEXT DEFAULT 'patient',
        doctor_id TEXT,
        care_plan TEXT,
        password_hash TEXT,
        approved BOOLEAN NOT NULL DEFAULT TRUE
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'patient';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS doctor_id TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS care_plan TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        clerk_id TEXT REFERENCES users(clerk_id) ON DELETE CASCADE,
        pose_id TEXT NOT NULL,
        pose_name TEXT NOT NULL,
        date BIGINT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        hold_time_seconds INTEGER NOT NULL,
        average_score INTEGER NOT NULL,
        grade TEXT NOT NULL,
        ai_critique TEXT,
        frame_logs TEXT
      );
    `,
  },
  {
    id: 2,
    name: 'user_id_jsonb_indexes_async_critique',
    sql: `
      -- clerk_id is left over from when auth used Clerk
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'clerk_id') THEN
          ALTER TABLE users RENAME COLUMN clerk_id TO user_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'sessions' AND column_name = 'clerk_id') THEN
          ALTER TABLE sessions RENAME COLUMN clerk_id TO user_id;
        END IF;
      END $$;

      -- json stored as text becomes jsonb. anything that doesn't parse falls back instead of failing the migration
      CREATE OR REPLACE FUNCTION pg_temp.safe_jsonb(value TEXT, fallback JSONB) RETURNS JSONB AS $$
      BEGIN
        RETURN value::jsonb;
      EXCEPTION WHEN others THEN
        RETURN fallback;
      END;
      $$ LANGUAGE plpgsql;

      ALTER TABLE sessions ALTER COLUMN frame_logs TYPE JSONB USING pg_temp.safe_jsonb(frame_logs, '[]'::jsonb);
      UPDATE sessions SET frame_logs = '[]'::jsonb WHERE frame_logs IS NULL;
      ALTER TABLE sessions ALTER COLUMN frame_logs SET DEFAULT '[]'::jsonb;
      ALTER TABLE sessions ALTER COLUMN frame_logs SET NOT NULL;

      ALTER TABLE users ALTER COLUMN care_plan TYPE JSONB USING pg_temp.safe_jsonb(care_plan, NULL);
      DROP FUNCTION pg_temp.safe_jsonb(TEXT, JSONB);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
      UPDATE users SET role = 'patient' WHERE role IS NULL;
      ALTER TABLE users ALTER COLUMN role SET NOT NULL;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'doctor', 'admin'));

      -- critiques are generated in the background now, so track where each one is
      ALTER TABLE sessions ADD COLUMN critique_status TEXT NOT NULL DEFAULT 'ready'
        CHECK (critique_status IN ('pending', 'ready', 'failed'));
      ALTER TABLE sessions ADD COLUMN critique_attempts INTEGER NOT NULL DEFAULT 0;

      CREATE INDEX IF NOT EXISTS sessions_user_date_idx ON sessions (user_id, date DESC);
      CREATE INDEX IF NOT EXISTS sessions_pending_critique_idx ON sessions (critique_status) WHERE critique_status = 'pending';
      CREATE INDEX IF NOT EXISTS users_doctor_idx ON users (doctor_id) WHERE doctor_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));
    `,
  },
  {
    id: 3,
    name: 'neck_assessments_exercises_sessions',
    sql: `
      CREATE TABLE IF NOT EXISTS neck_exercises (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        video_url TEXT,
        instructions TEXT NOT NULL DEFAULT '',
        active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO neck_exercises (id, title, description, instructions, active)
      VALUES ('neck-rotation', 'Gentle Neck Rotation',
              'A camera-supported head-turning exercise, only with clinician approval.',
              'Sit upright, face the camera, and rotate gently without forcing range. Stop if symptoms appear.', FALSE)
      ON CONFLICT (id) DO NOTHING;
      CREATE TABLE IF NOT EXISTS neck_assessments (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        answers JSONB NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('review', 'eligible')),
        exercise_id TEXT REFERENCES neck_exercises(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS neck_assessments_user_idx ON neck_assessments(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS neck_tracking_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL REFERENCES neck_exercises(id),
        assessment_id BIGINT REFERENCES neck_assessments(id),
        duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 0 AND 7200),
        left_turns INTEGER NOT NULL DEFAULT 0,
        right_turns INTEGER NOT NULL DEFAULT 0,
        tracking_quality TEXT NOT NULL,
        notes JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS neck_tracking_user_idx ON neck_tracking_sessions(user_id, created_at DESC);
    `,
  },
  {
    id: 4,
    name: 'ndi_multiexercise_library',
    sql: `
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'head_rotation';
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS rule_approved BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS rule_priority INTEGER NOT NULL DEFAULT 100;
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS min_ndi INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS max_ndi INTEGER NOT NULL DEFAULT 100;
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS exercise_group TEXT NOT NULL DEFAULT 'neck_rotation';
      INSERT INTO neck_exercises (id,title,description,video_url,instructions,active,tracking_mode,exercise_group)
      VALUES
        ('deep-flexor-1','Deep cervical flexor — introduction','Deep cervical flexor training, initial progression.','https://youtube.com/shorts/v9vK-ORuvKo','Follow only the clinician-prescribed progression; stop if symptoms worsen.',FALSE,'chin_tuck','deep_flexor'),
        ('deep-flexor-2','Deep cervical flexor — progression','Deep cervical flexor training, advanced progression.','https://youtube.com/shorts/w-W0kOcff4k','Follow only the clinician-prescribed progression; stop if symptoms worsen.',FALSE,'chin_tuck','deep_flexor'),
        ('cervical-isometric','Cervical isometric exercises','Isometric neck-muscle activation demonstrated by clinician.','https://youtube.com/shorts/yIFJ-AcqZiY','Webcam cannot verify muscle force or resistance; follow clinician instructions.',FALSE,'head_stability','isometric'),
        ('laser-proprioception','Cervical proprioception — laser','Laser biofeedback proprioceptive rehabilitation.','https://youtu.be/tbySm4GaEdU','Requires suitable laser equipment and clinician supervision; webcam does not validate laser accuracy.',FALSE,'head_tracking','proprioception'),
        ('neutral-head-1','Neutral head position — 1','Training neutral head posture.','https://youtu.be/8vZMcVPOUac','Use camera feedback for approximate head position only.',FALSE,'head_stability','neutral_head'),
        ('neutral-head-2','Neutral head position — 2','Neutral head position progression.','https://youtu.be/tp9CIPSOYDc','Use camera feedback for approximate head position only.',FALSE,'head_stability','neutral_head'),
        ('tracking-1','Head tracking — introduction','Head tracking training, initial progression.','https://youtu.be/4hzD6GBqwuo','Follow the clinician-led target slowly; screen motion is not a validated accuracy measurement.',FALSE,'head_tracking','tracking'),
        ('tracking-2','Head tracking — progression','Head tracking training, advanced progression.','https://youtu.be/tHFqnUePJCo','Follow the clinician-led target slowly; screen motion is not a validated accuracy measurement.',FALSE,'head_tracking','tracking')
      ON CONFLICT (id) DO NOTHING;
      UPDATE neck_exercises SET tracking_mode='head_rotation',exercise_group='neck_rotation' WHERE id='neck-rotation';
    `,
  },

  {
    id: 5,
    name: 'enable_supplied_neck_video_library',
    sql: `
      -- Activate the eight videos supplied for the demo. This runs once.
      -- Individual exercises can still be disabled in the doctor dashboard.
      UPDATE neck_exercises SET active = TRUE
      WHERE id IN ('deep-flexor-1','deep-flexor-2','cervical-isometric',
                   'laser-proprioception','neutral-head-1','neutral-head-2',
                   'tracking-1','tracking-2') AND video_url IS NOT NULL;
    `,
  },

  {
    id: 6,
    name: 'exercise_dosage_and_remove_neutral_head',
    sql: `
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS plan_reps INTEGER DEFAULT NULL;
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS plan_sets INTEGER DEFAULT NULL;
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS plan_hold_seconds INTEGER DEFAULT NULL;
      ALTER TABLE neck_exercises ADD COLUMN IF NOT EXISTS plan_rest_seconds INTEGER DEFAULT NULL;
      DELETE FROM neck_exercises WHERE id IN ('neutral-head-1', 'neutral-head-2');
    `,
  },

  {
    id: 7,
    name: 'update_tracking_videos_and_neutral_head',
    sql: `
      -- tracking-1: new video
      UPDATE neck_exercises SET
        video_url = 'https://youtu.be/fhpCwZ3EL-c?si=lfibfmAEJM7SlO_H'
      WHERE id = 'tracking-1';

      -- tracking-2: rename to neutral head + new video + change mode
      UPDATE neck_exercises SET
        title = 'Cervical Neutral Head Training — Progression 2',
        description = 'Neutral head training progression resource for cervical rehabilitation.',
        video_url = 'https://youtu.be/8vZMcVPOUac?si=z89jisdiZJvVrGTL',
        tracking_mode = 'head_stability',
        exercise_group = 'neutral_head'
      WHERE id = 'tracking-2';
    `,
  },

  {
    id: 8,
    name: 'whitelist_active_patient_accounts_and_cleanup_placeholders',
    sql: `
      DELETE FROM deleted_users WHERE LOWER(email) IN (
        'yaqeen@gmail.com',
        'layla@example.com',
        'yasmin@example.com',
        'alzahraa@example.com',
        'ali@example.com',
        'saraayman@gmail.com'
      );

      -- Remove demo placeholders so patients can Sign Up themselves with their own passwords without 'Email already registered' error
      DELETE FROM sessions WHERE user_id IN ('usr_demo_yaqeen', 'usr_demo_layla', 'usr_demo_aseel', 'usr_demo_yasmin', 'usr_demo_ali', 'usr_demo_sara');
      DELETE FROM users WHERE user_id IN ('usr_demo_yaqeen', 'usr_demo_layla', 'usr_demo_aseel', 'usr_demo_yasmin', 'usr_demo_ali', 'usr_demo_sara');
    `,
  },

  {
    id: 9,
    name: 'permanently_delete_aseel_accounts',
    sql: `
      -- Delete any sessions associated with Aseel accounts or name
      DELETE FROM sessions WHERE user_id IN (
        SELECT user_id FROM users WHERE LOWER(email) IN ('aseelaziz@gmail.com', 'aseelmohammed@gmail.com', 'aseel.aziz@patient.example') OR name LIKE '%اسيل%' OR name LIKE '%Aseel%'
      ) OR user_id = 'usr_demo_aseel';

      -- Delete any user accounts for Aseel
      DELETE FROM users WHERE LOWER(email) IN ('aseelaziz@gmail.com', 'aseelmohammed@gmail.com', 'aseel.aziz@patient.example') OR name LIKE '%اسيل%' OR name LIKE '%Aseel%' OR user_id = 'usr_demo_aseel';

      -- Add to deleted_users to permanently prevent seeding or auto-recreation
      CREATE TABLE IF NOT EXISTS deleted_users (email TEXT PRIMARY KEY, deleted_at TIMESTAMPTZ DEFAULT now());
      INSERT INTO deleted_users (email) VALUES
        ('aseelaziz@gmail.com'),
        ('aseelmohammed@gmail.com'),
        ('aseel.aziz@patient.example')
      ON CONFLICT (email) DO NOTHING;
    `,
  },
];

// arbitrary constant, stops two server instances migrating at the same time
const MIGRATION_LOCK_ID = 7426211;

export async function migrate(): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ id: number }>('SELECT id FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.id));

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [migration.id, migration.name]);
        await client.query('COMMIT');
        console.log(`[db] Applied migration ${migration.id}_${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${migration.id}_${migration.name} failed: ${(error as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}
