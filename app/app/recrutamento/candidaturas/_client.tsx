"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { UsersThree, Kanban, ArrowSquareOut } from "@/lib/ui/icons";
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
import { RECRUITMENT_STAGES, type RecruitmentStage } from "@/lib/people/types";

export function CandidaturasClient() {
  const t = useT();
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: jobsData } = useJobList({ limit: 100 });
  const jobs = jobsData?.data ?? [];

  const { data, isLoading } = useApplicationList({
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
        <Link href="/app/recrutamento/pipeline">
          <Button className="gap-2 shrink-0">
            <Kanban className="h-4 w-4" />
            {t("Abrir Pipeline Kanban")}
          </Button>
        </Link>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedJob}
          onValueChange={(val) => {
            setSelectedJob(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder={t("Filtrar por vaga")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Todas as vagas")}</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
          <div className="rounded-full bg-surface-muted p-4 mb-4">
            <UsersThree className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("Nenhuma candidatura encontrada")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            {t("Vincule talentos a vagas abertas para começar a acompanhar as etapas do processo seletivo.")}
          </p>
          <Link href="/app/recrutamento/vagas">
            <Button variant="outline">{t("Ir para Vagas")}</Button>
          </Link>
        </Card>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
              <tr>
                <th className="p-4">{t("Candidato")}</th>
                <th className="p-4">{t("Vaga")}</th>
                <th className="p-4">{t("Empresa Cliente")}</th>
                <th className="p-4">{t("Etapa Atual")}</th>
                <th className="p-4">{t("Data")}</th>
                <th className="p-4 text-right">{t("Ações")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {applications.map((app) => {
                const stageDef = RECRUITMENT_STAGES.find((s) => s.id === app.stage);
                return (
                  <tr key={app.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <Link
                        href={`/app/recrutamento/talentos/${app.candidate_id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors block"
                      >
                        {app.candidate?.full_name ?? t("Candidato")}
                      </Link>
                      <span className="text-xs text-muted-foreground">{app.candidate?.current_role ?? "—"}</span>
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/app/recrutamento/vagas/${app.job_opening_id}`}
                        className="text-foreground hover:text-primary transition-colors block font-medium"
                      >
                        {app.job_opening?.title ?? t("Vaga")}
                      </Link>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {app.job_opening?.client_company?.trade_name ?? "—"}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-normal text-xs">
                        {stageDef?.label ?? app.stage}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {new Date(app.stage_changed_at || app.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/app/recrutamento/pipeline?job_id=${app.job_opening_id}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs">
                            {t("Pipeline")}
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
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
              <span>
                {t("Página")} {pagination.page} {t("de")} {pagination.totalPages} ({pagination.total} {t("candidaturas")})
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
