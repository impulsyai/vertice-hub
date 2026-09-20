"use client";

import { useEffect, useRef, useState } from "react";
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
import { createCandidateSchema } from "@/lib/people/schemas";
import {
  ESTADOS_BRASIL,
  formatFileSize,
  maskPhoneBR,
  normalizePhoneBR,
  normalizeUrl,
} from "@/lib/ui/form-masks";
import type { VerticeJobOpening, VerticeCandidate } from "@/lib/people/types";

interface FormValues {
  candidateId: string;
  jobId: string;
  fullName: string;
  phone: string;
  email: string;
  currentRole: string;
  currentCompany: string;
  area: string;
  seniority: string;
  city: string;
  state: string;
  expectedSalary?: number;
  availability: string;
  linkedinUrl: string;
  status: string;
  notes: string;
}

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;
const RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];

function defaultFormValues(
  initialName?: string | null,
  initialPhone?: string | null,
  initialJobId?: string | null,
): FormValues {
  return {
    candidateId: "",
    jobId: initialJobId ?? "",
    fullName: initialName ?? "",
    phone: initialPhone ? maskPhoneBR(initialPhone) : "",
    email: "",
    currentRole: "",
    currentCompany: "",
    area: "",
    seniority: "pleno",
    city: "",
    state: "",
    expectedSalary: undefined,
    availability: "",
    linkedinUrl: "",
    status: "active",
    notes: "",
  };
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
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

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
    setError,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: defaultFormValues(initialName, initialPhone, initialJobId),
  });

  const selectedCandidateId = watch("candidateId");
  const selectedJobId = watch("jobId");
  const selectedSeniority = watch("seniority");
  const selectedStatus = watch("status");
  const selectedState = watch("state");

  // Tentar encontrar candidato existente pelo telefone ou contactId
  useEffect(() => {
    if (!open) return;

    reset(defaultFormValues(initialName, initialPhone, initialJobId));
    setResumeFile(null);
    if (resumeInputRef.current) resumeInputRef.current.value = "";

    const normInitial = initialPhone ? normalizePhoneBR(initialPhone) : null;
    const match = candidates.find((c) => {
      if (contactId && c.contact_id === contactId) return true;
      if (normInitial && c.phone_e164 && normalizePhoneBR(c.phone_e164) === normInitial)
        return true;
      if (initialName && c.full_name?.toLowerCase() === initialName.trim().toLowerCase())
        return true;
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

  const fieldError = (field: keyof FormValues) => {
    const message = errors[field]?.message;
    return typeof message === "string" ? message : undefined;
  };

  const fieldClass = (field: keyof FormValues) =>
    fieldError(field) ? "border-red-500 focus-visible:ring-red-500" : undefined;

  function handleResumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setResumeFile(null);
      return;
    }

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!RESUME_EXTENSIONS.includes(extension)) {
      toast.error(t("Selecione um currículo em PDF, DOC ou DOCX."));
      event.target.value = "";
      setResumeFile(null);
      return;
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      toast.error(t("O currículo deve ter no máximo 10MB."));
      event.target.value = "";
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
  }

  async function uploadResume(file: File, candidateId: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("candidate_id", candidateId);

    const response = await fetch("/api/v1/people/resumes", {
      method: "POST",
      body: formData,
    });
    const body = (await response.json().catch(() => null)) as {
      data?: { id?: string };
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      throw new Error(body?.error?.message ?? t("Não foi possível anexar o currículo."));
    }

    const resumeId = body?.data?.id;
    if (!resumeId) {
      throw new Error(t("O currículo foi enviado, mas não retornou um registro válido."));
    }

    return resumeId;
  }

  async function onSubmit(data: FormValues) {
    if (!data.jobId) {
      toast.error(t("Selecione a vaga desejada."));
      return;
    }

    let finalCandidateId = data.candidateId;
    let resumeId: string | null = null;

    try {
      // Se optou por criar novo candidato na hora
      if (isCreatingNew || !finalCandidateId) {
        const payload = {
          full_name: data.fullName,
          email: data.email?.trim() || undefined,
          phone_e164: normalizePhoneBR(data.phone),
          linkedin_url: data.linkedinUrl?.trim() ? normalizeUrl(data.linkedinUrl) : undefined,
          current_job_title: data.currentRole?.trim() || undefined,
          current_company: data.currentCompany?.trim() || undefined,
          area: data.area?.trim() || undefined,
          seniority: data.seniority?.trim() || undefined,
          city: data.city?.trim() || undefined,
          state: data.state?.trim() || undefined,
          expected_salary: data.expectedSalary ? Number(data.expectedSalary) : undefined,
          availability: data.availability?.trim() || undefined,
          status: data.status || "active",
          source: "whatsapp",
          contact_id: contactId || null,
          notes: data.notes?.trim() || undefined,
        };
        const parsed = createCandidateSchema.safeParse(payload);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const field = issue.path[0];
            if (typeof field !== "string") continue;

            const formField: keyof FormValues =
              field === "full_name"
                ? "fullName"
                : field === "phone_e164"
                  ? "phone"
                  : field === "linkedin_url"
                    ? "linkedinUrl"
                    : field === "current_job_title"
                      ? "currentRole"
                      : field === "current_company"
                        ? "currentCompany"
                        : field === "expected_salary"
                          ? "expectedSalary"
                          : (field as keyof FormValues);
            setError(formField, { type: "validation", message: issue.message });
          }
          toast.error(parsed.error.issues[0]?.message ?? t("Dados inválidos"));
          return;
        }

        const candidate = await createCandidate.mutateAsync(parsed.data);
        finalCandidateId = candidate.id;
      }

      if (!finalCandidateId) {
        toast.error(t("Não foi possível identificar o candidato."));
        return;
      }

      // O currículo precisa ser registrado antes da candidatura para que a
      // vaga já aponte para o documento correto no dossiê.
      if (resumeFile) {
        resumeId = await uploadResume(resumeFile, finalCandidateId);
      }

      // Inscrever na vaga selecionada
      await createApplication.mutateAsync({
        job_opening_id: data.jobId,
        candidate_id: finalCandidateId,
        stage: "received",
        source: "whatsapp",
        resume_id: resumeId,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
                <SelectValue
                  placeholder={
                    jobsLoading ? t("Carregando vagas...") : t("Selecione a vaga aberta...")
                  }
                />
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
              {isCreatingNew
                ? t("Cadastrar novo perfil de candidato")
                : t("Vincular candidato existente")}
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
                  className={fieldClass("fullName")}
                  aria-invalid={!!fieldError("fullName")}
                  {...register("fullName", { required: t("Nome é obrigatório") })}
                />
                {fieldError("fullName") && (
                  <p className="text-xs text-red-600">{fieldError("fullName")}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cand-phone">{t("Telefone / WhatsApp")}</Label>
                  <Input
                    id="cand-phone"
                    placeholder="(81) 98888-7777"
                    className={fieldClass("phone")}
                    aria-invalid={!!fieldError("phone")}
                    {...register("phone", {
                      onChange: (e) => {
                        e.target.value = maskPhoneBR(e.target.value);
                      },
                      validate: (value) => {
                        if (!value) return true;
                        return (
                          /^\+\d{8,15}$/.test(normalizePhoneBR(value) ?? "") ||
                          t("Telefone inválido")
                        );
                      },
                    })}
                  />
                  {fieldError("phone") && (
                    <p className="text-xs text-red-600">{fieldError("phone")}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cand-email">{t("E-mail")}</Label>
                  <Input
                    id="cand-email"
                    type="email"
                    placeholder="candidato@email.com"
                    className={fieldClass("email")}
                    aria-invalid={!!fieldError("email")}
                    {...register("email")}
                  />
                  {fieldError("email") && (
                    <p className="text-xs text-red-600">{fieldError("email")}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cand-role">{t("Cargo Atual")}</Label>
                  <Input
                    id="cand-role"
                    placeholder={t("ex: Gerente de Operações")}
                    {...register("currentRole")}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cand-company">{t("Empresa Atual")}</Label>
                  <Input
                    id="cand-company"
                    placeholder={t("ex: Grupo Vértice")}
                    {...register("currentCompany")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cand-status">{t("Status")}</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(value) => setValue("status", value)}
                  >
                    <SelectTrigger id="cand-status" className="w-full">
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
                  <Label htmlFor="cand-seniority">{t("Senioridade")}</Label>
                  <Select
                    value={selectedSeniority}
                    onValueChange={(value) => setValue("seniority", value)}
                  >
                    <SelectTrigger id="cand-seniority" className="w-full">
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

              <div className="space-y-1">
                <Label htmlFor="cand-area">{t("Área")}</Label>
                <Input
                  id="cand-area"
                  placeholder={t("ex: Operações, Financeiro")}
                  {...register("area")}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="cand-city">{t("Cidade")}</Label>
                  <Input id="cand-city" placeholder={t("ex: Recife")} {...register("city")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cand-state">{t("UF")}</Label>
                  <Select
                    value={selectedState || ""}
                    onValueChange={(value) => setValue("state", value)}
                  >
                    <SelectTrigger id="cand-state" className="w-full">
                      <SelectValue placeholder={t("UF")} />
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cand-salary">{t("Pretensão Salarial")}</Label>
                  <Input
                    id="cand-salary"
                    type="number"
                    step="100"
                    placeholder="ex: 8500"
                    {...register("expectedSalary", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cand-availability">{t("Disponibilidade")}</Label>
                  <Input
                    id="cand-availability"
                    placeholder={t("ex: Imediata, 30 dias")}
                    {...register("availability")}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cand-linkedin">{t("Perfil LinkedIn")}</Label>
                <Input
                  id="cand-linkedin"
                  placeholder="linkedin.com/in/nome-perfil"
                  className={fieldClass("linkedinUrl")}
                  aria-invalid={!!fieldError("linkedinUrl")}
                  {...register("linkedinUrl")}
                />
                {fieldError("linkedinUrl") && (
                  <p className="text-xs text-red-600">{fieldError("linkedinUrl")}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="cand-notes">{t("Observações")}</Label>
            <Textarea
              id="cand-notes"
              rows={3}
              className={fieldClass("notes")}
              placeholder={t("Informações relevantes sobre perfil e entrevistas")}
              {...register("notes")}
            />
            {fieldError("notes") && <p className="text-xs text-red-600">{fieldError("notes")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cand-resume">{t("Currículo (opcional)")}</Label>
            <Input
              id="cand-resume"
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleResumeChange}
            />
            <p className="text-xs text-muted-foreground">
              {t("PDF, DOC ou DOCX até 10MB. A validação do conteúdo acontece no servidor.")}
            </p>
            {resumeFile && (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span className="min-w-0 truncate" title={resumeFile.name}>
                  {resumeFile.name} · {formatFileSize(resumeFile.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => {
                    setResumeFile(null);
                    if (resumeInputRef.current) resumeInputRef.current.value = "";
                  }}
                >
                  {t("Remover")}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
