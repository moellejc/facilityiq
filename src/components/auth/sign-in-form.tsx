"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type SignInState } from "@/server/actions/session";

const DEMO_ACCOUNTS = [
  ["admin@acme.example", "Organization administrator"],
  ["operations@acme.example", "Operations manager"],
  ["finance@acme.example", "Finance manager"],
  ["viewer@acme.example", "Viewer"],
];

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-medium text-slate-800">Demo access for Acme Manufacturing</p>
        <p className="mt-1">Password for every account: FacilityIQ-demo-2026</p>
        <ul className="mt-2 space-y-1">
          {DEMO_ACCOUNTS.map(([email, role]) => (
            <li key={email}>
              <span className="font-medium text-slate-800">{email}</span> · {role}
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
