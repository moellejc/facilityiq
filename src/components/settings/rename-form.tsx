"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameOrganizationAction, type SettingsState } from "@/server/actions/settings";

export function RenameOrganizationForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    renameOrganizationAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="organization-name">Organization name</Label>
        <Input id="organization-name" name="name" defaultValue={name} required minLength={2} />
      </div>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700">{state.ok}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
