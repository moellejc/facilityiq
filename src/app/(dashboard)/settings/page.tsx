import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/dashboard/coming-next";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireRequestContext } from "@/server/services/context";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await requireRequestContext();

  return (
    <div className="space-y-6">
      <PageIntro
        title="Settings"
        description="Your personal profile. Organization, members, facilities, and integrations are managed from Admin."
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>Signed in with a database session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium text-slate-900">{context.name ?? "Name not set"}</p>
          <p className="text-slate-600">{context.email}</p>
          <Badge variant="secondary">{ROLE_LABELS[context.role]}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
