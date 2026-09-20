"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCandidateList, useCreateApplication, useJobList } from "@/lib/people/client-hooks";
import type { VerticeCandidate, VerticeJobOpening } from "@/lib/people/types";
import { normalizePhoneBR } from "@/lib/ui/form-masks";
import { CandidateForm } from "@/components/recruitment/CandidateForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome sugerido para pré-preenchimento */
  initialName?: string | null;
  /** Telefone sugerido para pré-preenchimento */
  initialPhone?: string | null;
  /** ID do contato CRM (se originado do inbox) */
  contactId?: string | null;
  /** Vaga pré-selecionada (se houver) */
  initialJobId?: string | null;
  /** Callback após inscrição com sucesso */
  onSuccess?: () => void;
}

export function QuickRecruitmentDialog({
  open,
  onOpenChange,
  initialName,
  initialPhone,
  contactId,
  initialJobId,
  onSuccess,
}: Props) {
  const t = useT();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(initialJobId ?? "");

  const { data: jobsData, isLoading: jobsLoading } = useJobList({
    status: "open",
    limit: 100,
  });
  const openJobs = (jobsData?.data ?? []) as VerticeJobOpening[];

  const { data: candidatesData } = useCandidateList({ limit: 100 });
  const candidates = (candidatesData?.data ?? []) as VerticeCandidate[];
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId);

  const createApplication = useCreateApplication();

  useEffect(() => {
    if (!open) return;

    setSelectedJobId(initialJobId ?? "");
    setSelectedCandidateId("");

    const normalizedPhone = initialPhone ? normalizePhoneBR(initialPhone) : undefined;
    const match = candidates.find((candidate) => {
      if (contactId && candidate.contact_id === contactId) return true;
      if (
        normalizedPhone &&
        candidate.phone_e164 &&
        normalizePhoneBR(candidate.phone_e164) === normalizedPhone
      ) {
        return true;
      }
      return Boolean(
        initialName && candidate.full_name?.toLowerCase() === initialName.trim().toLowerCase(),
      );
    });

    if (match) {
      setSelectedCandidateId(match.id);
      setIsCreatingNew(false);
    } else {
      setIsCreatingNew(Boolean(initialName || initialPhone));
    }
  }, [candidates, contactId, initialJobId, initialName, initialPhone, open]);

  function beforeSubmit() {
    return selectedJobId ? null : "Selecione a vaga desejada.";
  }

  async function onCandidateSaved(candidate: VerticeCandidate, resumeId: string | null) {
    if (!selectedJobId) return;

    await createApplication.mutateAsync({
      job_opening_id: selectedJobId,
      candidate_id: candidate.id,
      stage: "received",
      source: "whatsapp",
      resume_id: resumeId,
      notes: candidate.notes?.trim() || "Inscrição via atendimento WhatsApp",
    });

    onSuccess?.();
    toast.success(t("Candidato inscrito no Funil de Seleção!"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Enviar para o Funil de Seleção")}</DialogTitle>
          <DialogDescription>
            {t("Inscreva este contato em uma vaga aberta para iniciar a triagem e avaliação.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="recruitment-job">{t("Vaga de Destino")} *</Label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobsLoading}>
            <SelectTrigger id="recruitment-job">
              <SelectValue
                placeholder={
                  jobsLoading ? t("Carregando vagas...") : t("Selecione a vaga aberta...")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {openJobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title} {job.department ? "· " + job.department : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between border-y py-2 text-xs">
          <span className="font-medium text-muted-foreground">
            {isCreatingNew
              ? t("Cadastrar novo perfil de candidato")
              : t("Vincular candidato existente")}
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs text-primary"
            onClick={() => setIsCreatingNew((current) => !current)}
          >
            {isCreatingNew ? t("Selecionar existente") : t("+ Criar novo candidato")}
          </Button>
        </div>

        {!isCreatingNew && (
          <div className="space-y-1">
            <Label htmlFor="recruitment-candidate">{t("Selecionar Candidato")} *</Label>
            <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
              <SelectTrigger id="recruitment-candidate">
                <SelectValue placeholder={t("Escolha um talento cadastrado...")} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.full_name}
                    {candidate.current_job_title ? " (" + candidate.current_job_title + ")" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isCreatingNew ? (
          <CandidateForm
            mode="create"
            open={open}
            initialName={initialName}
            initialPhone={initialPhone}
            contactId={contactId}
            source="whatsapp"
            beforeSubmit={beforeSubmit}
            onSaved={onCandidateSaved}
            onCancel={() => onOpenChange(false)}
            submitLabel={t("Inscrever no Funil de Seleção")}
          />
        ) : selectedCandidate ? (
          <CandidateForm
            mode="edit"
            open={open}
            candidate={selectedCandidate}
            beforeSubmit={beforeSubmit}
            onSaved={onCandidateSaved}
            onCancel={() => onOpenChange(false)}
            submitLabel={t("Inscrever no Funil de Seleção")}
          />
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t("Selecione um candidato para continuar ou crie um novo perfil.")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
