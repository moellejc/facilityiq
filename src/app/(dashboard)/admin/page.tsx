import { FacilitiesPanel } from "@/components/admin/facilities-panel";
import { IntegrationsPanel } from "@/components/admin/integrations-panel";
import { MembersPanel } from "@/components/admin/members-panel";
import { RenameOrganizationForm } from "@/components/admin/rename-form";
import { PageIntro } from "@/components/dashboard/coming-next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canAccessAdmin, type Role } from "@/lib/permissions";
import { requireRequestContext } from "@/server/services/context";
import { listIntegrationRecords } from "@/server/services/integration-service";
import { getOrganizationDirectory } from "@/server/services/organization-service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const context = await requireRequestContext();

  if (!canAccessAdmin(context.role)) {
    return (
      <div className="space-y-6">
        <PageIntro title="Admin" description="Organization administration." />
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>You do not have access</CardTitle>
            <CardDescription>
              Only an organization administrator can open the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Your role can still use the rest of FacilityIQ. Personal details stay on Settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [directory, integrations] = await Promise.all([
    getOrganizationDirectory(context),
    listIntegrationRecords(context, { page: 1, limit: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <PageIntro
        title="Admin"
        description="Manage this organization's name, members, facilities, and integration records."
      />
      <Card>
        <CardHeader>
          <CardTitle>{directory.organization.name}</CardTitle>
          <CardDescription>Slug {directory.organization.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          <RenameOrganizationForm name={directory.organization.name} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Change roles or remove access. The last organization administrator cannot be demoted or
            removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersPanel
            members={directory.members.map((member) => ({
              memberId: member.memberId,
              name: member.name,
              email: member.email,
              role: member.role as Role,
            }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Facilities</CardTitle>
          <CardDescription>
            Add a facility, update its details or street address, or remove it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FacilitiesPanel facilities={context.facilities} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Record the systems this organization uses. Credentials and data synchronization are not
            part of this panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntegrationsPanel integrations={integrations.data} total={integrations.total} />
        </CardContent>
      </Card>
    </div>
  );
}
