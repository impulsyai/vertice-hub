import type { Metadata } from "next";
import { Suspense } from "react";
import { PipelineClient } from "./_client";
import { PipelineFallback } from "./_fallback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Funil de Seleção" };

export default function PipelinePage() {
  return (
    <Suspense fallback={<PipelineFallback />}>
      <PipelineClient />
    </Suspense>
  );
}
