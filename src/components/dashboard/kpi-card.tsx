import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComparedKpi } from "@/lib/analytics/aggregate";
import { formatComparison, formatKpiValue, unavailableLabel } from "@/lib/analytics/display";

export function KpiCard({
  title,
  compared,
  note,
}: {
  title: string;
  compared: ComparedKpi;
  note?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{formatKpiValue(compared.current)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-slate-600">
        {compared.current.value === null ? (
          <p>{unavailableLabel(compared.current.unavailableReason)}</p>
        ) : null}
        <p>{formatComparison(compared)}</p>
        {note ? <p>{note}</p> : null}
      </CardContent>
    </Card>
  );
}
