"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useJobList,
  useCandidateList,
  useCreateCandidate,
  useCreateApplication,
} from "@/lib/people/client-hooks";
import { maskPhoneBR, normalizePhoneBR } from "@/lib/ui/form-masks";
import type { VerticeJobOpening, VerticeCandidate } from "@/lib/people/types";

interface FormValues {
  candidateId: string;
  jobId: string;
  fullName: string;
  phone: string;
  email: string;
  currentRole: string;
  notes: string;
}

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

  // Vagas abertas para seleção
  const { data: jobsData, isLoading: jobsLoading } = useJobList({ status: "open", limit: 100 });
  const openJobs = (jobsData?.data ?? []) as VerticeJobOpening[];

  // Candidatos existentes no banco de talentos
  const { data: candidatesData } = useCandidateList({ limit: 100 });
  const candidates = (candidatesData?.data ?? []) as VerticeCandidate[];

  const createCandidate = useCreateCandidate();
  const createApplication = useCreateApplication();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      candidateId: "",
      jobId: initialJobId ?? "",
      fullName: initialName ?? "",
      phone: initialPhone ? maskPhoneBR(initialPhone) : "",
      email: "",
      currentRole: "",
      notes: "",
    },
  });

  const selectedCandidateId = watch("candidateId");
  const selectedJobId = watch("jobId");

  // Tentar encontrar candidato existente pelo telefone ou contactId
  useEffect(() => {
    if (!open) return;

    reset({
      candidateId: "",
      jobId: initialJobId ?? "",
      fullName: initialName ?? "",
      phone: initialPhone ? maskPhoneBR(initialPhone) : "",
      email: "",
      currentRole: "",
      notes: "",
    });

    const normInitial = initialPhone ? normalizePhoneBR(initialPhone) : null;
    const match = candidates.find((c) => {
      if (contactId && c.contact_id === contactId) return true;
      if (normInitial && c.phone_e164 && normalizePhoneBR(c.phone_e164) === normInitial) return true;
      if (initialName && c.full_name?.toLowerCase() === initialName.trim().toLowerCase()) return true;
      return false;
    });

    if (match) {
      setValue("candidateId", match.id);
      setIsCreatingNew(false);
    } else if (initialName || initialPhone) {
      setIsCreatingNew(true);
    } else {
      setIsCreatingNew(false);
    }
  }, [open, initialName, initialPhone, contactId, initialJobId, candidates, reset, setValue]);

  async function onSubmit(data: FormValues) {
    if (!data.jobId) {
      toast.error(t("Selecione a vaga desejada."));
      return;
    }

    let finalCandidateId = data.candidateId;

    try {
      // Se optou por criar novo candidato na hora
      if (isCreatingNew || !finalCandidateId) {
        if (!data.fullName?.trim()) {
          toast.error(t("Nome do candidato é obrigatório."));
          return;
        }

        const phoneNorm = data.phone ? normalizePhoneBR(data.phone) : null;

        const candidateRes = await createCandidate.mutateAsync({
          full_name: data.fullName.trim(),
          phone_e164: phoneNorm,
          email: data.email?.trim() || null,
          current_job_title: data.currentRole?.trim() || null,
          contact_id: contactId || null,
          source: "whatsapp",
          notes: data.notes?.trim() || null,
        });

        // @ts-expect-error unwrap envelope
        finalCandidateId = candidateRes?.id || candidateRes?.data?.id;
      }

      if (!finalCandidateId) {
        toast.error(t("Não foi possível identificar o candidato."));
        return;
      }

      // Inscrever na vaga selecionada
      await createApplication.mutateAsync({
        job_opening_id: data.jobId,
        candidate_id: finalCandidateId,
        stage: "received",
        notes: data.notes?.trim() || "Inscrição via atendimento WhatsApp",
      });

      toast.success(t("Candidato inscrito no Funil de Seleção!"));
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("Erro ao vincular candidato");
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Enviar para o Funil de Seleção")}</DialogTitle>
          <DialogDescription>
            {t("Inscreva este contato em uma vaga aberta para iniciar a triagem e avaliação.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Seleção da Vaga */}
          <div className="space-y-1">
            <Label htmlFor="recruitment-job">{t("Vaga de Destino")} *</Label>
            <Select
              value={selectedJobId}
              onValueChange={(val) => setValue("jobId", val)}
              disabled={jobsLoading}
            >
              <SelectTrigger id="recruitment-job">
                <SelectValue placeholder={jobsLoading ? t("Carregando vagas...") : t("Selecione a vaga aberta...")} />
              </SelectTrigger>
              <SelectContent>
                {openJobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title} {job.department ? `· ${job.department}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toggle entre usar existente ou cadastrar novo */}
          <div className="flex items-center justify-between border-y py-2 text-xs">
            <span className="font-medium text-muted-foreground">
              {isCreatingNew ? t("Cadastrar novo perfil de candidato") : t("Vincular candidato existente")}
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-primary"
              onClick={() => setIsCreatingNew((prev) => !prev)}
            >
              {isCreatingNew ? t("Selecionar existente") : t("+ Criar novo candidato")}
            </Button>
          </div>

          {!isCreatingNew ? (
            <div className="space-y-1">
              <Label>{t("Selecionar Candidato")} *</Label>
              <Select
                value={selectedCandidateId}
                onValueChange={(val) => setValue("candidateId", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Escolha um talento cadastrado...")} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} {c.current_job_title ? `(${c.current_job_title})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cand-fullname">{t("Nome Completo")} *</Label>
                <Input
                  id="cand-fullname"
                  required
                  placeholder={t("Nome do profissional")}
                  {...register("fullName", { required: true })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cand-phone">{t("Telefone / WhatsApp")}</Label>
                  <Input
                    id="cand-phone"
                    placeholder="(81) 98888-7777"
                    {...register("phone", {
                      onChange: (e) => {
                        e.target.value = maskPhoneBR(e.target.value);
                      },
                    })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cand-email">{t("E-mail")}</Label>
                  <Input
                    id="cand-email"
                    type="email"
                    placeholder="candidato@email.com"
                    {...register("email")}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cand-role">{t("Cargo Atual / Pretendido")}</Label>
                <Input
                  id="cand-role"
                  placeholder={t("ex: Gerente de Operações, Analista...")}
                  {...register("currentRole")}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="cand-notes">{t("Observações da Triagem")}</Label>
            <Textarea
              id="cand-notes"
              rows={2}
              placeholder={t("Resumo do interesse, pretensão salarial ou impressão inicial...")}
              {...register("notes")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("Cancelar")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedJobId || (!isCreatingNew && !selectedCandidateId)}
            >
              {isSubmitting ? t("Enviando ao Funil...") : t("Inscrever no Funil de Seleção")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
