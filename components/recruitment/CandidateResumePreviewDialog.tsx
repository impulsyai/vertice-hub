"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { VerticeCandidateResume } from "@/lib/people/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DownloadSimple, Eye, FileText, ArrowSquareOut } from "@/lib/ui/icons";

export type ResumePreviewTarget = Pick<
  VerticeCandidateResume,
  "id" | "original_filename" | "mime_type"
>;

interface Props {
  resume: ResumePreviewTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SignedResumeResponse {
  data: {
    url: string;
    filename: string;
    mime_type: string;
  };
}

interface PreviewContentProps {
  resume: ResumePreviewTarget;
  onOpenChange: (open: boolean) => void;
}

function ResumePreviewContent({ resume, onOpenChange }: PreviewContentProps) {
  const t = useT();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPdf =
    resume.mime_type.toLowerCase() === "application/pdf" ||
    resume.original_filename.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<SignedResumeResponse>(`/api/v1/people/resumes/${resume.id}/download?inline=1`)
      .then((response) => {
        if (!cancelled) setPreviewUrl(response.data.url);
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("Não foi possível gerar a visualização do currículo."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resume.id, t]);

  async function getSignedUrl(inline: boolean) {
    const suffix = inline ? "?inline=1" : "";
    const response = await apiClient.get<SignedResumeResponse>(
      `/api/v1/people/resumes/${resume.id}/download${suffix}`,
    );
    return response.data.url;
  }

  async function handleOpenInNewTab() {
    try {
      const url = previewUrl ?? (await getSignedUrl(true));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("Não foi possível abrir o currículo em uma nova aba."));
    }
  }

  async function handleDownload() {
    try {
      const url = await getSignedUrl(false);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.click();
    } catch {
      toast.error(t("Não foi possível baixar o currículo."));
    }
  }

  return (
    <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-8">
          <Eye className="h-5 w-5 text-primary" />
          {t("Visualizar Currículo")}
        </DialogTitle>
        <DialogDescription className="truncate pr-8" title={resume.original_filename}>
          {resume.original_filename}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/20">
        {isLoading ? (
          <div className="flex h-[min(68vh,720px)] items-center justify-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-5 w-5 animate-pulse" />
            {t("Gerando visualização segura...")}
          </div>
        ) : error ? (
          <div className="flex h-[min(68vh,720px)] items-center justify-center p-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : isPdf && previewUrl ? (
          <iframe
            src={previewUrl}
            title={resume.original_filename}
            className="h-[min(68vh,720px)] w-full bg-white"
          />
        ) : (
          <div className="flex h-[min(68vh,720px)] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <FileText className="h-10 w-10 text-primary/70" />
            <p>{t("A pré-visualização incorporada está disponível para arquivos PDF.")}</p>
            <p>{t("Use Abrir em nova aba ou Baixar arquivo original para este formato.")}</p>
          </div>
        )}
      </div>

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t("Fechar")}
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => void handleOpenInNewTab()}>
            <ArrowSquareOut className="h-4 w-4" />
            {t("Abrir em nova aba")}
          </Button>
          <Button type="button" onClick={() => void handleDownload()}>
            <DownloadSimple className="h-4 w-4" />
            {t("Baixar arquivo original")}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export function CandidateResumePreviewDialog({ resume, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && resume ? (
        <ResumePreviewContent
          key={`${resume.id}-${open}`}
          resume={resume}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}
