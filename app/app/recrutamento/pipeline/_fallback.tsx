"use client";

import { useT } from "@/hooks/i18n/useT";

export function PipelineFallback() {
  const t = useT();
  return <div className="p-6 text-sm text-muted-foreground">{t("Carregando funil de seleção...")}</div>;
}
