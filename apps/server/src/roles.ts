import { PERMISSIONS, type Permission } from "@usercue/shared";
import { db } from "./db";

const OWNER_PERMS = PERMISSIONS.slice();
const STAFF_PERMS = [
  "dashboard",
  "manage_posts",
  "manage_boards",
  "manage_tasks",
] satisfies Permission[];

const insertRole = db.query<{ id: number }>(
  "INSERT INTO roles (name, key, locked, permissions) VALUES (?, ?, ?, ?) RETURNING id",
);
const findRoleByKey = db.query<{ id: number }>("SELECT id FROM roles WHERE key = ?");

interface UserRoleRow {
  id: number;
  role_id: number | null;
  permissions: string | null;
}

const unassigned = db.query<{ id: number }>(
  "SELECT id FROM users WHERE role_id IS NULL ORDER BY id",
);
const setRole = db.query("UPDATE users SET role_id = ? WHERE id = ?");
const usersWithRoles = db.query<UserRoleRow>(
  `SELECT u.id, u.role_id, r.permissions
   FROM users u
   LEFT JOIN roles r ON r.id = u.role_id`,
);

interface IdentityRow {
  visitor_id: string;
  provider: string;
  subject: string;
  name: string;
  email: string | null;
}

const listIdentities = db.query<IdentityRow>(
  "SELECT visitor_id, provider, subject, name, email FROM identities",
);
const findUserByEmail = db.query<{ id: number }>("SELECT id FROM users WHERE email = ?");
const insertMember = db.query<{ id: number }>(
  "INSERT INTO users (email, name, password_hash, role_id) VALUES (?, ?, '', ?) RETURNING id",
);
const insertOAuthAccount = db.query(
  "INSERT INTO oauth_accounts (provider, subject, user_id) VALUES (?, ?, ?) ON CONFLICT (provider, subject) DO NOTHING",
);

export function parsePermissions(raw: string | null | undefined): Permission[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Permission => PERMISSIONS.includes(item as Permission));
  } catch {
    return [];
  }
}

export function encodePermissions(permissions: Permission[]): string {
  return JSON.stringify(PERMISSIONS.filter((p) => permissions.includes(p)));
}

export function hasPermission(
  permissions: Permission[] | null | undefined,
  permission: Permission,
): boolean {
  return Boolean(permissions?.includes(permission));
}

async function ensureRole(
  name: string,
  key: string,
  locked: number,
  permissions: Permission[],
): Promise<number> {
  const existing = await findRoleByKey.get(key);
  if (existing) return existing.id;
  const row = await insertRole.get(name, key, locked, encodePermissions(permissions));
  if (!row) throw new Error(`Could not create the ${name} role`);
  return row.id;
}

export async function ownerRoleId(): Promise<number> {
  return ensureRole("Owner", "owner", 1, OWNER_PERMS);
}

export async function staffRoleId(): Promise<number> {
  return ensureRole("Staff", "staff", 0, STAFF_PERMS);
}

export async function memberRoleId(): Promise<number> {
  return ensureRole("Member", "member", 0, []);
}

export async function isOwnerRole(roleId: number | null | undefined): Promise<boolean> {
  return roleId === (await ownerRoleId());
}

export async function countWithPermission(permission: Permission): Promise<number> {
  const rows = await usersWithRoles.all();
  return rows.filter((row) => parsePermissions(row.permissions).includes(permission)).length;
}

export async function countOwners(): Promise<number> {
  const owner = await ownerRoleId();
  return (await usersWithRoles.all()).filter((row) => row.role_id === owner).length;
}

async function hasAnyOwner(): Promise<boolean> {
  return (await countOwners()) > 0;
}

async function migrateIdentities() {
  const member = await memberRoleId();
  for (const row of await listIdentities.all()) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    let user = await findUserByEmail.get(email);
    if (!user) {
      user = await insertMember.get(email, row.name || email, member);
    }
    if (user) await insertOAuthAccount.run(row.provider, row.subject, user.id);
  }
}

export async function initRoles() {
  const owner = await ownerRoleId();
  const staff = await staffRoleId();
  await memberRoleId();

  const pending = await unassigned.all();
  if (pending.length) {
    const ownerExists = await hasAnyOwner();
    for (const [i, row] of pending.entries()) {
      await setRole.run(i === 0 && !ownerExists ? owner : staff, row.id);
    }
  }

  await migrateIdentities();
}
