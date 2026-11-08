import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import {
  FACILITY_COOKIE,
  ORG_COOKIE,
  SESSION_COOKIE,
  preferenceCookieOptions,
  sessionCookieOptions,
} from "@/lib/auth/cookies";
import { verifyPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

import { listFacilities } from "../repositories/facilities";
import { listMemberships } from "../repositories/membership";

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

export async function authenticate(input: { email: string; password: string; rateKey: string }) {
  const email = input.email.toLowerCase();
  const limit = rateLimit(`login:${input.rateKey}:${email}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    throw new AppError("RATE_LIMITED", "Too many sign-in attempts. Try again later.", 429);
  }

  const [user] = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError("UNAUTHORIZED", "Email or password is incorrect.", 401);
  }

  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) {
    throw new AppError("FORBIDDEN", "This account is not a member of an organization.", 403);
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_MS);
  await getDb().insert(sessions).values({ sessionToken, userId: user.id, expires });

  const facilities = await listFacilities(memberships[0]!.organizationId, user.id);
  return {
    sessionToken,
    expires,
    user: { id: user.id, name: user.name, email: user.email },
    organizationId: memberships[0]!.organizationId,
    facilityId: facilities[0]?.id ?? null,
  };
}

export async function establishSession(result: {
  sessionToken: string;
  expires: Date;
  organizationId: string;
  facilityId: string | null;
}) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(result.expires));
  jar.set(ORG_COOKIE, result.organizationId, preferenceCookieOptions());
  if (result.facilityId) {
    jar.set(FACILITY_COOKIE, result.facilityId, preferenceCookieOptions());
  } else {
    jar.delete(FACILITY_COOKIE);
  }
}
