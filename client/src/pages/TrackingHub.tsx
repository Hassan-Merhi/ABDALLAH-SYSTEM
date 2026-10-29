import { Suspense } from "react";
import { lazyRetry as lazy } from "@/lib/lazyRetry";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

const TrackingContainersTab = lazy(() => import("@/pages/tracking/TrackingContainersTab"));

function TabFallback() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function TrackingHub() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Tracking" subtitle="Containers on the way" />

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col pb-4 sm:px-4">
        <Suspense fallback={<TabFallback />}>
          <TrackingContainersTab />
        </Suspense>
      </div>
    </div>
  );
}
