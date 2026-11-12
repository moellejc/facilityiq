import type { FacilityAddress } from "@/lib/facilities";

export function FacilityAddressBlock({ address }: { address: FacilityAddress | null }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Street address</p>
      {address ? (
        <p className="text-sm text-slate-600">
          <span className="block">{address.street}</span>
          <span className="block">
            {address.city}, {address.region} {address.postalCode}
          </span>
          <span className="block">{address.country}</span>
        </p>
      ) : (
        <p className="text-sm text-slate-600">No street address yet.</p>
      )}
    </div>
  );
}
