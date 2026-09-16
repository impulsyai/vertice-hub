"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import {
  Briefcase,
  ArrowLeft,
  Kanban,
  User,
  Plus,
  ArrowSquareOut,
  Buildings,
} from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobDetail, useCandidateList, useCreateApplication } from "@/lib/people/client-hooks";

export function VagaDetalheClient({ id }: { id: string }) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const { data, isLoading, error } = useJobDetail(id);
  const [isAddOpen, setIsAddOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-2 rounded-md" />
          <Skeleton className="h-64 col-span-1 rounded-md" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-destructive font-medium">{t("Vaga não encontrada.")}</div>
        <Link href="/app/recrutamento/vagas">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("Voltar às Vagas")}
          </Button>
        </Link>
      </div>
    );
  }

  const { job, applications } = data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/recrutamento/vagas">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
              <Badge variant={job.status === "open" ? "default" : "secondary"}>
                {job.status === "open" ? t("Aberta") : job.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Buildings className="h-4 w-4" />
              <span>{job.client_company?.trade_name ?? t("Empresa Cliente")}</span>
              <span>•</span>
              <span className="capitalize">{job.work_model}</span>
              {job.city && <span>• {job.city}/{job.state}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/app/recrutamento/pipeline?job_id=${job.id}`}>
            <Button className="gap-2">
              <Kanban className="h-4 w-4" />
              {t("Abrir Pipeline R&S")}
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setIsAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("Adicionar Candidato")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Painel Esquerdo: Requisitos e Descrição */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t("Descrição da Vaga")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-foreground">
              {job.description ? (
                <p className="whitespace-pre-line leading-relaxed">{job.description}</p>
              ) : (
                <p className="text-muted-foreground italic">{t("Nenhuma descrição cadastrada.")}</p>
              )}

              {job.requirements && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">{t("Requisitos e Qualificações")}</h4>
                  <p className="whitespace-pre-line leading-relaxed">{job.requirements}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidaturas vinculadas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">{t("Candidaturas Inscritas")}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {applications.length} {applications.length === 1 ? t("candidato") : t("candidatos")}
              </span>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {t("Nenhum candidato vinculado a esta vaga ainda.")}
                </div>
              ) : (
                <div className="divide-y border rounded-md overflow-hidden">
                  {applications.map((app) => (
                    <div key={app.id} className="p-3.5 flex items-center justify-between hover:bg-muted/20">
                      <div>
                        <Link
                          href={`/app/recrutamento/talentos/${app.candidate_id}`}
                          className="font-medium text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <span>{app.candidate?.full_name ?? t("Candidato")}</span>
                          <ArrowSquareOut className="h-3 w-3" />
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {app.candidate?.current_job_title ?? app.candidate?.current_role ?? "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="capitalize">
                          {app.stage.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel Direito: Metadados */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t("Detalhes da Posição")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">{t("Departamento")}</span>
                <span className="font-medium">{job.department ?? "Geral"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Modelo de Trabalho")}</span>
                <span className="font-medium capitalize">{job.work_model}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Vagas Abertas")}</span>
                <span className="font-medium">{job.openings_count}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Prioridade")}</span>
                <span className="font-medium capitalize">{job.priority}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Data de Abertura")}</span>
                <span className="font-medium">
                  {job.opened_at ? new Date(job.opened_at).toLocaleDateString(tagDoIdioma) : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AddCandidateToJobDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        jobId={job.id}
      />
    </div>
  );
}

function AddCandidateToJobDialog({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}) {
  const t = useT();
  const create = useCreateApplication();
  const { data } = useCandidateList({ limit: 100 });
  const candidates = data?.data ?? [];
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");

  async function handleAdd() {
    if (!selectedCandidate) {
      toast.error(t("Selecione um candidato."));
      return;
    }
    try {
      await create.mutateAsync({
        job_opening_id: jobId,
        candidate_id: selectedCandidate,
        stage: "received",
      });
      toast.success(t("Candidato vinculado à vaga!"));
      setSelectedCandidate("");
      onOpenChange(false);
    } catch {
      // erro tratado no hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Adicionar Candidato à Vaga")}</DialogTitle>
          <DialogDescription>
            {t("Selecione um profissional cadastrado no banco de talentos.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>{t("Candidato")} *</Label>
            <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
              <SelectTrigger>
                <SelectValue placeholder={t("Selecione um talento...")} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name} ({c.current_job_title ?? c.current_role ?? t("Sem cargo")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancelar")}
          </Button>
          <Button onClick={handleAdd} disabled={!selectedCandidate || create.isPending}>
            {create.isPending ? t("Adicionando...") : t("Vincular à Vaga")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
