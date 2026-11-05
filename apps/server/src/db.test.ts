import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";

const databaseUrl = process.env.TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
  "fresh database initializes twice without losing existing data",
  async () => {
    const admin = new SQL(databaseUrl!);
    const schema = `startup_${randomUUID().replaceAll("-", "")}`;
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    try {
      const url = new URL(databaseUrl!);
      url.searchParams.set("options", `-csearch_path=${schema}`);
      const start = async () => {
        const child = Bun.spawn(
          [
            process.execPath,
            "-e",
            'const {initDb}=await import("./apps/server/src/db.ts");await initDb();process.exit(0);',
          ],
          {
            cwd: fileURLToPath(new URL("../../..", import.meta.url)),
            env: { ...process.env, DATABASE_URL: url.toString() },
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        const error = await new Response(child.stderr).text();
        const code = await child.exited;
        expect(error).not.toContain("role_id does not exist");
        if (code !== 0) throw new Error(`Database startup failed: ${error}`);
      };
      await start();
      await admin.unsafe(
        `INSERT INTO ${schema}.users (name,email) VALUES ('Preserved user','preserved@example.test')`,
      );
      await admin.unsafe(
        `INSERT INTO ${schema}.roles (name,permissions) VALUES ('Legacy role','["posts:read"]')`,
      );
      await admin.unsafe(
        `UPDATE ${schema}.users SET role_id=(SELECT id FROM ${schema}.roles WHERE name='Legacy role')`,
      );
      await admin.unsafe(
        `ALTER TABLE ${schema}.api_keys DROP COLUMN permissions, DROP COLUMN last_modified_at`,
      );
      await admin.unsafe(
        `INSERT INTO ${schema}.api_keys (user_id,name,key_hash,prefix) SELECT id,'Preserved key','test-hash','test-prefix' FROM ${schema}.users`,
      );
      await start();
      const keys = await admin.unsafe(
        `SELECT permissions,last_modified_at,created_at FROM ${schema}.api_keys`,
      );
      expect(keys[0]?.permissions).toBe('["posts:read"]');
      expect(keys[0]?.last_modified_at).toBe(keys[0]?.created_at);
      const users = await admin.unsafe(`SELECT name FROM ${schema}.users`);
      expect(users[0]?.name).toBe("Preserved user");
      const columns =
        await admin`SELECT column_name FROM information_schema.columns WHERE table_schema=${schema} AND table_name='users' AND column_name='role_id'`;
      expect(columns.length).toBe(1);
    } finally {
      await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
