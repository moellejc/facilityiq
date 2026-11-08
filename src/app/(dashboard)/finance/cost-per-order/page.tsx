import { ComingNext } from "@/components/dashboard/coming-next";

export const dynamic = "force-dynamic";

export default function CostPerOrderPage() {
  return (
    <ComingNext
      title="Cost per order"
      phase="Phase 3"
      description="Cost per order is operating cost divided by orders. A zero-order period returns unavailable instead of $0."
    />
  );
}
