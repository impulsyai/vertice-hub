"use client";

import { Badge } from "@/components/ui/badge";
import { ChatCircle, Globe } from "@/lib/ui/icons";

interface SourceBadgeProps {
  source: string | null | undefined;
  prefix?: boolean;
}

export function SourceBadge({ source, prefix = false }: SourceBadgeProps) {
  const normalizedSource = source?.trim().toLowerCase();
  if (!normalizedSource) return null;

  const isSite = ["site_talentos", "site_talentos_v2", "site", "site_b2b"].includes(normalizedSource);
  const isWhatsapp = normalizedSource === "whatsapp";
  const isManual = normalizedSource === "manual";
  const label = isSite ? "Site" : isWhatsapp ? "WhatsApp" : isManual ? "Manual" : source;
  const Icon = isSite ? Globe : isWhatsapp ? ChatCircle : null;
  const className = isSite
    ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300"
    : isWhatsapp
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300"
      : "border-border bg-muted/60 text-muted-foreground";

  return (
    <Badge variant="outline" className={`gap-1.5 px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {prefix ? `Origem: ${label}` : label}
    </Badge>
  );
}

export const CandidateSourceBadge = SourceBadge;
