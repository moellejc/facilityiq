"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { regenerateInsightsAction, updateInsightStatusAction } from "@/server/actions/insights";

export function GenerateInsights({
  from,
  to,
  canWrite,
  auto,
}: {
  from: string;
  to: string;
  canWrite: boolean;
  auto: boolean;
}) {
  const ran = useRef<string | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const rangeKey = `${from}:${to}`;

  useEffect(() => {
    if (!canWrite || !auto || ran.current === rangeKey) return;
    ran.current = rangeKey;
    startTransition(async () => {
      const data = new FormData();
      data.set("from", from);
      data.set("to", to);
      await regenerateInsightsAction(data);
      router.refresh();
    });
  }, [auto, canWrite, from, rangeKey, router, to]);

  if (!canWrite) return null;

  return (
    <form action={regenerateInsightsAction} className="flex items-center gap-2">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Updating insights…" : "Regenerate from metrics"}
      </Button>
    </form>
  );
}

export function InsightStatusForm({ insightId, status }: { insightId: string; status: string }) {
  return (
    <form action={updateInsightStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="insightId" value={insightId} />
      <select
        name="status"
        defaultValue={status}
        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm"
        aria-label="Insight status"
      >
        <option value="open">Open</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="dismissed">Dismissed</option>
      </select>
      <Button type="submit" size="sm" variant="outline">
        Save status
      </Button>
    </form>
  );
}
