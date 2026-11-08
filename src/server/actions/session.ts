"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth";
import { FACILITY_COOKIE, ORG_COOKIE } from "@/lib/auth/cookies";
import { isAppError } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";

import { authenticate, establishSession } from "../services/auth-service";

export type SignInState = { error?: string };

function safeCallback(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function signInAction(_state: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }

  const headerStore = await headers();
  const rateKey = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  try {
    const result = await authenticate({ ...parsed.data, rateKey });
    await establishSession(result);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    return { error: "Sign-in failed. Try again." };
  }

  redirect(safeCallback(String(formData.get("callbackUrl") ?? "")));
}

export async function signOutAction() {
  const jar = await cookies();
  jar.delete(ORG_COOKIE);
  jar.delete(FACILITY_COOKIE);
  await signOut({ redirectTo: "/sign-in" });
}
