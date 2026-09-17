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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-1 rounded-md" />
          <Skeleton className="h-64 col-span-2 rounded-md" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-destructive font-medium">{t("Candidato não encontrado.")}</div>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/app/recrutamento/talentos">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                {t("Dossiê Profissional")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{candidate.full_name}</h1>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-medium">
                {t(STATUS_LABELS[candidate.status] ?? candidate.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {candidate.current_job_title ?? candidate.current_role ?? t("Sem cargo informado")} {candidate.current_company ? `• ${candidate.current_company}` : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setIsEditOpen(true)} className="gap-2 shrink-0 border-border hover:bg-accent/10">
          <PencilSimple className="h-4 w-4" />
          {t("Editar Candidato")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Painel Esquerdo: Dados de Contato e Perfil */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t("Informações Profissionais")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">{t("Área")}</span>
                <span className="font-medium">{candidate.area ?? "—"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Senioridade")}</span>
                <span className="font-medium capitalize">{candidate.seniority ?? "—"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Localização")}</span>
                <span className="font-medium">
                  {candidate.city && candidate.state ? `${candidate.city}, ${candidate.state}` : candidate.city ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Pretensão Salarial")}</span>
                <span className="font-medium">
                  {candidate.expected_salary ? `R$ ${candidate.expected_salary.toLocaleString(tagDoIdioma)}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{t("Disponibilidade")}</span>
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
                <EnvelopeSimple className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{candidate.email ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{candidate.phone_e164 ?? "—"}</span>
              </div>
              {candidate.linkedin_url && (
                <div className="flex items-center gap-2">
                  <LinkedinLogo className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={candidate.linkedin_url.startsWith("http") ? candidate.linkedin_url : `https://${candidate.linkedin_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    {t("Perfil no LinkedIn")}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel Direito: Currículos e Processos Seletivos */}
        <div className="md:col-span-2 space-y-6">
          {/* Currículos Anexados */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">{t("Currículos Anexados")}</CardTitle>
              <div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
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
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {t("Nenhum currículo anexado para este candidato.")}
                </div>
              ) : (
                <div className="divide-y border rounded-md overflow-hidden">
                  {resumes.map((r) => (
                    <div key={r.id} className="p-3.5 flex items-center justify-between hover:bg-muted/20">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{r.original_filename}</span>
                            {r.is_current && (
                              <Badge variant="outline" className="text-[10px] h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                {t("Atual")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex gap-2">
                            <span>{(r.file_size_bytes / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{new Date(r.created_at).toLocaleDateString(tagDoIdioma)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8 text-xs"
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
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {t("Candidato ainda não foi vinculado a nenhuma vaga aberta.")}
                </div>
              ) : (
                <div className="divide-y border rounded-md overflow-hidden">
                  {applications.map((app) => (
                    <div key={app.id} className="p-3.5 flex items-center justify-between hover:bg-muted/20">
                      <div>
                        <div className="font-medium text-sm">
                          {app.job_opening ? app.job_opening.title : t("Vaga vinculada")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {app.job_opening?.client_company?.trade_name ?? t("Empresa Cliente")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-normal text-xs">
                          {(() => {
                            const stageObj = RECRUITMENT_STAGES.find((s) => s.id === app.stage);
                            return stageObj ? stageObj.label.replace(/^\d+\s*/, '') : app.stage;
                          })()}
                        </Badge>
                        <Link href="/app/recrutamento/pipeline">
                          <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-accent/10 hover:text-primary">
                            {t("Ver no Funil de Seleção")}
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

function EditCandidateDialog({
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
        phone_e164: data.phone_e164 || null,
        linkedin_url: data.linkedin_url || null,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Editar Candidato")}</DialogTitle>
          <DialogDescription>
            {t("Atualize as informações do profissional.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="edit_full_name">{t("Nome Completo")} *</Label>
            <Input id="edit_full_name" required {...register("full_name", { required: true })} />
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
              <Input id="edit_email" type="email" {...register("email")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_phone">{t("Telefone / WhatsApp")}</Label>
              <Input id="edit_phone" {...register("phone_e164")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_current_job_title">{t("Cargo Atual")}</Label>
              <Input id="edit_current_job_title" {...register("current_job_title")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_current_company">{t("Empresa Atual")}</Label>
              <Input id="edit_current_company" {...register("current_company")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_area">{t("Área")}</Label>
              <Input id="edit_area" {...register("area")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_availability">{t("Disponibilidade")}</Label>
              <Input id="edit_availability" placeholder={t("ex: Imediata, 30 dias")} {...register("availability")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="edit_city">{t("Cidade")}</Label>
              <Input id="edit_city" {...register("city")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_state">{t("UF")}</Label>
              <Input id="edit_state" maxLength={2} {...register("state")} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit_expected_salary">{t("Pretensão Salarial")}</Label>
            <Input id="edit_expected_salary" type="number" step="100" {...register("expected_salary")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit_linkedin_url">{t("Perfil LinkedIn")}</Label>
            <Input id="edit_linkedin_url" {...register("linkedin_url")} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit_notes">{t("Observações")}</Label>
            <Input id="edit_notes" {...register("notes")} />
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
