"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { UsersThree, Kanban, ArrowSquareOut, Plus } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApplicationList, useJobList } from "@/lib/people/client-hooks";
import { RECRUITMENT_STAGES } from "@/lib/people/types";
import { QuickRecruitmentDialog } from "@/components/inbox/QuickRecruitmentDialog";
import { GroupedJobSelect } from "@/components/recruitment/GroupedJobSelect";

export function CandidaturasClient() {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: jobsData } = useJobList({ limit: 100 });
  const jobs = jobsData?.data ?? [];

  const { data, isLoading, refetch } = useApplicationList({
    job_opening_id: selectedJob !== "all" ? selectedJob : undefined,
    stage: selectedStage !== "all" ? selectedStage : undefined,
    page,
    limit: 25,
  });

  const applications = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Candidaturas")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Visão consolidada de todas as inscrições e movimentações do funil de R&S.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setDialogOpen(true)} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" weight="bold" />
            {t("Nova Candidatura")}
          </Button>
          <Link href="/app/recrutamento/pipeline">
            <Button variant="outline" className="shrink-0 gap-2">
              <Kanban className="h-4 w-4" />
              {t("Abrir Funil de Seleção")}
            </Button>
          </Link>
        </div>
      </header>

      <QuickRecruitmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialJobId={selectedJob !== "all" ? selectedJob : undefined}
        onSuccess={() => void refetch()}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <GroupedJobSelect
          jobs={jobs}
          value={selectedJob}
          onValueChange={(val) => {
            setSelectedJob(val);
            setPage(1);
          }}
          placeholder={t("Filtrar por vaga")}
          allOption={{ value: "all", label: t("Todas as vagas") }}
          countLabel={t("vagas")}
          className="w-[260px]"
        />

        <Select
          value={selectedStage}
          onValueChange={(val) => {
            setSelectedStage(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("Filtrar por etapa")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Todas as etapas")}</SelectItem>
            {RECRUITMENT_STAGES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="bg-surface-muted mb-4 rounded-full p-4">
            <UsersThree className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("Nenhuma candidatura encontrada")}</h3>
          <p className="mt-1 mb-4 max-w-md text-sm text-muted-foreground">
            {t(
              "Vincule talentos a vagas abertas para começar a acompanhar as etapas do processo seletivo.",
            )}
          </p>
          <Link href="/app/recrutamento/vagas">
            <Button variant="outline">{t("Ir para Vagas")}</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {applications.map((app) => {
              const stageDef = RECRUITMENT_STAGES.find((s) => s.id === app.stage);
              return (
                <div
                  key={app.id}
                  onClick={() => {
                    window.location.href = `/app/recrutamento/talentos/${app.candidate_id}`;
                  }}
                  className="cursor-pointer space-y-3 rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {app.candidate?.full_name ?? t("Candidato")}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {app.candidate?.current_job_title ?? app.candidate?.current_role ?? "—"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-primary/30 bg-primary/10 text-[11px] font-medium text-primary"
                    >
                      {stageDef?.label ?? app.stage}
                    </Badge>
                  </div>

                  <div className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {app.job_opening?.title ?? app.job?.title ?? t("Vaga")}
                      </span>
                      <span>
                        {new Date(app.stage_changed_at || app.created_at).toLocaleDateString(
                          tagDoIdioma,
                        )}
                      </span>
                    </div>
                    <div className="truncate">
                      {app.job_opening?.client_company?.trade_name ??
                        app.job_opening?.company?.trade_name ??
                        app.job?.client_company?.trade_name ??
                        app.job?.company?.trade_name ??
                        "—"}
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-end gap-2 border-t border-dashed pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`/app/recrutamento/pipeline?job_id=${app.job_opening_id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        {t("Funil")}
                      </Button>
                    </Link>
                    <Link href={`/app/recrutamento/talentos/${app.candidate_id}`}>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                        <span>{t("Dossiê")}</span>
                        <ArrowSquareOut className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-md border bg-card shadow-xs md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/60 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="p-4">{t("Candidato")}</th>
                  <th className="p-4">{t("Vaga")}</th>
                  <th className="p-4">{t("Empresa Cliente")}</th>
                  <th className="p-4">{t("Etapa Atual")}</th>
                  <th className="p-4">{t("Data")}</th>
                  <th className="p-4 text-right">{t("Ações")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {applications.map((app) => {
                  const stageDef = RECRUITMENT_STAGES.find((s) => s.id === app.stage);
                  return (
                    <tr
                      key={app.id}
                      onClick={() => {
                        window.location.href = `/app/recrutamento/talentos/${app.candidate_id}`;
                      }}
                      className="cursor-pointer transition-colors hover:bg-accent/5"
                    >
                      <td className="p-4">
                        <Link
                          href={`/app/recrutamento/talentos/${app.candidate_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {app.candidate?.full_name ?? t("Candidato")}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {app.candidate?.current_job_title ?? app.candidate?.current_role ?? "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/app/recrutamento/vagas/${app.job_opening_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {app.job_opening?.title ?? app.job?.title ?? t("Vaga")}
                        </Link>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {app.job_opening?.client_company?.trade_name ??
                          app.job_opening?.company?.trade_name ??
                          app.job?.client_company?.trade_name ??
                          app.job?.company?.trade_name ??
                          "—"}
                      </td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-xs font-medium text-primary"
                        >
                          {stageDef?.label ?? app.stage}
                        </Badge>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {new Date(app.stage_changed_at || app.created_at).toLocaleDateString(
                          tagDoIdioma,
                        )}
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/app/recrutamento/pipeline?job_id=${app.job_opening_id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              {t("Funil")}
                            </Button>
                          </Link>
                          <Link href={`/app/recrutamento/talentos/${app.candidate_id}`}>
                            <Button variant="ghost" size="sm" className="h-8 gap-1">
                              <span>{t("Dossiê")}</span>
                              <ArrowSquareOut className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
              <span>
                {t("Página")} {pagination.page} {t("de")} {pagination.totalPages} (
                {pagination.total} {t("candidaturas")})
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("Anterior")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("Próxima")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
