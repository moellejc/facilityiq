"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FacilitiesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>This facilities page could not be loaded</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <p>Try again. If this keeps happening, reload the page.</p>
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
