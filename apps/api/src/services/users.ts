import argon2 from 'argon2';

import { config } from '../config.js';
import { db } from '../db/index.js';

export type Role = 'user' | 'admin';

export interface UserRecord {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
}

function emailDomainAllowed(email: string): boolean {
  if (config.allowedEmailDomains.length === 0) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return config.allowedEmailDomains.includes(domain);
}

function shouldBootstrapAdmin(email: string): boolean {
  return Boolean(config.bootstrapAdminEmail && config.bootstrapAdminEmail === email.toLowerCase());
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const row = await db
    .selectFrom('tb_users')
    .select(['id', 'email', 'display_name', 'avatar_url', 'role'])
    .where(({ fn }) => fn('lower', ['email']), '=', email.toLowerCase())
    .executeTakeFirst();
  return row ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const row = await db
    .selectFrom('tb_users')
    .select(['id', 'email', 'display_name', 'avatar_url', 'role'])
    .where('id', '=', id)
    .executeTakeFirst();
  return row ?? null;
}

export async function createPasswordUser(input: {
  email: string;
  password: string;
  displayName?: string | null;
}): Promise<UserRecord> {
  const email = input.email.trim().toLowerCase();
  if (!emailDomainAllowed(email)) {
    throw Object.assign(new Error('Email domain not allowed'), { statusCode: 403 });
  }
  const password_hash = await argon2.hash(input.password, { type: argon2.argon2id });
  const role: Role = shouldBootstrapAdmin(email) ? 'admin' : 'user';
  const row = await db
    .insertInto('tb_users')
    .values({
      email,
      password_hash,
      display_name: input.displayName ?? null,
      role,
    })
    .returning(['id', 'email', 'display_name', 'avatar_url', 'role'])
    .executeTakeFirstOrThrow();
  return row;
}

export async function verifyPassword(email: string, password: string): Promise<UserRecord | null> {
  const row = await db
    .selectFrom('tb_users')
    .select(['id', 'email', 'display_name', 'avatar_url', 'role', 'password_hash'])
    .where(({ fn }) => fn('lower', ['email']), '=', email.toLowerCase())
    .executeTakeFirst();
  if (!row || !row.password_hash) return null;
  const ok = await argon2.verify(row.password_hash, password);
  if (!ok) return null;
  return row;
}

export async function findOrCreateOidcUser(input: {
  provider: string;
  sub: string;
  email: string;
  emailVerified: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<UserRecord> {
  const email = input.email.trim().toLowerCase();
  if (!emailDomainAllowed(email)) {
    throw Object.assign(new Error('Email domain not allowed'), { statusCode: 403 });
  }

  const link = await db
    .selectFrom('tb_oidc_links')
    .innerJoin('tb_users', 'tb_users.id', 'tb_oidc_links.user_id')
    .select([
      'tb_users.id as id',
      'tb_users.email as email',
      'tb_users.display_name as display_name',
      'tb_users.avatar_url as avatar_url',
      'tb_users.role as role',
    ])
    .where('tb_oidc_links.provider', '=', input.provider)
    .where('tb_oidc_links.sub', '=', input.sub)
    .executeTakeFirst();

  if (link) return link;

  // Either create a new user or link an existing one matched by email. Only
  // auto-link to a pre-existing account when the IdP asserts the email is
  // verified — otherwise an IdP account with an unverified (attacker-chosen)
  // email could be used to take over an existing TokenBoard account.
  const existing = await findUserByEmail(email);
  if (existing) {
    if (!input.emailVerified) {
      throw Object.assign(
        new Error('IdP email is not verified; cannot link to an existing account'),
        { statusCode: 403 },
      );
    }
    await db
      .insertInto('tb_oidc_links')
      .values({ user_id: existing.id, provider: input.provider, sub: input.sub })
      .execute();
    return existing;
  }

  const role: Role = shouldBootstrapAdmin(email) ? 'admin' : 'user';
  const created = await db
    .insertInto('tb_users')
    .values({
      email,
      display_name: input.displayName ?? null,
      avatar_url: input.avatarUrl ?? null,
      role,
    })
    .returning(['id', 'email', 'display_name', 'avatar_url', 'role'])
    .executeTakeFirstOrThrow();

  await db
    .insertInto('tb_oidc_links')
    .values({ user_id: created.id, provider: input.provider, sub: input.sub })
    .execute();

  return created;
}
