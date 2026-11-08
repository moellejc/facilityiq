import { TwinLoader } from "@/components/facilities/twin-loader";
import { requireRequestContext } from "@/server/services/context";
import { getFacilityScene } from "@/server/services/scene-service";

export const dynamic = "force-dynamic";

export default async function TwinPage() {
  const context = await requireRequestContext();
  const scene = await getFacilityScene(context);

  if (!scene) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Choose a facility before opening the digital twin.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">3D Digital Twin</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {scene.facility.name}
          {scene.facility.location ? ` · ${scene.facility.location}` : ""}. Geometry is placed from
          the stored layout and asset positions.
        </p>
      </div>
      <TwinLoader scene={scene} />
    </div>
  );
}
