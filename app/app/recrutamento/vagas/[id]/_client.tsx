"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import {
  ArrowLeft,
  Kanban,
  User,
  Plus,
  ArrowSquareOut,
  Buildings,
  PencilSimple,
} from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  useJobDetail,
  useCandidateList,
  useCreateApplication,
  useCompanyList,
  useUpdateJob,
} from "@/lib/people/client-hooks";
import type { JobOpening, WorkModel, EmploymentType, JobPriority, JobStatus } from "@/lib/people/types";

export function VagaDetalheClient({ id }: { id: string }) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const { data, isLoading, error } = useJobDetail(id);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

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

const STAGE_LABELS: Record<string, string> = {
  received: "01 Recebido",
  screening: "02 Triagem",
  vertice_interview: "Entrevista Vértice",
  assessment: "Avaliação Técnica",
  shortlist: "Shortlist",
  client_interview: "Entrevista Cliente",
  finalist: "Finalista",
  approved: "Aprovado",
  rejected: "Reprovado",
  withdrawn: "Desistiu",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const WORK_MODEL_LABELS: Record<string, string> = {
  presential: "Presencial",
  hybrid: "Híbrido",
  remote: "Remoto",
};

  const { job, applications } = data;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start sm:items-center gap-3">
          <Link href="/app/recrutamento/vagas">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-1 sm:mt-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                {t("Posição Corporativa")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{job.title}</h1>
              <Badge
                variant="outline"
                className={
                  job.status === "open"
                    ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                    : "border-stone-300 bg-stone-100 text-stone-700 font-normal"
                }
              >
                {job.status === "open" ? t("Aberta") : job.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Buildings className="h-4 w-4 text-primary shrink-0" />
                {job.client_company?.trade_name ?? t("Empresa Cliente")}
              </span>
              <span>•</span>
              <span>{WORK_MODEL_LABELS[job.work_model] ?? job.work_model}</span>
              {job.city && <span>• {job.city}/{job.state}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
          <Link href={`/app/recrutamento/pipeline?job_id=${job.id}`}>
            <Button className="gap-2 text-xs sm:text-sm h-9">
              <Kanban className="h-4 w-4" />
              {t("Abrir Funil de Seleção")}
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setIsEditOpen(true)} className="gap-2 text-xs sm:text-sm h-9">
            <PencilSimple className="h-4 w-4" />
            {t("Editar Vaga")}
          </Button>
          <Button variant="outline" onClick={() => setIsAddOpen(true)} className="gap-2 text-xs sm:text-sm h-9">
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
                        <Badge variant="secondary">
                          {STAGE_LABELS[app.stage] ?? app.stage.replace("_", " ")}
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
                <span className="font-medium">{WORK_MODEL_LABELS[job.work_model] ?? job.work_model}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Quantidade de Posições")}</span>
                <span className="font-medium">{job.openings_count}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Prioridade")}</span>
                <span className="font-medium">{PRIORITY_LABELS[job.priority] ?? job.priority}</span>
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

      <EditJobDialog
        key={job.id + (job.updated_at ?? "")}
        job={job}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
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

export function EditJobDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobOpening;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const update = useUpdateJob(job.id);
  const { data: companiesData } = useCompanyList({ limit: 100 });
  const companies = companiesData?.data ?? [];
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<{
    title: string;
    client_company_id: string;
    department?: string;
    location?: string;
    city?: string;
    state?: string;
    work_model: WorkModel;
    employment_type: EmploymentType;
    priority: JobPriority;
    status: JobStatus;
    openings_count: number;
    salary_min?: number;
    salary_max?: number;
    description?: string;
    requirements?: string;
    responsibilities?: string;
    benefits?: string;
    closing_date?: string;
  }>({
    defaultValues: {
      title: job.title ?? "",
      client_company_id: job.client_company_id ?? "",
      department: job.department ?? "",
      location: job.location ?? "",
      city: job.city ?? "",
      state: job.state ?? "",
      work_model: job.work_model ?? "presential",
      employment_type: job.employment_type ?? "clt",
      priority: job.priority ?? "medium",
      status: job.status ?? "open",
      openings_count: job.openings_count ?? 1,
      salary_min: job.salary_min ?? undefined,
      salary_max: job.salary_max ?? undefined,
      description: job.description ?? "",
      requirements: job.requirements ?? "",
      responsibilities: job.responsibilities ?? "",
      benefits: job.benefits ?? "",
      closing_date: job.closing_date ?? "",
    },
  });

  const selectedWorkModel = watch("work_model");
  const selectedEmploymentType = watch("employment_type");
  const selectedPriority = watch("priority");
  const selectedStatus = watch("status");
  const selectedCompany = watch("client_company_id");

  async function onSubmit(data: {
    title: string;
    client_company_id: string;
    department?: string;
    location?: string;
    city?: string;
    state?: string;
    work_model: WorkModel;
    employment_type: EmploymentType;
    priority: JobPriority;
    status: JobStatus;
    openings_count: number;
    salary_min?: number;
    salary_max?: number;
    description?: string;
    requirements?: string;
    responsibilities?: string;
    benefits?: string;
    closing_date?: string;
  }) {
    try {
      await update.mutateAsync({
        title: data.title,
        client_company_id: data.client_company_id,
        department: data.department || null,
        location: data.location || null,
        city: data.city || null,
        state: data.state || null,
        work_model: data.work_model,
        employment_type: data.employment_type,
        priority: data.priority,
        status: data.status,
        openings_count: Number(data.openings_count) || 1,
        salary_min: data.salary_min ? Number(data.salary_min) : null,
        salary_max: data.salary_max ? Number(data.salary_max) : null,
        description: data.description || null,
        requirements: data.requirements || null,
        responsibilities: data.responsibilities || null,
        benefits: data.benefits || null,
        closing_date: data.closing_date || null,
      });
      toast.success(t("Vaga atualizada com sucesso!"));
      onOpenChange(false);
    } catch {
      // erro tratado no hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Editar Vaga")}</DialogTitle>
          <DialogDescription>
            {t("Atualize as informações da vaga de recrutamento.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="edit-job-title">{t("Título da Vaga")} *</Label>
            <Input id="edit-job-title" required {...register("title", { required: true })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-job-company">{t("Empresa Cliente")} *</Label>
            <Select value={selectedCompany} onValueChange={(value) => setValue("client_company_id", value)}>
              <SelectTrigger id="edit-job-company">
                <SelectValue placeholder={t("Selecione a empresa contratante...")} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.trade_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-job-dept">{t("Departamento")}</Label>
              <Input id="edit-job-dept" {...register("department")} />
            </div>
            <div className="space-y-1">
              <Label>{t("Modelo de Trabalho")}</Label>
              <Select
                value={selectedWorkModel}
                onValueChange={(val) => setValue("work_model", val as WorkModel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presential">{t("Presencial")}</SelectItem>
                  <SelectItem value="hybrid">{t("Híbrido")}</SelectItem>
                  <SelectItem value="remote">{t("Remoto")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-job-city">{t("Cidade")}</Label>
              <Input id="edit-job-city" {...register("city")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-job-state">{t("UF")}</Label>
              <Input id="edit-job-state" maxLength={2} placeholder="PE" {...register("state")} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-job-location">{t("Local de Trabalho")}</Label>
            <Input id="edit-job-location" {...register("location")} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t("Tipo de Contratação")}</Label>
              <Select
                value={selectedEmploymentType}
                onValueChange={(val) => setValue("employment_type", val as EmploymentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">{t("CLT")}</SelectItem>
                  <SelectItem value="pj">{t("PJ")}</SelectItem>
                  <SelectItem value="internship">{t("Estágio")}</SelectItem>
                  <SelectItem value="temporary">{t("Temporário")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("Prioridade")}</Label>
              <Select
                value={selectedPriority}
                onValueChange={(val) => setValue("priority", val as JobPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("Baixa")}</SelectItem>
                  <SelectItem value="medium">{t("Média")}</SelectItem>
                  <SelectItem value="high">{t("Alta")}</SelectItem>
                  <SelectItem value="urgent">{t("Urgente")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("Status")}</Label>
              <Select
                value={selectedStatus}
                onValueChange={(val) => setValue("status", val as JobStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{t("Aberta")}</SelectItem>
                  <SelectItem value="draft">{t("Rascunho")}</SelectItem>
                  <SelectItem value="paused">{t("Pausada")}</SelectItem>
                  <SelectItem value="closed">{t("Fechada")}</SelectItem>
                  <SelectItem value="cancelled">{t("Cancelada")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-job-openings">{t("Quantidade de Vagas")}</Label>
              <Input
                id="edit-job-openings"
                type="number"
                min={1}
                {...register("openings_count", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-job-salary-min">{t("Salário Mínimo (R$)")}</Label>
              <Input
                id="edit-job-salary-min"
                type="number"
                step="any"
                {...register("salary_min")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-job-salary-max">{t("Salário Máximo (R$)")}</Label>
              <Input
                id="edit-job-salary-max"
                type="number"
                step="any"
                {...register("salary_max")}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-job-desc">{t("Descrição da Vaga")}</Label>
            <Textarea
              id="edit-job-desc"
              rows={3}
              {...register("description")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-job-reqs">{t("Requisitos e Qualificações")}</Label>
            <Textarea
              id="edit-job-reqs"
              rows={3}
              {...register("requirements")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-job-responsibilities">{t("Responsabilidades")}</Label>
            <Textarea
              id="edit-job-responsibilities"
              rows={3}
              {...register("responsibilities")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-job-benefits">{t("Benefícios")}</Label>
              <Textarea
                id="edit-job-benefits"
                rows={3}
                {...register("benefits")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-job-closing-date">{t("Data de Encerramento")}</Label>
              <Input id="edit-job-closing-date" type="date" {...register("closing_date")} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={isSubmitting || update.isPending}>
              {isSubmitting || update.isPending ? t("Salvando...") : t("Salvar Alterações")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
