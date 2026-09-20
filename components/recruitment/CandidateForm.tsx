"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateCandidate, useUpdateCandidate } from "@/lib/people/client-hooks";
import { createCandidateSchema, updateCandidateSchema } from "@/lib/people/schemas";
import type { VerticeCandidate } from "@/lib/people/types";
import {
  ESTADOS_BRASIL,
  formatFileSize,
  maskPhoneBR,
  normalizePhoneBR,
  normalizeUrl,
} from "@/lib/ui/form-masks";

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;
const RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];

export interface CandidateFormValues {
  full_name: string;
  email: string;
  phone_e164: string;
  current_job_title: string;
  current_company: string;
  area: string;
  seniority: string;
  city: string;
  state: string;
  expected_salary?: number;
  availability: string;
  linkedin_url: string;
  status: string;
  notes: string;
}

export interface CandidateFormProps {
  mode: "create" | "edit";
  open: boolean;
  candidate?: VerticeCandidate | null;
  initialName?: string | null;
  initialPhone?: string | null;
  contactId?: string | null;
  source?: string;
  beforeSubmit?: () => string | null;
  onSaved?: (candidate: VerticeCandidate, resumeId: string | null) => void | Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

function valuesFromCandidate(
  candidate?: VerticeCandidate | null,
  initialName?: string | null,
  initialPhone?: string | null,
): CandidateFormValues {
  return {
    full_name: candidate?.full_name ?? initialName ?? "",
    email: candidate?.email ?? "",
    phone_e164: candidate?.phone_e164
      ? maskPhoneBR(candidate.phone_e164)
      : initialPhone
        ? maskPhoneBR(initialPhone)
        : "",
    current_job_title: candidate?.current_job_title ?? candidate?.current_role ?? "",
    current_company: candidate?.current_company ?? "",
    area: candidate?.area ?? "",
    seniority: candidate?.seniority ?? "pleno",
    city: candidate?.city ?? "",
    state: candidate?.state ?? "",
    expected_salary: candidate?.expected_salary ?? undefined,
    availability: candidate?.availability ?? "",
    linkedin_url: candidate?.linkedin_url ?? "",
    status: candidate?.status ?? "active",
    notes: candidate?.notes ?? "",
  };
}

async function uploadResume(file: File, candidateId: string, t: (text: string) => string) {
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

export function CandidateForm({
  mode,
  open,
  candidate,
  initialName,
  initialPhone,
  contactId,
  source = "manual",
  beforeSubmit,
  onSaved,
  onCancel,
  submitLabel,
}: CandidateFormProps) {
  const t = useT();
  const create = useCreateCandidate();
  const update = useUpdateCandidate(candidate?.id ?? "");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CandidateFormValues>({
    defaultValues: valuesFromCandidate(candidate, initialName, initialPhone),
  });

  const selectedSeniority = watch("seniority");
  const selectedStatus = watch("status");
  const selectedState = watch("state");
  const pending = isSubmitting || create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    reset(valuesFromCandidate(candidate, initialName, initialPhone));
    setResumeFile(null);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  }, [candidate, initialName, initialPhone, open, reset]);

  function fieldError(field: keyof CandidateFormValues) {
    const message = errors[field]?.message;
    return typeof message === "string" ? message : undefined;
  }

  function fieldClass(field: keyof CandidateFormValues) {
    return fieldError(field) ? "border-red-500 focus-visible:ring-red-500" : undefined;
  }

  function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
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

