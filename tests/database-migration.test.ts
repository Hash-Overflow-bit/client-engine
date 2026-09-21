import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260918223912_client_acquisition_database.sql",
);
const discoveryMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260919125514_apollo_discovery_slots.sql",
);
const contractPath = resolve(process.cwd(), "supabase/tests/database_contracts.sql");
const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");

const authBoundary = `
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid()
  returns uuid
  language sql
  stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  grant usage on schema auth to anon, authenticated, service_role;
  grant select on auth.users to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

describe("database migration", () => {
  it("applies and passes the database contract on PostgreSQL-compatible runtime", async () => {
    const db = new PGlite();
    try {
      await db.waitReady;
      await db.exec(authBoundary);
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(await readFile(discoveryMigrationPath, "utf8"));
      await db.exec(await readFile(contractPath, "utf8"));

      const result = await db.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])
         order by table_name`,
        [[
          "leads",
          "companies",
          "campaigns",
          "messages",
          "activities",
          "meetings",
          "deals",
          "suppression_list",
          "integration_events",
          "ai_runs",
        ]],
      );

      expect(result.rows).toHaveLength(10);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("applies the complete chronological migration chain from an empty database", async () => {
    const db = new PGlite();
    try {
      await db.waitReady;
      await db.exec(authBoundary);
      const migrationNames = (await readdir(migrationsDirectory))
        .filter((name) => /^\d{14}_.+\.sql$/.test(name))
        .sort();
      expect(migrationNames).toContain("20260919215000_outreach_drafts_workspace_key.sql");
      expect(new Set(migrationNames).size).toBe(migrationNames.length);
      for (const name of migrationNames) await db.exec(await readFile(resolve(migrationsDirectory, name), "utf8"));

      const result = await db.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])
         order by table_name`,
        [["follow_up_tasks", "follow_up_drafts", "meeting_briefs", "meeting_discovery_outcomes", "proposals", "delivery_records", "conversations", "deals"]],
      );
      expect(result.rows.map((row) => row.table_name)).toEqual([
        "conversations",
        "deals",
        "delivery_records",
        "follow_up_drafts",
        "follow_up_tasks",
        "meeting_briefs",
        "meeting_discovery_outcomes",
        "proposals",
      ]);
    } finally {
      await db.close();
    }
  }, 60_000);
});
