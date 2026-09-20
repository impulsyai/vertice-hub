"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import {
  ArrowLeft,
  FileText,
  DownloadSimple,
  Briefcase,
  EnvelopeSimple,
  Phone,
  LinkedinLogo,
  UploadSimple,
  PencilSimple,
} from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import { useCandidateDetail, useUpdateCandidate } from "@/lib/people/client-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { RECRUITMENT_STAGES, type VerticeCandidate } from "@/lib/people/types";
import {
  formatFileSize,
  maskPhoneBR,
  normalizePhoneBR,
  normalizeUrl,
  ESTADOS_BRASIL,
} from "@/lib/ui/form-masks";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  in_process: "Em Processo",
  hired: "Contratado",
  inactive: "Inativo",
  do_not_contact: "Não Contatar",
};

export function CandidatoDetalheClient({ id }: { id: string }) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const qc = useQueryClient();
  const { data, isLoading, error } = useCandidateDetail(id);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton className="col-span-1 h-64 rounded-md" />
          <Skeleton className="col-span-2 h-64 rounded-md" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="font-medium text-destructive">{t("Candidato não encontrado.")}</div>
        <Link href="/app/recrutamento/talentos">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("Voltar ao Banco de Talentos")}
          </Button>
        </Link>
      </div>
    );
  }

  const { candidate, resumes, applications } = data;

  async function handleDownloadResume(resumeId: string) {
    try {
      const response = await apiClient.get<{ data: { url: string } }>(
        `/api/v1/people/resumes/${resumeId}/download`,
      );
      window.open(response.data.url, "_blank");
    } catch {
      toast.error(t("Erro ao obter link para download do currículo."));
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("candidate_id", candidate.id);

      const res = await fetch("/api/v1/people/resumes", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro no upload" }));
        throw new Error(err.error || "Falha no envio");
      }

      toast.success(t("Currículo anexado com sucesso!"));
      qc.invalidateQueries({ queryKey: ["people-candidate-detail", candidate.id] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/recrutamento/talentos">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-primary uppercase">
                {t("Dossiê Profissional")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {candidate.full_name}
              </h1>
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 font-medium text-primary"
              >
                {t(STATUS_LABELS[candidate.status] ?? candidate.status)}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {candidate.current_job_title ?? candidate.current_role ?? t("Sem cargo informado")}{" "}
              {candidate.current_company ? `• ${candidate.current_company}` : ""}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsEditOpen(true)}
          className="shrink-0 gap-2 border-border hover:bg-accent/10"
        >
          <PencilSimple className="h-4 w-4" />
          {t("Editar Candidato")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Painel Esquerdo: Dados de Contato e Perfil */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {t("Informações Profissionais")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="block text-xs text-muted-foreground">{t("Área")}</span>
                <span className="font-medium">{candidate.area ?? "—"}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">{t("Senioridade")}</span>
                <span className="font-medium capitalize">{candidate.seniority ?? "—"}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">{t("Localização")}</span>
                <span className="font-medium">
                  {candidate.city && candidate.state
                    ? `${candidate.city}, ${candidate.state}`
                    : (candidate.city ?? "—")}
                </span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">
                  {t("Pretensão Salarial")}
                </span>
                <span className="font-medium">
                  {candidate.expected_salary
                    ? `R$ ${candidate.expected_salary.toLocaleString(tagDoIdioma)}`
                    : "—"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">{t("Disponibilidade")}</span>
                <span className="font-medium">{candidate.availability ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t("Contatos e Links")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <EnvelopeSimple className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{candidate.email ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{candidate.phone_e164 ?? "—"}</span>
              </div>
              {candidate.linkedin_url && (
                <div className="flex items-center gap-2">
                  <LinkedinLogo className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a
                    href={
                      candidate.linkedin_url.startsWith("http")
                        ? candidate.linkedin_url
                        : `https://${candidate.linkedin_url}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-primary hover:underline"
                  >
                    {t("Perfil no LinkedIn")}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel Direito: Currículos e Processos Seletivos */}
        <div className="space-y-6 md:col-span-2">
          {/* Currículos Anexados */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">{t("Currículos Anexados")}</CardTitle>
              <div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                    <UploadSimple className="h-3.5 w-3.5" />
                    {isUploading ? t("Enviando...") : t("Anexar Currículo")}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    disabled={isUploading}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {resumes.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  {t("Nenhum currículo anexado para este candidato.")}
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-md border">
                  {resumes.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col justify-between gap-3 p-3.5 hover:bg-muted/20 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-start gap-3 sm:items-center">
                        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:mt-0" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="max-w-[200px] truncate text-sm font-medium sm:max-w-[340px]"
                              title={r.original_filename}
                            >
                              {r.original_filename}
                            </span>
                            {r.is_current && (
                              <Badge
                                variant="outline"
                                className="h-4 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600"
                              >
                                {t("Atual")}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(r.file_size_bytes)}</span>
                            <span>•</span>
                            <span>{new Date(r.created_at).toLocaleDateString(tagDoIdioma)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full shrink-0 justify-center gap-1.5 text-xs sm:w-auto"
                        onClick={() => handleDownloadResume(r.id)}
                      >
                        <DownloadSimple className="h-3.5 w-3.5" />
                        {t("Download")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidaturas & Processos Seletivos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t("Processos Seletivos")}</CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Briefcase className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  {t("Candidato ainda não foi vinculado a nenhuma vaga aberta.")}
                </div>
              ) : (
                <div className="divide-y overflow-hidden rounded-md border">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="flex flex-col justify-between gap-3 p-3.5 hover:bg-muted/20 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {app.job_opening ? app.job_opening.title : t("Vaga vinculada")}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {app.job_opening?.client_company?.trade_name ?? t("Empresa Cliente")}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {(() => {
                            const stageObj = RECRUITMENT_STAGES.find((s) => s.id === app.stage);
                            return stageObj ? stageObj.label.replace(/^\d+\s*/, "") : app.stage;
                          })()}
                        </Badge>
                        <Link href={`/app/recrutamento/pipeline?job_id=${app.job_opening_id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs hover:bg-accent/10 hover:text-primary"
                          >
                            {t("Ver no Funil")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EditCandidateDialog
        key={candidate.id + (candidate.updated_at ?? "")}
        candidate={candidate}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </div>
  );
}

export function EditCandidateDialog({
  candidate,
  open,
  onOpenChange,
}: {
  candidate: VerticeCandidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const update = useUpdateCandidate(candidate.id);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<{
    full_name: string;
    email?: string;
    phone_e164?: string;
    linkedin_url?: string;
    current_job_title?: string;
    current_company?: string;
    area?: string;
    seniority?: string;
    city?: string;
    state?: string;
    expected_salary?: number;
    availability?: string;
    status?: string;
    notes?: string;
  }>({
    defaultValues: {
      full_name: candidate.full_name,
      email: candidate.email ?? "",
      phone_e164: candidate.phone_e164 ?? "",
      linkedin_url: candidate.linkedin_url ?? "",
      current_job_title: candidate.current_job_title ?? candidate.current_role ?? "",
      current_company: candidate.current_company ?? "",
      area: candidate.area ?? "",
      seniority: candidate.seniority ?? "pleno",
      city: candidate.city ?? "",
      state: candidate.state ?? "",
      expected_salary: candidate.expected_salary ?? undefined,
      availability: candidate.availability ?? "",
      status: candidate.status ?? "active",
      notes: candidate.notes ?? "",
    },
  });

  const currentSeniority = watch("seniority");
  const currentStatus = watch("status");
  const currentState = watch("state");

  async function onSubmit(data: {
    full_name: string;
    email?: string;
    phone_e164?: string;
    linkedin_url?: string;
    current_job_title?: string;
    current_company?: string;
    area?: string;
    seniority?: string;
    city?: string;
    state?: string;
    expected_salary?: number;
    availability?: string;
    status?: string;
    notes?: string;
  }) {
    try {
      await update.mutateAsync({
        full_name: data.full_name,
        email: data.email || null,
        phone_e164: data.phone_e164 ? normalizePhoneBR(data.phone_e164) : null,
        linkedin_url: data.linkedin_url ? normalizeUrl(data.linkedin_url) : null,
        current_job_title: data.current_job_title || null,
        current_company: data.current_company || null,
        area: data.area || null,
        seniority: data.seniority || null,
        city: data.city || null,
        state: data.state || null,
        expected_salary: data.expected_salary ? Number(data.expected_salary) : null,
        availability: data.availability || null,
        status: data.status,
        notes: data.notes || null,
      });
      toast.success(t("Candidato atualizado com sucesso!"));
      onOpenChange(false);
    } catch {
      // Toast já emitido pelo hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Editar Candidato")}</DialogTitle>
          <DialogDescription>{t("Atualize as informações do profissional.")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="edit_full_name">{t("Nome Completo *")}</Label>
            <Input id="edit_full_name" required {...register("full_name")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_status">{t("Status")}</Label>
              <Select value={currentStatus} onValueChange={(val) => setValue("status", val)}>
                <SelectTrigger id="edit_status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("Ativo")}</SelectItem>
                  <SelectItem value="in_process">{t("Em Processo")}</SelectItem>
                  <SelectItem value="hired">{t("Contratado")}</SelectItem>
                  <SelectItem value="inactive">{t("Inativo")}</SelectItem>
                  <SelectItem value="do_not_contact">{t("Não Contatar")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_seniority">{t("Senioridade")}</Label>
              <Select value={currentSeniority} onValueChange={(val) => setValue("seniority", val)}>
                <SelectTrigger id="edit_seniority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">{t("Júnior")}</SelectItem>
                  <SelectItem value="pleno">{t("Pleno")}</SelectItem>
                  <SelectItem value="senior">{t("Sênior")}</SelectItem>
                  <SelectItem value="especialista">{t("Especialista")}</SelectItem>
                  <SelectItem value="lead">{t("Coordenação")}</SelectItem>
                  <SelectItem value="director">{t("Gerência")}</SelectItem>
                  <SelectItem value="c_level">{t("Diretoria / C-Level")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_email">{t("E-mail")}</Label>
              <Input
                id="edit_email"
                type="email"
                placeholder="candidato@empresa.com"
                {...register("email")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_phone">{t("Telefone / WhatsApp")}</Label>
              <Input
                id="edit_phone"
                placeholder="(81) 99584-8588"
                {...register("phone_e164", {
                  onChange: (e) => {
                    e.target.value = maskPhoneBR(e.target.value);
                  },
                })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_current_job_title">{t("Cargo Atual")}</Label>
              <Input
                id="edit_current_job_title"
                placeholder={t("ex: Gerente de Operações")}
                {...register("current_job_title")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_current_company">{t("Empresa Atual")}</Label>
              <Input
                id="edit_current_company"
                placeholder={t("ex: Grupo Vértice")}
                {...register("current_company")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_area">{t("Área")}</Label>
              <Input id="edit_area" placeholder="ex: Recursos Humanos" {...register("area")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_availability">{t("Disponibilidade")}</Label>
              <Input
                id="edit_availability"
                placeholder={t("ex: Imediata, 30 dias")}
                {...register("availability")}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="edit_city">{t("Cidade")}</Label>
              <Input id="edit_city" placeholder="Recife" {...register("city")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_state">{t("UF")}</Label>
              <Select value={currentState || ""} onValueChange={(val) => setValue("state", val)}>
                <SelectTrigger id="edit_state" className="w-full">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {ESTADOS_BRASIL.map((uf) => (
                    <SelectItem key={uf.sigla} value={uf.sigla}>
                      {uf.sigla} - {uf.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit_expected_salary">{t("Pretensão Salarial")}</Label>
            <Input
              id="edit_expected_salary"
              type="number"
              step="100"
              placeholder="ex: 8500"
              {...register("expected_salary")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit_linkedin_url">{t("Perfil LinkedIn")}</Label>
            <Input
              id="edit_linkedin_url"
              placeholder="linkedin.com/in/nome-perfil"
              {...register("linkedin_url")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit_notes">{t("Observações")}</Label>
            <Input
              id="edit_notes"
              placeholder={t("Informações relevantes sobre perfil e entrevistas")}
              {...register("notes")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("Salvando...") : t("Salvar Alterações")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
