"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { FileText, DownloadSimple, User, ArrowSquareOut } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { useResumeList } from "@/lib/people/client-hooks";

export function CurriculosClient() {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const { data, isLoading } = useResumeList();
  const resumes = data?.data ?? [];

  async function handleDownloadResume(resumeId: string) {
    try {
      const res = await apiClient.get<{ download_url: string }>(`/api/v1/people/resumes/${resumeId}/download`);
      window.open(res.download_url, "_blank");
    } catch {
      toast.error(t("Erro ao obter link para download do currículo."));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Currículos Recebidos")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Repositório seguro e versionado de arquivos de currículo (PDF/DOCX).")}
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-surface-muted p-4 mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("Nenhum currículo armazenado")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            {t("Os currículos são vinculados diretamente aos candidatos através da página do Banco de Talentos.")}
          </p>
          <Link href="/app/recrutamento/talentos">
            <Button variant="outline" className="gap-2">
              <User className="h-4 w-4" />
              {t("Ir para Banco de Talentos")}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
              <tr>
                <th className="p-4">{t("Arquivo")}</th>
                <th className="p-4">{t("Candidato")}</th>
                <th className="p-4">{t("Tamanho")}</th>
                <th className="p-4">{t("Origem")}</th>
                <th className="p-4">{t("Data")}</th>
                <th className="p-4">{t("Status")}</th>
                <th className="p-4 text-right">{t("Ação")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {resumes.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium">{r.original_filename}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/app/recrutamento/talentos/${r.candidate_id}`}
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>{t("Ver Dossiê")}</span>
                      <ArrowSquareOut className="h-3 w-3" />
                    </Link>
                  </td>
                  <td className="p-4 text-muted-foreground">{(r.file_size_bytes / 1024).toFixed(1)} KB</td>
                  <td className="p-4 text-muted-foreground capitalize">{r.source_type}</td>
                  <td className="p-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString(tagDoIdioma)}</td>
                  <td className="p-4">
                    {r.is_current ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                        {t("Atual")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t("Histórico")}</Badge>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => handleDownloadResume(r.id)}
                    >
                      <DownloadSimple className="h-3.5 w-3.5" />
                      {t("Download")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
