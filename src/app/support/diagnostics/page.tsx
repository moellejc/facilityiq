import type { Metadata } from "next";
import { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support diagnostics demo",
  description: "Intentional security-automation demo. Not a product screen.",
};

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000099";

export default async function SupportDiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const parsed = z.string().safeParse(params.message);
  const message = parsed.success && parsed.data.length > 0 ? parsed.data : "";

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <p className="text-xs font-medium tracking-wide text-indigo-700 uppercase">
              Security automation demo
            </p>
            <CardTitle>Support diagnostics</CardTitle>
            <CardDescription>
              Isolated demo for FAIQ-43. This page is not a product feature. Do not merge it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              A fake credential is hardcoded in{" "}
              <code className="text-slate-950">src/lib/support/demo-credentials.ts</code>. The
              values are the AWS documentation examples and a labeled demo token.
            </p>
            <p>
              <a
                className="text-indigo-700 underline"
                href={`/api/support/diagnostics?organizationId=${DEMO_ORGANIZATION_ID}&label=demo`}
              >
                Open /api/support/diagnostics
              </a>{" "}
              with a client-supplied organizationId. That route does not check a session,
              membership, or permission.
            </p>
            <div>
              <p className="mb-2 text-slate-950">Rendered message</p>
              {message ? (
                <div
                  className="rounded-md border border-amber-200 bg-amber-50 p-3 text-slate-950"
                  dangerouslySetInnerHTML={{ __html: message }}
                />
              ) : (
                <p className="rounded-md border border-slate-200 bg-white p-3 text-slate-600">
                  No message query parameter. Add <code>?message=</code> to render that text on this
                  page.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
