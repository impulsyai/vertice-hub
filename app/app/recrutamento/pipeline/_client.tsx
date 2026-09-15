"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { Kanban, ArrowSquareOut, User, Buildings, Briefcase } from "@/lib/ui/icons";
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

export function PipelineClient() {
  const t = useT();
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("job_id");

  const [selectedJob, setSelectedJob] = useState<string>(initialJobId || "all");

  const { data: jobsData } = useJobList({ limit: 100 });
  const jobs = jobsData?.data ?? [];

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
    <div className="flex flex-col h-[calc(100vh-4rem)] p-6 space-y-4 overflow-hidden">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Pipeline R&S")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Funil de 10 etapas para triagem, avaliação e aprovação de candidatos.")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={t("Filtrar por vaga...")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todas as vagas ativas")}</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title} ({j.client_company?.trade_name ?? t("Cliente")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {[1, 2, 3, 4, 5].map((col) => (
            <div key={col} className="w-72 shrink-0 space-y-3 bg-muted/30 p-3 rounded-lg border">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 h-full select-none">
            {RECRUITMENT_STAGES.map((stage) => {
              const stageApps = columns.get(stage.id) ?? [];
              return (
                <div
                  key={stage.id}
                  className="flex flex-col w-72 shrink-0 rounded-lg border border-border bg-muted/20 p-2.5 h-full overflow-hidden"
                >
                  <div className="flex items-center justify-between pb-2 px-1 border-b border-border/50 shrink-0">
                    <span className="text-xs font-semibold tracking-tight text-foreground truncate">
                      {stage.label}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {stageApps.length}
                    </Badge>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-2 py-2 px-0.5 min-h-[120px] transition-colors rounded-md ${
                          snapshot.isDraggingOver ? "bg-primary/5" : ""
                        }`}
                      >
                        {stageApps.map((app, index) => (
                          <Draggable key={app.id} draggableId={app.id} index={index}>
                            {(providedDrag, snapshotDrag) => (
                              <div
                                ref={providedDrag.innerRef}
                                {...providedDrag.draggableProps}
                                {...providedDrag.dragHandleProps}
                                className={`rounded-md border bg-card p-3 shadow-xs transition-shadow ${
                                  snapshotDrag.isDragging ? "shadow-md ring-1 ring-primary/40 rotate-1" : "hover:border-primary/50"
                                }`}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="font-medium text-sm text-foreground line-clamp-1">
                                      {app.candidate?.full_name ?? t("Candidato")}
                                    </span>
                                    <Link
                                      href={`/app/recrutamento/talentos/${app.candidate_id}`}
                                      className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                                      title={t("Abrir Dossiê")}
                                    >
                                      <ArrowSquareOut className="h-3.5 w-3.5" />
                                    </Link>
                                  </div>

                                  <div className="text-xs text-muted-foreground line-clamp-1">
                                    {app.candidate?.current_role ?? t("Sem cargo")}
                                  </div>

                                  <div className="pt-1.5 border-t border-border/40 flex flex-col gap-1 text-[11px] text-muted-foreground">
                                    <div className="flex items-center gap-1 truncate">
                                      <Briefcase className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{app.job_opening?.title ?? t("Vaga")}</span>
                                    </div>
                                    <div className="flex items-center gap-1 truncate">
                                      <Buildings className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{app.job_opening?.client_company?.trade_name ?? t("Cliente")}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
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
    </div>
  );
}
