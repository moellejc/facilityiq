import { ZodError } from "zod";

import { isAppError } from "@/lib/errors";

export type ActionState = {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
};

export function actionError(error: unknown, fallback: string): ActionState {
  if (isAppError(error)) return { error: error.message };
  if (error instanceof ZodError) return { error: "The request is invalid." };
  return { error: fallback };
}
