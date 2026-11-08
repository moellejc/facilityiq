import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingNext({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <p className="text-xs font-medium tracking-wide text-indigo-700 uppercase">{phase}</p>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          The page is routed and protected. It will not show invented throughput, cost, or
          utilization figures. Those values will be calculated from stored metrics when that phase
          lands.
        </CardContent>
      </Card>
    </div>
  );
}

export function PageIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
    </div>
  );
}
