import { Suspense } from "react";
import { Steward } from "@/components/Steward";
import { Spinner } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Spinner caption="Loading Steward" />}>
      <Steward />
    </Suspense>
  );
}
