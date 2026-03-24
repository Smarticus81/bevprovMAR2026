import { defineConfig } from "drizzle-kit";

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

  if (!host || !port || !user || !password || !database) return null;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=${encodeURIComponent(process.env.PGSSLMODE || "require")}`;
}

const databaseUrl = [
  process.env.DATABASE_URL,
  process.env.DATABASE_PRIVATE_URL,
  process.env.DATABASE_PUBLIC_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_PRIVATE_URL,
  process.env.POSTGRES_PUBLIC_URL,
  buildUrlFromPgParts(),
].filter((value): value is string => !!value && value.trim().length > 0).find(isUsableDatabaseUrl);

if (!databaseUrl) {
  throw new Error("No valid database URL found for drizzle-kit. Check DATABASE_URL/POSTGRES_URL/PG* variables.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
