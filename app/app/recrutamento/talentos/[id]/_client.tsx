"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import {
  ArrowLeft,
  FileText,
  DownloadSimple,
  Eye,
  Briefcase,
  EnvelopeSimple,
  Phone,
  LinkedinLogo,
  UploadSimple,
  PencilSimple,
  ChatCircle,
  IdentificationCard,
  Trash,
} from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { useCandidateDetail, useCandidateTimeline } from "@/lib/people/client-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { RECRUITMENT_STAGES } from "@/lib/people/types";
import { formatFileSize } from "@/lib/ui/form-masks";
import { CandidateFormDialog } from "@/components/recruitment/CandidateForm";
import { DeleteCandidateDialog } from "@/components/recruitment/DeleteCandidateDialog";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  CandidateResumePreviewDialog,
  type ResumePreviewTarget,
} from "@/components/recruitment/CandidateResumePreviewDialog";
import { CandidateTimeline } from "@/components/recruitment/CandidateTimeline";
import { CandidateOpinionReportButton } from "@/components/recruitment/CandidateOpinionReportButton";

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
  const router = useRouter();
  const { user, activeOrg } = useAuth();
  const { data, isLoading, error } = useCandidateDetail(id);
  const { data: timelineEvents = [] } = useCandidateTimeline(id);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isOpeningConversation, setIsOpeningConversation] = useState(false);
  const [resumeToPreview, setResumeToPreview] = useState<ResumePreviewTarget | null>(null);
  const canDeleteCandidate = Boolean(
    user.is_platform_admin || (activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager),
  );

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

  const { candidate, resumes, applications, contactContext } = data;

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
      qc.invalidateQueries({ queryKey: ["people-candidate-timeline", candidate.id] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  async function handleOpenConversation() {
    if (isOpeningConversation || (!candidate.phone_e164 && !contactContext?.contact_id)) return;
    try {
      setIsOpeningConversation(true);
      const response = await apiClient.post<{
        data: { conversation_id: string };
      }>(`/api/v1/people/candidates/${candidate.id}/conversation`, {});
      router.push(`/app/inbox?conversation=${encodeURIComponent(response.data.conversation_id)}`);
    } catch {
      toast.error(t("Não foi possível abrir a conversa no WhatsApp."));
    } finally {
      setIsOpeningConversation(false);
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CandidateOpinionReportButton
            candidate={candidate}
            applications={applications}
            resumes={resumes}
            events={timelineEvents}
          />
          <Button
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="gap-2 border-border hover:bg-accent/10"
          >
            <PencilSimple className="h-4 w-4" />
            {t("Editar Candidato")}
          </Button>
          {canDeleteCandidate && (
            <Button variant="destructive" onClick={() => setIsDeleteOpen(true)} className="gap-2">
              <Trash className="h-4 w-4" />
              {t("Excluir Candidato")}
            </Button>
          )}
        </div>
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
              <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  disabled={
                    isOpeningConversation || (!candidate.phone_e164 && !contactContext?.contact_id)
                  }
                  onClick={() => void handleOpenConversation()}
                >
                  <ChatCircle className="h-4 w-4" />
                  {isOpeningConversation ? t("Abrindo...") : t("Abrir conversa no Inbox")}
                </Button>
                {contactContext?.contact_id && (
                  <Button type="button" variant="outline" size="sm" asChild className="gap-1.5">
                    <Link href={`/app/contacts/${contactContext.contact_id}`}>
                      <IdentificationCard className="h-4 w-4" />
                      {t("Ver Ficha do Contato")}
                    </Link>
                  </Button>
                )}
              </div>
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
                      <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          title={t("Visualizar Currículo")}
                          aria-label={t("Visualizar Currículo")}
                          onClick={() => setResumeToPreview(r)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 justify-center gap-1.5 text-xs sm:flex-none"
                          onClick={() => handleDownloadResume(r.id)}
                        >
                          <DownloadSimple className="h-3.5 w-3.5" />
                          {t("Download")}
                        </Button>
                      </div>
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
                          {app.job_opening?.title ?? app.job?.title ?? t("Vaga vinculada")}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {app.job_opening?.client_company?.trade_name ??
                            app.job_opening?.company?.trade_name ??
                            app.job?.client_company?.trade_name ??
                            app.job?.company?.trade_name ??
                            t("Empresa Cliente")}
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
          <CandidateTimeline
            key={candidate.id + (candidate.updated_at ?? "")}
            candidate={candidate}
            resumes={resumes}
            applications={applications}
            events={timelineEvents}
          />
        </div>
      </div>

      <CandidateFormDialog
        mode="edit"
        key={candidate.id + (candidate.updated_at ?? "")}
        candidate={candidate}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
      <DeleteCandidateDialog
        candidate={candidate}
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onDeleted={() => router.push("/app/recrutamento/talentos")}
      />
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
