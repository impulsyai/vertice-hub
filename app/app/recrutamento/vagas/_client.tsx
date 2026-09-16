"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { Briefcase, Plus, MagnifyingGlass, ArrowSquareOut } from "@/lib/ui/icons";
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
import { useJobList, useCreateJob, useCompanyList } from "@/lib/people/client-hooks";
import type { JobStatus, VerticeJobOpening } from "@/lib/people/types";

const STATUS_LABELS: Record<JobStatus, string> = {
  open: "Aberta",
  draft: "Rascunho",
  paused: "Pausada",
  closed: "Fechada",
  cancelled: "Cancelada",
};

export function VagasClient() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const { data, isLoading } = useJobList({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    page,
    limit: 25,
  });

  const jobs = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Vagas de Recrutamento")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Gestão de posições abertas e processos seletivos para empresas clientes.")}
          </p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          {t("Nova Vaga")}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Buscar por título ou departamento...")}
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
            <SelectItem value="open">{t("Aberta")}</SelectItem>
            <SelectItem value="draft">{t("Rascunho")}</SelectItem>
            <SelectItem value="paused">{t("Pausada")}</SelectItem>
            <SelectItem value="closed">{t("Fechada")}</SelectItem>
            <SelectItem value="cancelled">{t("Cancelada")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-surface-muted p-4 mb-4">
            <Briefcase className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("Nenhuma vaga aberta")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            {t("Abra novas vagas vinculadas às empresas clientes para dar início ao processo de atração e seleção.")}
          </p>
          <Button onClick={() => setIsNewOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("Abrir Primeira Vaga")}
          </Button>
        </Card>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
              <tr>
                <th className="p-4">{t("Título da Vaga")}</th>
                <th className="p-4">{t("Empresa Cliente")}</th>
                <th className="p-4">{t("Modelo")}</th>
                <th className="p-4">{t("Local")}</th>
                <th className="p-4">{t("Status")}</th>
                <th className="p-4 text-right">{t("Ações")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <Link
                      href={`/app/recrutamento/vagas/${job.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors block"
                    >
                      {job.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{job.department ?? "Geral"}</span>
                  </td>
                  <td className="p-4 font-medium text-foreground">
                    {job.client_company?.trade_name ?? "—"}
                  </td>
                  <td className="p-4 text-muted-foreground capitalize">
                    {job.work_model === "remote" ? t("Remoto") : job.work_model === "hybrid" ? t("Híbrido") : t("Presencial")}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {job.city && job.state ? `${job.city}, ${job.state}` : job.location ?? "—"}
                  </td>
                  <td className="p-4">
                    <Badge variant={job.status === "open" ? "default" : "secondary"}>
                      {t(STATUS_LABELS[job.status] ?? job.status)}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/app/recrutamento/pipeline?job_id=${job.id}`}>
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                          {t("Pipeline")}
                        </Button>
                      </Link>
                      <Link href={`/app/recrutamento/vagas/${job.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 gap-1">
                          <span>{t("Ver")}</span>
                          <ArrowSquareOut className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
              <span>
                {t("Página")} {pagination.page} {t("de")} {pagination.totalPages} ({pagination.total} {t("vagas")})
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

      <NewJobDialog open={isNewOpen} onOpenChange={setIsNewOpen} />
    </div>
  );
}

function NewJobDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const create = useCreateJob();
  const { data: companiesData } = useCompanyList({ limit: 100 });
  const companies = companiesData?.data ?? [];

  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<{
    title: string;
    client_company_id: string;
    work_model: "remote" | "hybrid" | "presential";
    location?: string;
    city?: string;
    state?: string;
    department?: string;
    description?: string;
    requirements?: string;
  }>({
    defaultValues: {
      work_model: "presential",
    },
  });

  const selectedCompany = watch("client_company_id");

  async function onSubmit(data: {
    title: string;
    client_company_id: string;
    work_model: "remote" | "hybrid" | "presential";
    location?: string;
    city?: string;
    state?: string;
    department?: string;
    description?: string;
    requirements?: string;
  }) {
    if (!data.client_company_id) {
      toast.error(t("Selecione uma empresa cliente"));
      return;
    }

    try {
      await create.mutateAsync({
        title: data.title,
        client_company_id: data.client_company_id,
        work_model: data.work_model,
        location: data.location || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        department: data.department || undefined,
        description: data.description || undefined,
        requirements: data.requirements || undefined,
        status: "open",
      });
      toast.success(t("Vaga aberta com sucesso!"));
      reset();
      onOpenChange(false);
    } catch {
      // erro tratado no hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Nova Vaga de Recrutamento")}</DialogTitle>
          <DialogDescription>
            {t("Abra uma nova posição vinculada a um cliente B2B.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="title">{t("Título da Vaga")} *</Label>
            <Input id="title" required placeholder={t("ex: Diretor de Operações Industriais")} {...register("title", { required: true })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="company">{t("Empresa Cliente")} *</Label>
            <Select value={selectedCompany} onValueChange={(val) => setValue("client_company_id", val)}>
              <SelectTrigger id="company">
                <SelectValue placeholder={t("Selecione a empresa contratante...")} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.trade_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("Modelo de Trabalho")}</Label>
              <Select
                defaultValue="presential"
                onValueChange={(val) => setValue("work_model", val as "remote" | "hybrid" | "presential")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presential">{t("Presencial")}</SelectItem>
                  <SelectItem value="hybrid">{t("Híbrido")}</SelectItem>
                  <SelectItem value="remote">{t("Remoto")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="department">{t("Departamento")}</Label>
              <Input id="department" placeholder={t("ex: Diretoria / Operações")} {...register("department")} />
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
            <Label htmlFor="description">{t("Descrição do Perfil")}</Label>
            <Input id="description" placeholder={t("Resumo da missão da vaga...")} {...register("description")} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("Salvando...") : t("Publicar Vaga")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
