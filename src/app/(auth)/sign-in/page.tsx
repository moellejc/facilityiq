import { SignInForm } from "@/components/auth/sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/dashboard";

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-[#0B1220] p-10 text-slate-100 lg:flex">
        <div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500 font-semibold text-white">
            FQ
          </div>
          <h1 className="mt-10 max-w-md text-4xl font-semibold tracking-tight text-white">
            See the warehouse before the spreadsheet does.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
            FacilityIQ keeps facility layout, operating metrics, and cost in one organization-scoped
            record. The 3D twin and calculated KPIs come online in later phases. This sign-in uses a
            local password and a revocable database session.
          </p>
        </div>
        <p className="text-xs text-slate-500">Acme Manufacturing · West Distribution Center</p>
      </section>
      <section className="flex items-center justify-center bg-[#f4f6fb] px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Sign in</h2>
          <p className="mt-1 mb-6 text-sm text-slate-600">
            Use a seeded Acme account. No external identity provider is required.
          </p>
          <SignInForm callbackUrl={callbackUrl} />
        </div>
      </section>
    </div>
  );
}
