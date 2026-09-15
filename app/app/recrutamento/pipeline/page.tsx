import type { Metadata } from "next";
import { Suspense } from "react";
import { PipelineClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pipeline R&S" };

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando funil de seleção...</div>}>
      <PipelineClient />
    </Suspense>
  );
}
