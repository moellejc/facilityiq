export const SESSION_COOKIE = "authjs.session-token";
export const ORG_COOKIE = "facilityiq.org";
export const FACILITY_COOKIE = "facilityiq.facility";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export function sessionCookieOptions(expires: Date) {
  return { ...baseCookieOptions(), expires };
}

export function preferenceCookieOptions() {
  return { ...baseCookieOptions(), maxAge: THIRTY_DAYS_SECONDS };
}
