import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";

import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

import { SESSION_COOKIE, baseCookieOptions } from "./cookies";

/**
 * Auth.js v5.0.0-beta.32 rejects database sessions when Credentials is the only
 * provider, and the credentials callback always writes a JWT. Sessions are
 * still Auth.js database sessions: this config uses the Drizzle adapter and
 * `session.strategy = "database"`. Password sign-in inserts the session row
 * and sets the same cookie Auth.js reads. Deleting the row revokes access.
 */
export const { handlers, auth, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    // Session token is unique, not the primary key. The adapter only looks it
    // up by column. Its published table type insists the token is the PK.
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  } as never),
  session: { strategy: "database", maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  pages: { signIn: "/sign-in" },
  providers: [],
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE,
      options: baseCookieOptions(),
    },
  },
  callbacks: {
    session({ session, user }) {
      return {
        expires: session.expires,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      };
    },
  },
});
