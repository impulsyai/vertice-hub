"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { ArrowSquareOut, Buildings, Briefcase, Eye, FileText } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApplicationList,
  useJobList,
  useUpdateApplicationStage,
} from "@/lib/people/client-hooks";
import {
  RECRUITMENT_STAGES,
  type RecruitmentStage,
  type VerticeJobApplication,
} from "@/lib/people/types";
import { GroupedJobSelect } from "@/components/recruitment/GroupedJobSelect";
import {
  CandidateResumePreviewDialog,
  type ResumePreviewTarget,
} from "@/components/recruitment/CandidateResumePreviewDialog";

const SENIORITY_LABELS: Record<string, string> = {
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
  lead: "Coordenação",
  coordenacao: "Coordenação",
  director: "Gerência",
  gerencia: "Gerência",
  c_level: "Diretoria / C-Level",
  diretoria: "Diretoria / C-Level",
};

function formatSalary(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PipelineClient() {
  const t = useT();
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("job_id");

  const [selectedJob, setSelectedJob] = useState<string>(initialJobId || "all");

  const { data: jobsData } = useJobList({ status: "open", limit: 100 });
  const jobs = jobsData?.data ?? [];
  const [resumeToPreview, setResumeToPreview] = useState<ResumePreviewTarget | null>(null);

  // Se initialJobId foi passado pela URL e jobs carregaram, sincroniza
  useEffect(() => {
    if (initialJobId) {
      setSelectedJob(initialJobId);
    }
  }, [initialJobId]);

  const { data, isLoading } = useApplicationList({
    job_opening_id: selectedJob !== "all" ? selectedJob : undefined,
    limit: 200,
  });

  const updateStage = useUpdateApplicationStage();

  // Estado local para otimismo imediato durante drag-and-drop
  const [localApplications, setLocalApplications] = useState<VerticeJobApplication[]>([]);

  useEffect(() => {
    if (data?.data) {
      setLocalApplications(data.data);
    }
  }, [data]);

  const columns = useMemo(() => {
    const map = new Map<RecruitmentStage, VerticeJobApplication[]>();
    for (const stage of RECRUITMENT_STAGES) {
      map.set(stage.id, []);
    }
    for (const app of localApplications) {
      const col = map.get(app.stage as RecruitmentStage);
      if (col) {
        col.push(app);
      }
    }
    return map;
  }, [localApplications]);

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStage = destination.droppableId as RecruitmentStage;
    const previousApplications = [...localApplications];

    // Atualização otimista local
    setLocalApplications((prev) =>
      prev.map((app) => (app.id === draggableId ? { ...app, stage: newStage } : app)),
    );

    try {
      await updateStage.mutateAsync({
        id: draggableId,
        stage: newStage,
      });
      const stageObj = RECRUITMENT_STAGES.find((s) => s.id === newStage);
      toast.success(`${t("Candidatura movida para")} ${stageObj?.label ?? newStage}`);
    } catch {
      // Rollback em caso de falha
      setLocalApplications(previousApplications);
      toast.error(t("Não foi possível mover a candidatura."));
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col space-y-4 overflow-hidden rounded-lg bg-background p-6">
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Funil de Seleção")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Funil de 10 etapas para triagem, avaliação e aprovação de candidatos.")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GroupedJobSelect
            jobs={jobs}
            value={selectedJob}
            onValueChange={setSelectedJob}
            placeholder={t("Filtrar por vaga...")}
            allOption={{ value: "all", label: t("Todas as vagas ativas") }}
            countLabel={t("vagas abertas")}
            className="w-[280px]"
          />
        </div>
      </header>

      {isLoading ? (
        <div className="flex h-full gap-4 overflow-x-auto rounded-lg border border-border/80 bg-muted/20 p-3 pb-4">
          {[1, 2, 3, 4, 5].map((col) => (
            <div
              key={col}
              className="w-72 shrink-0 space-y-3 rounded-lg border border-border bg-muted/50 p-3 shadow-sm"
            >
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex h-full gap-3 overflow-x-auto rounded-lg border border-border/80 bg-muted/20 p-3 pb-4 select-none">
            {RECRUITMENT_STAGES.map((stage, idx) => {
              const stageApps = columns.get(stage.id) ?? [];
              const stepNumber = String(idx + 1).padStart(2, "0");
              return (
                <div
                  key={stage.id}
                  className="flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-muted/50 p-2.5 shadow-sm"
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-1 pb-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="py-0.2 rounded-md bg-primary/10 px-1 font-mono text-[10px] font-semibold text-primary">
                        {stepNumber}
                      </span>
                      <span className="truncate text-xs font-semibold tracking-tight text-foreground">
                        {stage.label.replace(/^\d+\s*/, "")}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="h-4 border border-border/50 bg-background px-1.5 py-0 font-mono text-[10px]"
                    >
                      {stageApps.length}
                    </Badge>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[120px] flex-1 space-y-2 overflow-y-auto rounded-md px-0.5 py-2 transition-colors ${
                          snapshot.isDraggingOver ? "bg-primary/5" : ""
                        }`}
                      >
                        {stageApps.map((app, index) => {
                          const candidate = app.candidate;
                          const opening = app.job_opening ?? app.job;
                          const company = opening?.client_company ?? opening?.company;
                          const resume =
                            app.resume ??
                            (app.resume_id
                              ? {
                                  id: app.resume_id,
                                  original_filename: t("Currículo"),
                                  mime_type: "application/pdf",
                                }
                              : null);

                          return (
                            <Draggable key={app.id} draggableId={app.id} index={index}>
                              {(providedDrag, snapshotDrag) => (
                                <div
                                  ref={providedDrag.innerRef}
                                  {...providedDrag.draggableProps}
                                  {...providedDrag.dragHandleProps}
                                  className={`rounded-md border border-border/80 bg-card p-3 shadow-sm transition-all ${
                                    snapshotDrag.isDragging
                                      ? "rotate-1 bg-card shadow-lg ring-2 ring-primary/40"
                                      : "hover:border-primary/40 hover:shadow-xs"
                                  }`}
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="line-clamp-1 text-sm font-medium text-foreground">
                                        {app.candidate?.full_name ?? t("Candidato")}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {resume && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                                            title={t("Visualizar Currículo")}
                                            aria-label={t("Visualizar Currículo")}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setResumeToPreview(resume);
                                            }}
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                        <Link
                                          href={`/app/recrutamento/talentos/${app.candidate_id}`}
                                          className="text-muted-foreground transition-colors hover:text-primary"
                                          title={t("Abrir Dossiê")}
                                          onClick={(event) => event.stopPropagation()}
                                        >
                                          <ArrowSquareOut className="h-3.5 w-3.5" />
                                        </Link>
                                      </div>
                                    </div>

                                    <div className="line-clamp-1 text-xs text-muted-foreground">
                                      {candidate?.current_job_title ??
                                        candidate?.current_role ??
                                        t("Sem cargo")}
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                      {candidate?.expected_salary != null &&
                                        candidate.expected_salary > 0 && (
                                          <Badge
                                            variant="outline"
                                            className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-700 dark:text-emerald-300"
                                          >
                                            {formatSalary(candidate.expected_salary)}
                                          </Badge>
                                        )}
                                      {candidate?.seniority && (
                                        <Badge
                                          variant="outline"
                                          className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
                                        >
                                          {SENIORITY_LABELS[candidate.seniority] ??
                                            candidate.seniority}
                                        </Badge>
                                      )}
                                      {candidate?.availability && (
                                        <Badge
                                          variant="outline"
                                          className="border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-[10px] text-sky-700 dark:text-sky-300"
                                        >
                                          {candidate.availability}
                                        </Badge>
                                      )}
                                      {resume && (
                                        <Badge
                                          variant="outline"
                                          className="gap-1 border-violet-500/30 bg-violet-500/10 px-1.5 py-0 text-[10px] text-violet-700 dark:text-violet-300"
                                          title={t("Currículo anexado")}
                                        >
                                          <FileText className="h-3 w-3" />
                                          {t("CV")}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-1 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
                                      <div className="flex items-center gap-1 truncate">
                                        <Briefcase className="h-3 w-3 shrink-0 text-primary" />
                                        <span className="truncate font-medium text-foreground/90">
                                          {opening?.title ?? t("Vaga")}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 truncate">
                                        <Buildings className="h-3 w-3 shrink-0" />
                                        <span className="truncate">
                                          {company?.trade_name ??
                                            company?.legal_name ??
                                            t("Cliente")}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
      <CandidateResumePreviewDialog
        resume={resumeToPreview}
        open={Boolean(resumeToPreview)}
        onOpenChange={(open) => {
          if (!open) setResumeToPreview(null);
        }}
      />
    </div>
  );
}
