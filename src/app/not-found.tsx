import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb] px-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-indigo-700 uppercase">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          That page is not in FacilityIQ
        </h1>
        <p className="mt-2 text-sm text-slate-600">The address does not match a dashboard route.</p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-indigo-700">
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
