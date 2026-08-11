import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./auth-shared";

export { SESSION_COOKIE };

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
  return new TextEncoder().encode(secret);
}

/* ----------------------------------------------------------- passwords */

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/* ------------------------------------------------------------ sessions */

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Read and verify the current session. Returns null when there is no valid
 * session — callers decide whether that is an error.
 */
/**
 * Resolves the signed-in user, or null.
 *
 * The cookie proves who signed in; the database decides whether that account
 * is still allowed in and at what role. Trusting the token's own claims meant
 * deactivating a user did not sign them out and a role change did not apply
 * until their token happened to expire — the account stayed live for the rest
 * of the session's lifetime, which is exactly the window that matters when
 * revoking access.
 *
 * Costs one indexed lookup per admin request. Only admin paths reach this;
 * the public site never calls it, and proxy.ts deliberately does not import
 * the database layer.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let subject: string;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    subject = payload.sub;
  } catch {
    // Expired, tampered with, or signed by a rotated secret.
    return null;
  }

  const [account] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, subject))
    .limit(1);

  // Deleted or deactivated since the token was issued.
  if (!account || !account.isActive) return null;

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
  };
}

/* --------------------------------------------------------- authorization */

// Higher number = more capability. Every gate is a floor comparison.
const ROLE_RANK: Record<UserRole, number> = {
  writer: 1,
  editor: 2,
  admin: 3,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Server-side authorization gate. Call this at the top of every admin page,
 * server action, and route handler that mutates data.
 *
 * `proxy.ts` also redirects unauthenticated users, but that is a UX
 * convenience and NOT an authorization boundary — a proxy check can be
 * bypassed by anything that reaches the handler directly, so the real check
 * has to live here, next to the data access.
 */
export async function requireUser(
  minimumRole: UserRole = "writer",
): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!roleAtLeast(session.role, minimumRole)) redirect("/admin?denied=1");
  return session;
}

/** Non-redirecting variant for route handlers, which should return 401/403. */
export async function requireUserApi(
  minimumRole: UserRole = "writer",
): Promise<{ user: SessionUser } | { error: Response }> {
  const session = await getSession();
  if (!session) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!roleAtLeast(session.role, minimumRole)) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user: session };
}

/* ------------------------------------------------------------------ login */

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

export async function authenticate(
  email: string,
  password: string,
): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  // Always run a bcrypt comparison, even when the user does not exist, so the
  // response time does not reveal which emails are registered.
  const hash =
    row?.passwordHash ??
    "$2a$12$0000000000000000000000000000000000000000000000000000";
  const valid = await verifyPassword(password, hash);

  if (!row || !valid || !row.isActive) {
    return { ok: false, error: "Invalid email or password." };
  }

  return {
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
    },
  };
}
