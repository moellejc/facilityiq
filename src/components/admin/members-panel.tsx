"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";
import {
  addMemberAction,
  changeMemberRoleAction,
  removeMemberAction,
} from "@/server/actions/admin";

type FormState = { error?: string; ok?: string };

const controlClass = "h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm";

export type AdminMember = {
  memberId: string;
  name: string | null;
  email: string;
  role: Role;
};

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-rose-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

function RoleForm({ member }: { member: AdminMember }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeMemberRoleAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="memberId" value={member.memberId} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="role"
          defaultValue={member.role}
          className={controlClass}
          aria-label={`Role for ${member.email}`}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Update role"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

function RemoveForm({ member }: { member: AdminMember }) {
  const [state, action, pending] = useActionState<FormState, FormData>(removeMemberAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="memberId" value={member.memberId} />
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="confirm" required className="mt-1" />
        <span>Remove {member.email} from this organization.</span>
      </label>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Remove access"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function MembersPanel({ members }: { members: AdminMember[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addMemberAction, {});

  return (
    <div className="space-y-6">
      <form action={action} className="grid gap-3 md:grid-cols-[1fr_16rem_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="member-email">Email</Label>
          <Input
            id="member-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="name@company.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-role">Role</Label>
          <select
            id="member-role"
            name="role"
            defaultValue="viewer"
            className={`${controlClass} w-full`}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add member"}
        </Button>
        <div className="md:col-span-3">
          <Feedback state={state} />
          <p className="text-sm text-slate-600">
            Adds an existing FacilityIQ account. Inviting a person who does not have an account yet
            is not available.
          </p>
        </div>
      </form>
      {members.length === 0 ? (
        <p className="text-sm text-slate-600">This organization has no members.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Access</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.memberId} className="border-t border-slate-100 align-top">
                  <td className="py-3 pr-4">{member.name ?? "—"}</td>
                  <td className="py-3 pr-4 text-slate-600">{member.email}</td>
                  <td className="py-3 pr-4">
                    <RoleForm member={member} />
                  </td>
                  <td className="py-3">
                    <RemoveForm member={member} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
