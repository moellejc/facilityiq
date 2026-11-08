import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/dashboard/coming-next";
import { RenameOrganizationForm } from "@/components/settings/rename-form";
import { ROLE_LABELS, ROLES, roleCan } from "@/lib/permissions";
import { changeMemberRoleAction } from "@/server/actions/settings";
import { requireRequestContext } from "@/server/services/context";
import { getOrganizationDirectory } from "@/server/services/organization-service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await requireRequestContext();
  const directory = await getOrganizationDirectory(context);
  const canManage = roleCan(context.role, "members:write");

  return (
    <div className="space-y-6">
      <PageIntro
        title="Settings"
        description="Profile, organization, and membership. Role changes are checked on the server and written to the audit log."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>Signed in with a database session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium text-slate-900">{context.name}</p>
            <p className="text-slate-600">{context.email}</p>
            <Badge variant="secondary">{ROLE_LABELS[context.role]}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{directory.organization.name}</CardTitle>
            <CardDescription>Slug {directory.organization.slug}</CardDescription>
          </CardHeader>
          <CardContent>
            {roleCan(context.role, "organization:update") ? (
              <RenameOrganizationForm name={directory.organization.name} />
            ) : (
              <p className="text-sm text-slate-600">
                Only an organization administrator can rename the organization.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {canManage
              ? "Administrators can change roles. The last administrator cannot be demoted."
              : "You can see who belongs to this organization. Role changes are limited to administrators."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {directory.members.map((member) => (
                <tr key={member.memberId} className="border-t border-slate-100">
                  <td className="py-3 pr-4">{member.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{member.email}</td>
                  <td className="py-3">
                    {canManage ? (
                      <form action={changeMemberRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="memberId" value={member.memberId} />
                        <select
                          name="role"
                          defaultValue={member.role}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                          aria-label={`Role for ${member.email}`}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          Update
                        </button>
                      </form>
                    ) : (
                      ROLE_LABELS[member.role]
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