  async function onSubmit(data: CandidateFormValues) {
    const preSubmitError = beforeSubmit?.();
    if (preSubmitError) {
      toast.error(t(preSubmitError));
      return;
    }
    if (mode === "edit" && !candidate) {
      toast.error(t("Não foi possível identificar o candidato."));
      return;
    }

    const expectedSalary =
      typeof data.expected_salary === "number" &&
      Number.isFinite(data.expected_salary) &&
      data.expected_salary > 0
        ? data.expected_salary
        : undefined;
    const payload = {
      full_name: data.full_name,
      email: data.email?.trim() || undefined,
      phone_e164: normalizePhoneBR(data.phone_e164),
      linkedin_url: data.linkedin_url?.trim() ? normalizeUrl(data.linkedin_url) : undefined,
      current_job_title: data.current_job_title?.trim() || undefined,
      current_company: data.current_company?.trim() || undefined,
      area: data.area?.trim() || undefined,
      seniority: data.seniority?.trim() || undefined,
      city: data.city?.trim() || undefined,
      state: data.state?.trim() || undefined,
      expected_salary: expectedSalary,
      availability: data.availability?.trim() || undefined,
      status: data.status || "active",
      notes: data.notes?.trim() || undefined,
      ...(mode === "create" ? { source, contact_id: contactId || null } : {}),
    };
    const parsed = (mode === "create" ? createCandidateSchema : updateCandidateSchema).safeParse(
      payload,
    );

    if (!parsed.success) {
      const fieldMap: Record<string, keyof CandidateFormValues | undefined> = {
        full_name: "full_name",
        email: "email",
        phone_e164: "phone_e164",
        linkedin_url: "linkedin_url",
        current_job_title: "current_job_title",
        current_company: "current_company",
        area: "area",
        seniority: "seniority",
        city: "city",
        state: "state",
        expected_salary: "expected_salary",
        availability: "availability",
        status: "status",
        notes: "notes",
      };
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field !== "string" || !fieldMap[field]) continue;
        setError(fieldMap[field]!, { type: "validation", message: issue.message });
      }
      toast.error(parsed.error.issues[0]?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      const saved =
        mode === "create"
          ? await create.mutateAsync(parsed.data)
          : await update.mutateAsync(parsed.data);
      const resumeId = resumeFile ? await uploadResume(resumeFile, saved.id, t) : null;
      await onSaved?.(saved, resumeId);
      toast.success(
        t(
          mode === "create"
            ? "Candidato cadastrado com sucesso!"
            : "Candidato atualizado com sucesso!",
        ),
      );
      reset(valuesFromCandidate(candidate, initialName, initialPhone));
      setResumeFile(null);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      onCancel();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("Não foi possível salvar o candidato.");
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
      <div className="space-y-1">
        <Label htmlFor="candidate-full-name">{t("Nome Completo")} *</Label>
        <Input
          id="candidate-full-name"
          required
          placeholder={t("ex: Carlos Eduardo Silva")}
          className={fieldClass("full_name")}
          aria-invalid={!!fieldError("full_name")}
          {...register("full_name", { required: t("Nome é obrigatório") })}
        />
        {fieldError("full_name") && (
          <p className="text-xs text-red-600">{fieldError("full_name")}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="candidate-email">{t("E-mail")}</Label>
          <Input
            id="candidate-email"
            type="email"
            placeholder="candidato@email.com"
            className={fieldClass("email")}
            aria-invalid={!!fieldError("email")}
            {...register("email", {
              validate: (value) =>
                !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || t("E-mail inválido"),
            })}
          />
          {fieldError("email") && <p className="text-xs text-red-600">{fieldError("email")}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="candidate-phone">{t("Telefone / WhatsApp")}</Label>
          <Input
            id="candidate-phone"
            placeholder="(81) 98888-7777"
            className={fieldClass("phone_e164")}
            aria-invalid={!!fieldError("phone_e164")}
            {...register("phone_e164", {
              onChange: (event) => {
                event.target.value = maskPhoneBR(event.target.value);
              },
              validate: (value) =>
                !value ||
                /^\+\d{8,15}$/.test(normalizePhoneBR(value) ?? "") ||
                t("Telefone inválido"),
            })}
          />
          {fieldError("phone_e164") && (
            <p className="text-xs text-red-600">{fieldError("phone_e164")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="candidate-role">{t("Cargo Atual")}</Label>
          <Input
            id="candidate-role"
            placeholder={t("ex: Gerente de Operações")}
            {...register("current_job_title")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="candidate-company">{t("Empresa Atual")}</Label>
          <Input
            id="candidate-company"
            placeholder={t("ex: Grupo Vértice")}
            {...register("current_company")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="candidate-status">{t("Status")}</Label>
          <Select
            value={selectedStatus}
            onValueChange={(value) => setValue("status", value, { shouldDirty: true })}
          >
            <SelectTrigger id="candidate-status" className="w-full">
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
          <Label htmlFor="candidate-seniority">{t("Senioridade")}</Label>
          <Select
            value={selectedSeniority}
            onValueChange={(value) => setValue("seniority", value, { shouldDirty: true })}
          >
            <SelectTrigger id="candidate-seniority" className="w-full">
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
        <Label htmlFor="candidate-area">{t("Área")}</Label>
        <Input
          id="candidate-area"
          placeholder={t("ex: Operações, Financeiro")}
          {...register("area")}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="candidate-city">{t("Cidade")}</Label>
          <Input id="candidate-city" placeholder={t("ex: Recife")} {...register("city")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="candidate-state">{t("UF")}</Label>
          <Select
            value={selectedState || ""}
            onValueChange={(value) => setValue("state", value, { shouldDirty: true })}
          >
            <SelectTrigger id="candidate-state" className="w-full">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="candidate-salary">{t("Pretensão Salarial")}</Label>
          <Input
            id="candidate-salary"
            type="number"
            step="100"
            placeholder="ex: 8500"
            {...register("expected_salary", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="candidate-availability">{t("Disponibilidade")}</Label>
          <Input
            id="candidate-availability"
            placeholder={t("ex: Imediata, 30 dias")}
            {...register("availability")}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="candidate-linkedin">{t("Perfil LinkedIn")}</Label>
        <Input
          id="candidate-linkedin"
          placeholder="linkedin.com/in/nome-perfil"
          className={fieldClass("linkedin_url")}
          aria-invalid={!!fieldError("linkedin_url")}
          {...register("linkedin_url")}
        />
        {fieldError("linkedin_url") && (
          <p className="text-xs text-red-600">{fieldError("linkedin_url")}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="candidate-notes">{t("Observações")}</Label>
        <Textarea
          id="candidate-notes"
          rows={3}
          placeholder={t("Informações relevantes sobre perfil e entrevistas")}
          className={fieldClass("notes")}
          aria-invalid={!!fieldError("notes")}
          {...register("notes")}
        />
        {fieldError("notes") && <p className="text-xs text-red-600">{fieldError("notes")}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="candidate-resume">{t("Currículo (opcional)")}</Label>
        <Input
          id="candidate-resume"
          ref={resumeInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          disabled={pending}
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
              disabled={pending}
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t("Cancelar")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? t("Salvando...")
            : (submitLabel ?? t(mode === "create" ? "Cadastrar Candidato" : "Salvar Alterações"))}
        </Button>
      </DialogFooter>
    </form>
  );
}

export interface CandidateFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: VerticeCandidate | null;
  initialName?: string | null;
  initialPhone?: string | null;
  contactId?: string | null;
  source?: string;
  beforeSubmit?: () => string | null;
  title?: string;
  description?: string;
  onSaved?: (candidate: VerticeCandidate, resumeId: string | null) => void | Promise<void>;
}

export function CandidateFormDialog({
  mode,
  open,
  onOpenChange,
  candidate,
  initialName,
  initialPhone,
  contactId,
  source,
  beforeSubmit,
  title,
  description,
  onSaved,
}: CandidateFormDialogProps) {
  const t = useT();
  const dialogTitle = title ?? t(mode === "create" ? "Novo Candidato" : "Editar Candidato");
  const dialogDescription =
    description ??
    t(
      mode === "create"
        ? "Cadastre as informações do talento."
        : "Atualize as informações do profissional.",
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <CandidateForm
          mode={mode}
          open={open}
          candidate={candidate}
          initialName={initialName}
          initialPhone={initialPhone}
          contactId={contactId}
          source={source}
          beforeSubmit={beforeSubmit}
          onSaved={onSaved}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
