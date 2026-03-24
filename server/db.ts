import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

function isUsableDatabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) return false;
    if (!parsed.hostname) return false;
    if (parsed.hostname.toLowerCase() === "base") return false;
    if (value.includes("[YOUR-PASSWORD]")) return false;
    return true;
  } catch {
    return false;
  }
}

function buildUrlFromPgParts(): string | null {
  const host = process.env.PGHOST;
  const port = process.env.PGPORT;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;

  if (!host || !port || !user || !password || !database) {
    return null;
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const sslMode = (process.env.PGSSLMODE || "require").toLowerCase();
  const sslQuery = sslMode ? `?sslmode=${encodeURIComponent(sslMode)}` : "";
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}${sslQuery}`;
}

export function resolveDatabaseUrl(): string {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DATABASE_PRIVATE_URL,
    process.env.DATABASE_PUBLIC_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRIVATE_URL,
    process.env.POSTGRES_PUBLIC_URL,
    buildUrlFromPgParts(),
  ].filter((value): value is string => !!value && value.trim().length > 0);

  const usable = candidates.find(isUsableDatabaseUrl);
  if (usable) return usable;

  const attempted = candidates.length > 0 ? candidates.join(" | ") : "(none)";
  throw new Error(
    `No valid PostgreSQL connection string found. Checked DATABASE_URL, DATABASE_PRIVATE_URL, DATABASE_PUBLIC_URL, POSTGRES_URL, POSTGRES_PRIVATE_URL, POSTGRES_PUBLIC_URL, PG* vars. Attempted: ${attempted}`,
  );
}

export function buildPgConnectionConfig(connectionString = resolveDatabaseUrl()): pg.PoolConfig {
  let sslMode = "";
  try {
    const parsed = new URL(connectionString);
    sslMode = (parsed.searchParams.get("sslmode") || "").toLowerCase();
  } catch {
    // Keep default behavior if parsing fails
  }

  if (sslMode === "no-verify") {
    return {
      connectionString,
      ssl: { rejectUnauthorized: false },
    };
  }

  return { connectionString };
}

export const databaseUrl = resolveDatabaseUrl();

const pool = new pg.Pool({
  ...buildPgConnectionConfig(databaseUrl),
});

export const db = drizzle(pool, { schema });

/**
 * Ensures all schema additions exist in the database.
 * Safe to run multiple times (all statements are IF NOT EXISTS / IF NOT FOUND).
 */
export async function ensureSchema() {
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // 1. venues table
    await client.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        state TEXT,
        timezone TEXT DEFAULT 'America/New_York',
        phone TEXT,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. mobile_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mobile_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. venue_datasets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS venue_datasets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
        source_type TEXT NOT NULL DEFAULT 'manual',
        data JSONB NOT NULL DEFAULT '[]',
        data_schema JSONB DEFAULT '{}',
        row_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Helper to add a column if it doesn't already exist
    const addColumnIfMissing = async (table: string, column: string, definition: string) => {
      const check = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
        [table, column]
      );
      if (check.rowCount === 0) {
        await client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`Added column ${table}.${column}`);
      }
    };

    // 4. users.active_venue_id
    await addColumnIfMissing("users", "active_venue_id", "INTEGER REFERENCES venues(id)");

    // 5. conversations: organization_id, venue_id
    await addColumnIfMissing("conversations", "organization_id", "INTEGER REFERENCES organizations(id)");
    await addColumnIfMissing("conversations", "venue_id", "INTEGER REFERENCES venues(id) ON DELETE CASCADE");

    // 6. Square integration columns on organizations
    await addColumnIfMissing("organizations", "square_access_token", "TEXT");
    await addColumnIfMissing("organizations", "square_refresh_token", "TEXT");
    await addColumnIfMissing("organizations", "square_merchant_id", "TEXT");
    await addColumnIfMissing("organizations", "square_location_id", "TEXT");
    await addColumnIfMissing("organizations", "square_token_expires_at", "TIMESTAMP");
    await addColumnIfMissing("organizations", "square_environment", "TEXT DEFAULT 'production'");

    // 7. Operational tables: add venue_id where missing
    const venueIdTables = [
      "menu_items", "inventory_items", "orders", "tabs", "bookings",
      "staff_members", "staff_shifts", "guests", "tasks", "waste_logs"
    ];
    for (const table of venueIdTables) {
      await addColumnIfMissing(table, "venue_id", "INTEGER REFERENCES venues(id) ON DELETE CASCADE");
    }

    await client.query("COMMIT");
    console.log("Schema migration check complete");
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors when connection is unavailable
      }
    }
    console.error("Schema migration error:", err);
  } finally {
    client?.release();
  }
}
