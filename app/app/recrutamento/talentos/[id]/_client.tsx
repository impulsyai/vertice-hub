"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import {
  User,
  ArrowLeft,
  FileText,
  DownloadSimple,
  Briefcase,
  EnvelopeSimple,
  Phone,
  LinkedinLogo,
  UploadSimple,
  CheckCircle,
} from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { useCandidateDetail } from "@/lib/people/client-hooks";
import { useQueryClient } from "@tanstack/react-query";

export function CandidatoDetalheClient({ id }: { id: string }) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const qc = useQueryClient();
  const { data, isLoading, error } = useCandidateDetail(id);
  const [isUploading, setIsUploading] = useState(false);

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
      const res = await apiClient.get<{ download_url: string }>(`/api/v1/people/resumes/${resumeId}/download`);
      window.open(res.download_url, "_blank");
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
      <div className="flex items-center gap-4">
        <Link href="/app/recrutamento/talentos">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{candidate.full_name}</h1>
            <Badge variant="outline" className="capitalize">{candidate.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {candidate.current_job_title ?? candidate.current_role ?? t("Sem cargo informado")} {candidate.current_company ? `• ${candidate.current_company}` : ""}
          </p>
        </div>
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
                        <Badge variant="secondary" className="capitalize">
                          {app.stage.replace("_", " ")}
                        </Badge>
                        <Link href="/app/recrutamento/pipeline">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            {t("Ver no Pipeline")}
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
    </div>
  );
}
