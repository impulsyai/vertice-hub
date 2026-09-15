"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";
import { Buildings, Plus, MagnifyingGlass } from "@/lib/ui/icons";
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
import { useCompanyList, useCreateCompany } from "@/lib/people/client-hooks";
import type { ClientCompany } from "@/lib/people/types";

export function EmpresasClient() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const { data, isLoading } = useCompanyList({ search: search || undefined, page, limit: 20 });
  const companies = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Empresas Clientes")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Gestão das contas corporativas e clientes B2B contratantes.")}
          </p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          {t("Nova Empresa")}
        </Button>
      </header>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Buscar por nome, setor ou cidade...")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-surface-muted p-4 mb-4">
            <Buildings className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("Nenhuma empresa cliente cadastrada")}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
            {t("Cadastre as empresas parceiras e contratantes para vincular contatos corporativos e vagas de recrutamento.")}
          </p>
          <Button onClick={() => setIsNewOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("Cadastrar Primeira Empresa")}
          </Button>
        </Card>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
              <tr>
                <th className="p-4">{t("Empresa")}</th>
                <th className="p-4">{t("Setor")}</th>
                <th className="p-4">{t("Localização")}</th>
                <th className="p-4">{t("Website")}</th>
                <th className="p-4">{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-foreground">{company.trade_name}</div>
                    {company.legal_name && (
                      <div className="text-xs text-muted-foreground">{company.legal_name}</div>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground">{company.industry ?? "—"}</td>
                  <td className="p-4 text-muted-foreground">
                    {company.city && company.state ? `${company.city}, ${company.state}` : company.city ?? "—"}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {company.website ? (
                      <a
                        href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {company.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant={company.status === "active" ? "default" : "secondary"}>
                      {company.status === "active" ? t("Ativa") : company.status === "prospect" ? t("Prospect") : t("Inativa")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
              <span>
                {t("Página")} {pagination.page} {t("de")} {pagination.totalPages} ({pagination.total} {t("empresas")})
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

      <NewCompanyDialog open={isNewOpen} onOpenChange={setIsNewOpen} />
    </div>
  );
}

function NewCompanyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const create = useCreateCompany();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{
    trade_name: string;
    legal_name?: string;
    industry?: string;
    website?: string;
    city?: string;
    state?: string;
    notes?: string;
  }>();

  async function onSubmit(data: {
    trade_name: string;
    legal_name?: string;
    industry?: string;
    website?: string;
    city?: string;
    state?: string;
    notes?: string;
  }) {
    try {
      await create.mutateAsync({
        trade_name: data.trade_name,
        legal_name: data.legal_name || undefined,
        industry: data.industry || undefined,
        website: data.website || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        notes: data.notes || undefined,
        status: "active",
      });
      toast.success(t("Empresa cliente criada com sucesso!"));
      reset();
      onOpenChange(false);
    } catch {
      // Toast já emitido pelo hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Nova Empresa Cliente")}</DialogTitle>
          <DialogDescription>
            {t("Cadastre os dados principais da empresa contratante.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="trade_name">{t("Nome Fantasia")} *</Label>
            <Input id="trade_name" required placeholder={t("ex: Tramontina")} {...register("trade_name", { required: true })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="legal_name">{t("Razão Social")}</Label>
            <Input id="legal_name" placeholder={t("ex: Tramontina S.A.")} {...register("legal_name")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="industry">{t("Setor de Atuação")}</Label>
              <Input id="industry" placeholder={t("ex: Indústria, Varejo")} {...register("industry")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="website">{t("Website")}</Label>
              <Input id="website" placeholder={t("ex: www.empresa.com.br")} {...register("website")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="city">{t("Cidade")}</Label>
              <Input id="city" placeholder={t("ex: Recife")} {...register("city")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">{t("Estado (UF)")}</Label>
              <Input id="state" placeholder={t("ex: PE")} maxLength={2} {...register("state")} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("Salvando...") : t("Criar Empresa")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
