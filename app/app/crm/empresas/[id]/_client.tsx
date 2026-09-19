"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import {
  ArrowLeft,
  Buildings,
  PencilSimple,
  Globe,
  MapPin,
  User,
  Users,
  EnvelopeSimple,
  Phone,
  Briefcase,
  Kanban,
  ArrowSquareOut,
  Note,
} from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyDetail } from "@/lib/people/client-hooks";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { EditCompanyDialog } from "../_client";

export function EmpresaDetalheClient({ id }: { id: string }) {
  const t = useT();
  const tagDoIdioma = useTagDeIdioma();
  const { data, isLoading, error } = useCompanyDetail(id);
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-md lg:col-span-2" />
          <Skeleton className="h-72 rounded-md lg:col-span-1" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="font-medium text-destructive">{t("Empresa cliente não encontrada.")}</div>
        <Link href="/app/crm/empresas">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("Voltar às Empresas")}
          </Button>
        </Link>
      </div>
    );
  }

  const { company, contacts = [], jobs = [], leads = [] } = data;

  const statusLabel =
    company.status === "active"
      ? t("Ativa")
      : company.status === "prospect"
        ? t("Prospect")
        : t("Inativa");

  const statusBadgeStyle =
    company.status === "active"
      ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
      : company.status === "prospect"
        ? "border-amber-600/30 bg-amber-500/15 text-amber-800 dark:text-amber-300 font-medium"
        : "border-stone-300 bg-stone-100 text-stone-700 font-normal";

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/crm/empresas">
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("Voltar")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-primary uppercase">
                {t("Conta Corporativa")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {company.trade_name}
              </h1>
              <Badge variant="outline" className={statusBadgeStyle}>
                {statusLabel}
              </Badge>
            </div>
            {company.legal_name && (
              <p className="mt-0.5 text-xs text-muted-foreground">{company.legal_name}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/app/crm/empresas">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("Voltar")}
            </Button>
          </Link>
          <Button onClick={() => setIsEditOpen(true)} className="gap-2">
            <PencilSimple className="h-4 w-4" />
            {t("Editar Empresa")}
          </Button>
        </div>
      </header>

      {/* Grid Principal do Dossiê */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna Principal: Dados da Empresa & Observações */}
        <div className="space-y-6 lg:col-span-2">
          {/* Dados da Empresa */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Buildings className="h-4 w-4 text-primary" />
                {t("Dados da Empresa")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 pt-4 text-sm sm:grid-cols-2">
              <div>
                <span className="block text-xs text-muted-foreground">{t("Nome Fantasia")}</span>
                <span className="font-medium text-foreground">{company.trade_name}</span>
              </div>

              <div>
                <span className="block text-xs text-muted-foreground">{t("Razão Social")}</span>
                <span className="text-foreground">{company.legal_name || "—"}</span>
              </div>

              <div>
                <span className="block text-xs text-muted-foreground">{t("Setor de Atuação")}</span>
                <span className="text-foreground">{company.industry || "—"}</span>
              </div>

              <div>
                <span className="block text-xs text-muted-foreground">{t("Website")}</span>
                {company.website ? (
                  <a
                    href={
                      company.website.startsWith("http")
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              <div>
                <span className="block text-xs text-muted-foreground">{t("Cidade / UF")}</span>
                <span className="inline-flex items-center gap-1 text-foreground">
                  {(company.city || company.state) && (
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {company.city && company.state
                    ? `${company.city}, ${company.state}`
                    : company.city || company.state || "—"}
                </span>
              </div>

              <div>
                <span className="block text-xs text-muted-foreground">{t("Status Comercial")}</span>
                <span className="font-medium">{statusLabel}</span>
              </div>

              {company.created_at && (
                <div className="border-t pt-2 text-xs text-muted-foreground sm:col-span-2">
                  {t("Cadastrada em")}:{" "}
                  {new Date(company.created_at).toLocaleDateString(tagDoIdioma, {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Note className="h-4 w-4 text-primary" />
                {t("Observações Comerciais & Alinhamentos")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {company.notes ? (
                <div className="rounded-md border border-border/50 bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {company.notes}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {t("Nenhuma observação cadastrada para esta empresa.")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Oportunidades Comerciais (CRM B2B) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Kanban className="h-4 w-4 text-primary" />
                  {t("Oportunidades Comerciais")}
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs text-muted-foreground">
                  {t("Negócios e projetos comerciais vinculados a esta conta")}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {leads.length} {leads.length === 1 ? t("oportunidade") : t("oportunidades")}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  <Kanban className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="font-medium text-foreground">
                    {t("Nenhuma oportunidade comercial vinculada")}
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    {t("Crie uma oportunidade no Funil Comercial associando esta empresa cliente.")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 overflow-hidden rounded-md border bg-card">
                  {leads.map((l) => (
                    <div
                      key={l.id}
                      className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-accent/5 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/app/pipelines/${l.pipeline_id}?lead=${l.id}`}
                            className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {l.title}
                          </Link>
                          {l.stage?.name && (
                            <Badge
                              variant="outline"
                              className="border-primary/30 bg-primary/5 text-[11px] text-primary"
                            >
                              {l.stage.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                          {l.value_cents != null && (
                            <span className="font-medium text-foreground">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: l.currency ?? "BRL",
                                maximumFractionDigits: 0,
                              }).format(l.value_cents / 100)}
                            </span>
                          )}
                          <span>• {new Date(l.created_at).toLocaleDateString(tagDoIdioma)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link href={`/app/pipelines/${l.pipeline_id}?lead=${l.id}`}>
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                            <ArrowSquareOut className="h-3.5 w-3.5" />
                            {t("Ver no Funil")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vagas / Processos de R&S */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Briefcase className="h-4 w-4 text-primary" />
                {t("Vagas & Processos de R&S")}
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-normal">
                {jobs.length} {jobs.length === 1 ? t("vaga") : t("vagas")}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  <Briefcase className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="font-medium text-foreground">{t("Nenhuma vaga vinculada")}</p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    {t(
                      "Esta empresa cliente ainda não possui processos seletivos cadastrados no módulo de Recrutamento & Seleção.",
                    )}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 overflow-hidden rounded-md border bg-card">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-accent/5 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/app/recrutamento/vagas/${job.id}`}
                            className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {job.title}
                          </Link>
                          <Badge
                            variant="outline"
                            className={
                              job.status === "open"
                                ? "border-emerald-600/30 bg-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-300"
                                : "border-stone-300 bg-stone-100 text-[11px] text-stone-700"
                            }
                          >
                            {job.status === "open" ? t("Aberta") : job.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">
                            {job.work_model === "presential"
                              ? t("Presencial")
                              : job.work_model === "hybrid"
                                ? t("Híbrido")
                                : t("Remoto")}
                          </span>
                          {job.city && (
                            <span>
                              • {job.city}
                              {job.state ? `/${job.state}` : ""}
                            </span>
                          )}
                          {job.openings_count > 1 && (
                            <span>
                              • {job.openings_count} {t("posições")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link href={`/app/recrutamento/pipeline?job_id=${job.id}`}>
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                            <Kanban className="h-3.5 w-3.5 text-primary" />
                            {t("Funil")}
                          </Button>
                        </Link>
                        <Link href={`/app/recrutamento/vagas/${job.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs hover:text-primary"
                          >
                            <ArrowSquareOut className="h-3.5 w-3.5" />
                            {t("Ver Vaga")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Lateral: Contatos / Decisores Corporativos */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  {t("Contatos & Decisores")}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Decisores vinculados via CRM comercial.")}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                {contacts.length}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  <User className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="font-medium text-foreground">{t("Nenhum contato vinculado")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Não há decisores corporativos associados a esta empresa.")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c) => {
                    const contact = c.contact;
                    const contactName = rotuloDoContato(contact, t);
                    return (
                      <div
                        key={c.id}
                        className="space-y-2 rounded-lg border bg-card p-3.5 transition-colors hover:bg-accent/5"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {contactName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                                href={`/app/contacts/${c.contact_id}`}
                                className="truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                              >
                                {contactName}
                              </Link>
                              {c.is_primary && (
                                <Badge
                                  variant="outline"
                                  className="border-primary/40 bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary"
                                >
                                  {t("Principal")}
                                </Badge>
                              )}
                            </div>
                            {c.role_in_company && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Briefcase className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">{c.role_in_company}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 border-t border-border/40 pt-1 text-xs text-muted-foreground">
                          {contact?.phone_number && (
                            <div className="flex items-center gap-1.5">
                              <Phone
                                className="h-3 w-3 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span>{contact.phone_number}</span>
                            </div>
                          )}
                          {contact?.email && (
                            <div className="flex items-center gap-1.5">
                              <EnvelopeSimple
                                className="h-3 w-3 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          {!contact?.phone_number && !contact?.email && (
                            <span className="text-muted-foreground italic">
                              {t("Sem dados de contato direto.")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Edição Reutilizado */}
      {isEditOpen && (
        <EditCompanyDialog
          key={company.id + (company.updated_at ?? "")}
          company={company}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
        />
      )}
    </div>
  );
}
