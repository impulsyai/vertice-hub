"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { User, Plus, MagnifyingGlass, ArrowSquareOut } from "@/lib/ui/icons";
import { Input } from "@/components/ui/input";
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
import type { CandidateStatus } from "@/lib/people/types";

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

  const { data, isLoading } = useCandidateList({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    seniority: seniority !== "all" ? seniority : undefined,
    page,
    limit: 25,
  });

  const candidates = data?.data ?? [];
  const pagination = data?.pagination;

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

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Buscar por nome, cargo ou empresa...")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={status}
          onValueChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
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
          <SelectTrigger className="w-[195px]">
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
        <div className="rounded-md border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
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
            <tbody className="divide-y">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3.5">
                    <Link
                      href={`/app/recrutamento/talentos/${c.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors block"
                    >
                      {c.full_name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{c.email ?? c.phone_e164 ?? "—"}</span>
                  </td>
                  <td className="p-3.5">
                    <div className="text-foreground">{c.current_job_title ?? c.current_role ?? "—"}</div>
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
                    <Link href={`/app/recrutamento/talentos/${c.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 gap-1">
                        <span>{t("Ver")}</span>
                        <ArrowSquareOut className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
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
    </div>
  );
}

function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  const t = useT();
  const label = STATUS_LABELS[status] ?? status;

  switch (status) {
    case "active":
      return <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">{t(label)}</Badge>;
    case "in_process":
      return <Badge variant="default" className="bg-blue-600 hover:bg-blue-600">{t(label)}</Badge>;
    case "hired":
      return <Badge variant="secondary" className="bg-purple-500/20 text-purple-700 dark:text-purple-300">{t(label)}</Badge>;
    case "do_not_contact":
      return <Badge variant="destructive">{t(label)}</Badge>;
    case "inactive":
    default:
      return <Badge variant="secondary">{t(label)}</Badge>;
  }
}

function NewCandidateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const create = useCreateCandidate();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{
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
    notes?: string;
  }>();

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
    notes?: string;
  }) {
    try {
      await create.mutateAsync({
        full_name: data.full_name,
        email: data.email || undefined,
        phone_e164: data.phone_e164 || undefined,
        linkedin_url: data.linkedin_url || undefined,
        current_job_title: data.current_job_title || undefined,
        current_company: data.current_company || undefined,
        area: data.area || undefined,
        seniority: data.seniority || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        notes: data.notes || undefined,
      });
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
            <Input id="full_name" required placeholder={t("ex: Carlos Eduardo Silva")} {...register("full_name", { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">{t("E-mail")}</Label>
              <Input id="email" type="email" placeholder={t("ex: carlos@email.com")} {...register("email")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone_e164">{t("Telefone / WhatsApp")}</Label>
              <Input id="phone_e164" placeholder={t("ex: (81) 98888-7777")} {...register("phone_e164")} />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="area">{t("Área")}</Label>
              <Input id="area" placeholder={t("ex: Operações, Financeiro")} {...register("area")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="seniority">{t("Senioridade")}</Label>
              <Input id="seniority" placeholder={t("ex: Gerência, Sênior")} {...register("seniority")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="city">{t("Cidade")}</Label>
              <Input id="city" placeholder={t("ex: Recife")} {...register("city")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">{t("UF")}</Label>
              <Input id="state" placeholder={t("PE")} maxLength={2} {...register("state")} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="linkedin_url">{t("Perfil LinkedIn")}</Label>
            <Input id="linkedin_url" placeholder={t("https://linkedin.com/in/perfil")} {...register("linkedin_url")} />
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
