"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { ESTADOS_BRASIL, maskPhoneBR, normalizePhoneBR, normalizeUrl } from "@/lib/ui/form-masks";
import { createCandidateSchema } from "@/lib/people/schemas";
import { User, Plus, MagnifyingGlass, ArrowSquareOut } from "@/lib/ui/icons";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCandidateList, useCreateCandidate } from "@/lib/people/client-hooks";
import type { CandidateStatus, VerticeCandidate } from "@/lib/people/types";
import { EditCandidateDialog } from "@/app/app/recrutamento/talentos/[id]/_client";

const STATUS_LABELS: Record<CandidateStatus, string> = {
  active: "Ativo",
  in_process: "Em Processo",
  hired: "Contratado",
  inactive: "Inativo",
  do_not_contact: "Não Contatar",
};

export function TalentosClient() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [seniority, setSeniority] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<VerticeCandidate | null>(null);

  const { data, isLoading } = useCandidateList({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    seniority: seniority !== "all" ? seniority : undefined,
    page,
    limit: 25,
  });

  const candidates = data?.data ?? [];
  const pagination = data?.pagination;

  const router = useRouter();

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Banco de Talentos")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Repositório central de candidatos profissionais e executivos.")}
          </p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          {t("Novo Candidato")}
        </Button>
      </header>

      {/* Barra de Filtros Responsiva */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Buscar por nome, cargo ou empresa...")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 w-full"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Select
            value={status}
            onValueChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={t("Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos os status")}</SelectItem>
              <SelectItem value="active">{t("Ativo")}</SelectItem>
              <SelectItem value="in_process">{t("Em Processo")}</SelectItem>
              <SelectItem value="hired">{t("Contratado")}</SelectItem>
              <SelectItem value="inactive">{t("Inativo")}</SelectItem>
              <SelectItem value="do_not_contact">{t("Não Contatar")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={seniority}
            onValueChange={(val) => {
              setSeniority(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[195px]">
              <SelectValue placeholder={t("Senioridade")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todas as senioridades")}</SelectItem>
              <SelectItem value="junior">{t("Júnior")}</SelectItem>
              <SelectItem value="pleno">{t("Pleno")}</SelectItem>
              <SelectItem value="senior">{t("Sênior")}</SelectItem>
              <SelectItem value="especialista">{t("Especialista")}</SelectItem>
              <SelectItem value="coordenacao">{t("Coordenação")}</SelectItem>
              <SelectItem value="gerencia">{t("Gerência")}</SelectItem>
              <SelectItem value="diretoria">{t("Diretoria / C-Level")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-surface-muted p-4 mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("Nenhum candidato encontrado")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            {t("Cadastre novos profissionais no banco de talentos para vinculá-los aos processos seletivos.")}
          </p>
          <Button onClick={() => setIsNewOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("Cadastrar Primeiro Candidato")}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Visualização Mobile: Cards */}
          <div className="block md:hidden space-y-3">
            {candidates.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/app/recrutamento/talentos/${c.id}`)}
                className="rounded-lg border bg-card p-4 shadow-xs hover:border-primary/50 transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base text-foreground truncate">{c.full_name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{c.email ?? c.phone_e164 ?? "—"}</p>
                  </div>
                  <CandidateStatusBadge status={c.status} />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <span className="font-medium text-muted-foreground">{t("Cargo / Empresa")}:</span>
                    <span className="truncate">{c.current_job_title ?? c.current_role ?? "—"} {c.current_company ? `(${c.current_company})` : ""}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground pt-1">
                    <span><span className="font-medium">{t("Senioridade")}:</span> <span className="capitalize text-foreground">{c.seniority ?? "—"}</span></span>
                    <span><span className="font-medium">{t("Local")}:</span> {c.city && c.state ? `${c.city}, ${c.state}` : c.city ?? "—"}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs"
                    onClick={() => setEditingCandidate(c)}
                  >
                    {t("Editar")}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Visualização Desktop: Tabela */}
          <div className="hidden md:block rounded-md border bg-card overflow-hidden shadow-xs">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/60 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3.5">{t("Nome")}</th>
                  <th className="p-3.5">{t("Cargo / Empresa")}</th>
                  <th className="p-3.5">{t("Área")}</th>
                  <th className="p-3.5">{t("Localização")}</th>
                  <th className="p-3.5">{t("Senioridade")}</th>
                  <th className="p-3.5">{t("Status")}</th>
                  <th className="p-3.5 text-right">{t("Ações")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {candidates.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/app/recrutamento/talentos/${c.id}`)}
                    className="hover:bg-accent/5 transition-colors cursor-pointer"
                  >
                    <td className="p-3.5">
                      <Link
                        href={`/app/recrutamento/talentos/${c.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.full_name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{c.email ?? c.phone_e164 ?? "—"}</span>
                    </td>
                    <td className="p-3.5">
                      <div className="text-foreground font-medium">{c.current_job_title ?? c.current_role ?? "—"}</div>
                      {c.current_company && (
                        <div className="text-xs text-muted-foreground">{c.current_company}</div>
                      )}
                    </td>
                    <td className="p-3.5 text-muted-foreground">{c.area ?? "—"}</td>
                    <td className="p-3.5 text-muted-foreground">
                      {c.city && c.state ? `${c.city}, ${c.state}` : c.city ?? "—"}
                    </td>
                    <td className="p-3.5 text-muted-foreground capitalize">{c.seniority ?? "—"}</td>
                    <td className="p-3.5">
                      <CandidateStatusBadge status={c.status} />
                    </td>
                    <td className="p-3.5 text-right">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setEditingCandidate(c)}
                        >
                          {t("Editar")}
                        </Button>
                        <Link href={`/app/recrutamento/talentos/${c.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs hover:bg-accent/10 hover:text-primary">
                            <span>{t("Ver dossiê")}</span>
                            <ArrowSquareOut className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border rounded-md bg-card text-xs text-muted-foreground">
              <span>
                {t("Página")} {pagination.page} {t("de")} {pagination.totalPages} ({pagination.total} {t("candidatos")})
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("Anterior")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("Próxima")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <NewCandidateDialog open={isNewOpen} onOpenChange={setIsNewOpen} />
      {editingCandidate && (
        <EditCandidateDialog
          candidate={editingCandidate}
          open={!!editingCandidate}
          onOpenChange={(open) => {
            if (!open) setEditingCandidate(null);
          }}
        />
      )}
    </div>
  );
}

function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  const t = useT();
  const label = STATUS_LABELS[status] ?? status;

  switch (status) {
    case "active":
      return <Badge variant="outline" className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">{t(label)}</Badge>;
    case "in_process":
      return <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary dark:text-primary-foreground font-semibold">{t(label)}</Badge>;
    case "hired":
      return <Badge variant="secondary" className="border-amber-600/30 bg-amber-500/15 text-amber-800 dark:text-amber-300 font-medium">{t(label)}</Badge>;
    case "do_not_contact":
      return <Badge variant="destructive" className="font-medium">{t(label)}</Badge>;
    case "inactive":
    default:
      return <Badge variant="secondary" className="font-normal text-muted-foreground">{t(label)}</Badge>;
  }
}

type NewCandidateForm = {
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
};

function NewCandidateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const create = useCreateCandidate();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<NewCandidateForm>({
    defaultValues: {
      seniority: "pleno",
      status: "active",
    },
  });

  const currentSeniority = watch("seniority");
  const currentStatus = watch("status");
  const currentState = watch("state");

  const fieldError = (field: keyof NewCandidateForm) => {
    const message = errors[field]?.message;
    return typeof message === "string" ? message : undefined;
  };
  const fieldClass = (field: keyof NewCandidateForm) =>
    fieldError(field) ? "border-red-500 focus-visible:ring-red-500" : undefined;

  async function onSubmit(data: NewCandidateForm) {
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
      expected_salary: data.expected_salary ? Number(data.expected_salary) : undefined,
      availability: data.availability?.trim() || undefined,
      status: data.status || "active",
      notes: data.notes?.trim() || undefined,
    };
    const parsed = createCandidateSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in data) {
          setError(field as keyof NewCandidateForm, {
            type: "validation",
            message: issue.message,
          });
        }
      }
      toast.error(parsed.error.issues[0]?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      await create.mutateAsync(parsed.data);
      toast.success(t("Candidato cadastrado com sucesso!"));
      reset();
      onOpenChange(false);
    } catch {
      // toast de erro exibido automaticamente
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Novo Candidato")}</DialogTitle>
          <DialogDescription>
            {t("Cadastre as informações profissionais do talento.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="full_name">{t("Nome Completo")} *</Label>
            <Input
              id="full_name"
              required
              placeholder={t("ex: Carlos Eduardo Silva")}
              className={fieldClass("full_name")}
              aria-invalid={!!fieldError("full_name")}
              {...register("full_name", { required: t("Nome é obrigatório") })}
            />
            {fieldError("full_name") && <p className="text-xs text-red-600">{fieldError("full_name")}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">{t("E-mail")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("ex: carlos@email.com")}
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
              <Label htmlFor="phone_e164">{t("Telefone / WhatsApp")}</Label>
              <Input
                id="phone_e164"
                placeholder={t("ex: (81) 98888-7777")}
                className={fieldClass("phone_e164")}
                aria-invalid={!!fieldError("phone_e164")}
                {...register("phone_e164", {
                  onChange: (event) => {
                    event.target.value = maskPhoneBR(event.target.value);
                  },
                  validate: (value) => {
                    if (!value) return true;
                    return /^\+\d{8,15}$/.test(normalizePhoneBR(value) ?? "") || t("Telefone inválido");
                  },
                })}
              />
              {fieldError("phone_e164") && <p className="text-xs text-red-600">{fieldError("phone_e164")}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="status">{t("Status")}</Label>
              <Select value={currentStatus} onValueChange={(value) => setValue("status", value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("Ativo")}</SelectItem>
                  <SelectItem value="in_process">{t("Em Processo")}</SelectItem>
                  <SelectItem value="hired">{t("Contratado")}</SelectItem>
                  <SelectItem value="inactive">{t("Inativo")}</SelectItem>
                  <SelectItem value="do_not_contact">{t("N\u00e3o Contatar")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="seniority">{t("Senioridade")}</Label>
              <Select value={currentSeniority} onValueChange={(value) => setValue("seniority", value)}>
                <SelectTrigger id="seniority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">{t("J\u00fanior")}</SelectItem>
                  <SelectItem value="pleno">{t("Pleno")}</SelectItem>
                  <SelectItem value="senior">{t("S\u00e9nior")}</SelectItem>
                  <SelectItem value="especialista">{t("Especialista")}</SelectItem>
                  <SelectItem value="lead">{t("Coordena\u00e7\u00e3o")}</SelectItem>
                  <SelectItem value="director">{t("Ger\u00eancia")}</SelectItem>
                  <SelectItem value="c_level">{t("Diretoria / C-Level")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="current_job_title">{t("Cargo Atual")}</Label>
              <Input id="current_job_title" placeholder={t("ex: Gerente de Operações")} {...register("current_job_title")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="current_company">{t("Empresa Atual")}</Label>
              <Input id="current_company" placeholder={t("ex: Multinacional S.A.")} {...register("current_company")} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="area">{t("Área")}</Label>
            <Input id="area" placeholder={t("ex: Operações, Financeiro")} {...register("area")} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="city">{t("Cidade")}</Label>
              <Input id="city" placeholder={t("ex: Recife")} {...register("city")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">{t("UF")}</Label>
              <Select value={currentState || ""} onValueChange={(value) => setValue("state", value)}>
                <SelectTrigger id="state">
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
              <Label htmlFor="expected_salary">{t("Pretensão Salarial")}</Label>
              <Input
                id="expected_salary"
                type="number"
                step="100"
                placeholder="ex: 8500"
                {...register("expected_salary", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="availability">{t("Disponibilidade")}</Label>
              <Input id="availability" placeholder={t("ex: Imediata, 30 dias")} {...register("availability")} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="linkedin_url">{t("Perfil LinkedIn")}</Label>
            <Input
              id="linkedin_url"
              placeholder={t("https://linkedin.com/in/perfil")}
              className={fieldClass("linkedin_url")}
              aria-invalid={!!fieldError("linkedin_url")}
              {...register("linkedin_url")}
            />
            {fieldError("linkedin_url") && <p className="text-xs text-red-600">{fieldError("linkedin_url")}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">{t("Observações")}</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder={t("Informações relevantes sobre perfil e entrevistas")}
              {...register("notes")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("Salvando...") : t("Cadastrar Candidato")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
